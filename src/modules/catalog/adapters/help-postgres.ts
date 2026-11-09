import { helpDestinations } from "../domain/help.ts";
import { createHash } from "node:crypto";
import { pool, transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { StaffAuthorization } from "../../identity/contracts/index.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type {
  HelpContent,
  HelpEditorStore,
  HelpEdit,
  HelpCreation,
  HelpAdminFilters,
} from "../application/help.ts";
const projection = "id,version,topic,question,answer,href,action";
export class PostgresHelp implements HelpContent, HelpEditorStore {
  constructor(
    private authorization: StaffAuthorization,
    private audit: SecurityAudit,
  ) {}
  create(actor: string, input: HelpCreation) {
    return transaction(async (tx) => {
      await this.authorization.requirePermission(tx, actor, "moderate");
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify([
            input.question,
            input.answer,
            input.topic,
            input.destination,
            input.reason,
          ]),
        )
        .digest("hex");
      const destination = helpDestinations[input.destination];
      const inserted = await tx.query(
        "INSERT INTO catalog.help_articles(id,question,answer,topic,href,action,published) VALUES($1,$2,$3,$4,$5,$6,false) ON CONFLICT DO NOTHING RETURNING id",
        [
          input.id,
          input.question,
          input.answer,
          input.topic,
          destination.href,
          destination.action,
        ],
      );
      await tx.query(
        "SELECT id FROM catalog.help_articles WHERE id=$1 FOR UPDATE",
        [input.id],
      );
      if (!inserted.rowCount) {
        const prior = (
          await tx.query(
            "SELECT actor_id,fingerprint FROM catalog.help_creations WHERE article_id=$1",
            [input.id],
          )
        ).rows[0];
        if (
          !prior ||
          prior.actor_id !== actor ||
          prior.fingerprint !== fingerprint
        )
          throw new AppError(
            "ARTICLE_EXISTS",
            "This article ID is already in use. Choose another ID or load the existing article.",
            409,
          );
        await this.audit.record(tx, actor, "help.creation.replayed", input.id, {
          version: 1,
        });
        return { id: input.id, version: 1, replayed: true };
      }
      await tx.query(
        "INSERT INTO catalog.help_creations(article_id,actor_id,fingerprint,snapshot,reason) VALUES($1,$2,$3,$4,$5)",
        [
          input.id,
          actor,
          fingerprint,
          {
            question: input.question,
            answer: input.answer,
            topic: input.topic,
            ...destination,
            published: false,
            version: 1,
          },
          input.reason,
        ],
      );
      await this.audit.record(tx, actor, "help.created", input.id, {
        version: 1,
        published: false,
        reason: input.reason,
      });
      return { id: input.id, version: 1, replayed: false };
    });
  }
  async published() {
    return (
      await pool.query(
        `SELECT ${projection} FROM catalog.help_articles WHERE published ORDER BY id`,
      )
    ).rows;
  }
  list(actor: string, filters: HelpAdminFilters = {}) {
    return transaction(async (tx) => {
      await this.authorization.requirePermission(tx, actor, "moderate");
      const rows = (
        await tx.query(
          `SELECT ${projection},published FROM catalog.help_articles
         WHERE ($1::text IS NULL OR id COLLATE "C" > $1 COLLATE "C")
         AND ($2::text IS NULL OR strpos(lower(id || ' ' || question),lower($2))>0)
         AND ($3::boolean IS NULL OR published=$3)
         ORDER BY id COLLATE "C" LIMIT 21`,
          [
            filters.after ?? null,
            filters.q || null,
            filters.status === "published"
              ? true
              : filters.status === "unpublished"
                ? false
                : null,
          ],
        )
      ).rows;
      const items = rows.slice(0, 20);
      await this.audit.record(tx, actor, "help.read", "help", {
        count: items.length,
        olderPage: filters.after !== undefined,
        filtered: !!filters.q || (!!filters.status && filters.status !== "all"),
      });
      return { items, nextCursor: rows.length > 20 ? items[19].id : null };
    });
  }
  history(actor: string, id: string, beforeVersion?: number) {
    return transaction(async (tx) => {
      await this.authorization.requirePermission(tx, actor, "moderate");
      const article = await tx.query(
        "SELECT id FROM catalog.help_articles WHERE id=$1 FOR SHARE",
        [id],
      );
      if (!article.rowCount)
        throw new AppError("NOT_FOUND", "Help article not found.", 404);
      const rows = (
        await tx.query(
          `SELECT input_version AS "inputVersion", version, actor_id AS "actorId", reason, created_at AS "createdAt",
        jsonb_build_object('question',snapshot->'question','answer',snapshot->'answer','topic',snapshot->'topic','published',snapshot->'published') AS before
        FROM catalog.help_saves WHERE article_id=$1 AND ($2::int IS NULL OR input_version<$2)
        ORDER BY input_version DESC LIMIT 21`,
          [id, beforeVersion ?? null],
        )
      ).rows;
      const items = rows.slice(0, 20);
      await this.audit.record(tx, actor, "help.history.read", id, {
        count: items.length,
        olderPage: beforeVersion !== undefined,
      });
      return {
        items,
        nextCursor: rows.length > 20 ? items[19].inputVersion : null,
      };
    });
  }
  save(actor: string, id: string, input: HelpEdit) {
    return transaction(async (tx) => {
      await this.authorization.requirePermission(tx, actor, "moderate");
      const row = (
        await tx.query(
          `SELECT ${projection},published FROM catalog.help_articles WHERE id=$1 FOR UPDATE`,
          [id],
        )
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Help article not found.", 404);
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify([
            input.question,
            input.answer,
            input.topic,
            input.published,
            input.reason,
          ]),
        )
        .digest("hex");
      const prior = (
        await tx.query(
          "SELECT actor_id,fingerprint,version FROM catalog.help_saves WHERE article_id=$1 AND input_version=$2",
          [id, input.version],
        )
      ).rows[0];
      if (prior) {
        if (prior.actor_id !== actor || prior.fingerprint !== fingerprint)
          throw new AppError(
            "VERSION_CONFLICT",
            "This version was already changed. Load the latest article before saving a new edit.",
            409,
          );
        await this.audit.record(tx, actor, "help.save.replayed", id, {
          version: prior.version,
        });
        return { id, version: prior.version, replayed: true };
      }
      if (row.version !== input.version)
        throw new AppError(
          "VERSION_CONFLICT",
          "The article changed elsewhere. Load the latest article and review your draft.",
          409,
        );
      const version = row.version + 1;
      await tx.query(
        "UPDATE catalog.help_articles SET question=$2,answer=$3,topic=$4,published=$5,version=$6 WHERE id=$1",
        [
          id,
          input.question,
          input.answer,
          input.topic,
          input.published,
          version,
        ],
      );
      await tx.query(
        "INSERT INTO catalog.help_saves(article_id,input_version,actor_id,fingerprint,version,snapshot,reason) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [id, input.version, actor, fingerprint, version, row, input.reason],
      );
      await this.audit.record(tx, actor, "help.saved", id, {
        inputVersion: input.version,
        version,
        published: input.published,
        reason: input.reason,
      });
      return { id, version, replayed: false };
    });
  }
}
