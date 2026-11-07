import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  pool,
  type Transaction,
  transaction,
} from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { AdmissionWindow } from "../../inventory/contracts/index.ts";
import type {
  TicketIssuer,
  TicketReader,
  OwnedTicket,
} from "../contracts/index.ts";
const digest = (v: string) => createHash("sha256").update(v).digest("hex");
export class PostgresTickets implements TicketIssuer, TicketReader {
  constructor(
    private window: AdmissionWindow,
    private encryptionKey = process.env.TICKET_ENCRYPTION_KEY ?? "",
  ) {}
  private key() {
    if (!/^[a-f0-9]{64}$/i.test(this.encryptionKey))
      throw new AppError(
        "TICKETING_UNAVAILABLE",
        "Ticket encryption configuration is missing.",
        503,
      );
    return Buffer.from(this.encryptionKey, "hex");
  }
  async issue(
    tx: Transaction,
    orderId: string,
    ownerId: string,
    items: { occurrence_id: string; resource_id: string; quantity: number }[],
  ) {
    const key = this.key();
    for (const item of items)
      for (let n = 0; n < item.quantity; n++) {
        const token = randomBytes(32).toString("base64url"),
          iv = randomBytes(12),
          cipher = createCipheriv("aes-256-gcm", key, iv),
          encrypted = Buffer.concat([
            cipher.update(token, "utf8"),
            cipher.final(),
          ]);
        await tx.query(
          "INSERT INTO ticketing.tickets(id,order_id,owner_id,occurrence_id,resource_id,ordinal,token_hash,token_ciphertext) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(order_id,occurrence_id,resource_id,ordinal) DO NOTHING",
          [
            randomUUID(),
            orderId,
            ownerId,
            item.occurrence_id,
            item.resource_id,
            n,
            digest(token),
            Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
              "base64",
            ),
          ],
        );
      }
  }
  async list(
    ownerId: string,
    orderId: string,
    tx?: Transaction,
    credentialOccurrences?: string[],
  ): Promise<OwnedTicket[]> {
    const rows = (
      await (tx ?? pool).query(
        "SELECT id,occurrence_id,resource_id,ordinal,state,remaining,token_ciphertext FROM ticketing.tickets WHERE owner_id=$1 AND order_id=$2 ORDER BY occurrence_id,resource_id,ordinal" +
          (tx ? " FOR SHARE" : ""),
        [ownerId, orderId],
      )
    ).rows;
    return rows.map((r) => {
      let token: string | undefined;
      if (
        r.state === "valid" &&
        r.remaining > 0 &&
        (!credentialOccurrences ||
          credentialOccurrences.includes(r.occurrence_id))
      ) {
        const bytes = Buffer.from(r.token_ciphertext, "base64"),
          cipher = createDecipheriv(
            "aes-256-gcm",
            this.key(),
            bytes.subarray(0, 12),
          );
        cipher.setAuthTag(bytes.subarray(12, 28));
        token = Buffer.concat([
          cipher.update(bytes.subarray(28)),
          cipher.final(),
        ]).toString("utf8");
      }
      return {
        id: r.id,
        occurrenceId: r.occurrence_id,
        resource: r.resource_id,
        ordinal: r.ordinal,
        state: r.state,
        remaining: r.remaining,
        ...(token ? { token } : {}),
      };
    });
  }
  async admit(
    actorId: string,
    occurrenceId: string,
    gate: string,
    token: string,
    key: string,
  ) {
    return transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,2))", [
        `${actorId}:${key}`,
      ]);
      const fingerprint = digest(JSON.stringify({ occurrenceId, gate, token }));
      const prior = (
        await tx.query(
          "SELECT outcome,fingerprint FROM ticketing.admissions WHERE actor_id=$1 AND operation_key=$2",
          [actorId, key],
        )
      ).rows[0];
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new AppError(
            "IDEMPOTENCY_CONFLICT",
            "Scan key was reused with different input.",
          );
        return { outcome: prior.outcome };
      }
      const window = await this.window.check(tx, occurrenceId);
      const ticket = (
        await tx.query(
          "SELECT * FROM ticketing.tickets WHERE token_hash=$1 FOR UPDATE",
          [digest(token)],
        )
      ).rows[0];
      let outcome = "invalid";
      if (ticket) {
        if (ticket.occurrence_id !== occurrenceId) outcome = "wrong_occurrence";
        else if (ticket.state !== "valid")
          outcome = ticket.state === "replaced" ? "transferred" : ticket.state;
        else if (window !== "open") outcome = window;
        else if (ticket.remaining === 0) outcome = "duplicate";
        else {
          await tx.query(
            "UPDATE ticketing.tickets SET remaining=remaining-1 WHERE id=$1",
            [ticket.id],
          );
          outcome = "admitted";
        }
      }
      await tx.query(
        "INSERT INTO ticketing.admissions(id,ticket_id,actor_id,occurrence_id,gate,operation_key,fingerprint,outcome) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          randomUUID(),
          ticket?.id ?? null,
          actorId,
          occurrenceId,
          gate,
          key,
          fingerprint,
          outcome,
        ],
      );
      return { outcome };
    });
  }
}
