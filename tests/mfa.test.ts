import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import {
  base32,
  decodeBase32,
  hotp,
  matchingCounter,
  MfaSecrets,
} from "../src/modules/identity/adapters/totp.ts";
import { Mfa } from "../src/modules/identity/application/mfa.ts";
import { PostgresMfa } from "../src/modules/identity/adapters/mfa.ts";
import {
  hashToken,
  PostgresIdentity,
} from "../src/modules/identity/adapters/postgres.ts";
import { buildApp } from "../src/app.ts";
if (!process.env.DATABASE_URL?.includes("/bookmyticket_test"))
  throw new Error("Requires isolated test database");
const encryptionKey = randomBytes(32).toString("hex"),
  mfa = new Mfa(new PostgresMfa(new MfaSecrets(encryptionKey)));
process.env.MFA_ENCRYPTION_KEY = encryptionKey;
before(migrate);
after(() => pool.end());
async function fixture() {
  const owner = randomUUID(),
    token = randomBytes(32).toString("base64url");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    owner,
    `${owner}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), owner],
  );
  return { owner, token };
}
async function addSession(owner: string) {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), owner],
  );
  return token;
}
async function clock() {
  return (await pool.query("SELECT clock_timestamp() now")).rows[0].now as Date;
}
async function enroll(token: string) {
  const setup = (await mfa.begin(token)) as {
    enrollmentId: string;
    secret: string;
  };
  const secret = decodeBase32(setup.secret),
    code = hotp(secret, Math.floor((await clock()).getTime() / 30000));
  const confirmed = (await mfa.confirm(token, setup.enrollmentId, code)) as {
    verified: boolean;
    recoveryCodes: string[];
  };
  return { ...setup, ...confirmed, secretBytes: secret, code };
}
test("RFC 4226/6238 vectors and base32 roundtrip", () => {
  const secret = Buffer.from("12345678901234567890");
  const expected = [
    "755224",
    "287082",
    "359152",
    "969429",
    "338314",
    "254676",
    "287922",
    "162583",
    "399871",
    "520489",
  ];
  expected.forEach((value, counter) =>
    assert.equal(hotp(secret, counter), value),
  );
  for (const [seconds, expected] of [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ] as const)
    assert.equal(hotp(secret, Math.floor(seconds / 30), 8), expected);
  assert.equal(base32(Buffer.from("foo")), "MZXW6");
  assert.deepEqual(decodeBase32(base32(secret)), secret);
});
test("BE:IAM-12 — enrollment encrypts secrets, binds the initiating session and returns recovery codes once", async () => {
  const f = await fixture(),
    other = await addSession(f.owner),
    setup = (await mfa.begin(f.token)) as {
      enrollmentId: string;
      secret: string;
    };
  const secret = decodeBase32(setup.secret),
    code = hotp(secret, Math.floor((await clock()).getTime() / 30000));
  await assert.rejects(mfa.confirm(other, setup.enrollmentId, code), {
    code: "MFA_ENROLLMENT_EXPIRED",
  });
  const r = (await mfa.confirm(f.token, setup.enrollmentId, code)) as {
    recoveryCodes: string[];
  };
  assert.equal(r.recoveryCodes.length, 8);
  assert.equal(new Set(r.recoveryCodes).size, 8);
  const stored = (
    await pool.query("SELECT * FROM identity.mfa WHERE account_id=$1", [
      f.owner,
    ])
  ).rows[0];
  assert(!JSON.stringify(stored).includes(setup.secret));
  assert.equal(stored.pending_ciphertext, null);
  const status = (await mfa.status(f.token)) as any;
  assert.equal(status.enrolled, true);
  assert.equal(status.verified, true);
  assert(!JSON.stringify(status).includes(setup.secret));
  assert(!JSON.stringify(status).includes(r.recoveryCodes[0]));
  await assert.rejects(mfa.status(other), { code: "AUTH_REQUIRED" });
  await assert.rejects(mfa.confirm(f.token, setup.enrollmentId, code), {
    code: "MFA_ENROLLMENT_EXPIRED",
  });
});
test("BE:IAM-12/13 — TOTP replay is rejected across sessions and elevation expires", async () => {
  const f = await fixture(),
    enrolled = await enroll(f.token),
    second = await addSession(f.owner);
  await assert.rejects(mfa.verify(second, enrolled.code), {
    code: "INVALID_MFA_CODE",
  });
  const next = hotp(
    enrolled.secretBytes,
    Math.floor((await clock()).getTime() / 30000) + 1,
  );
  assert.equal(((await mfa.verify(second, next)) as any).verified, true);
  await assert.rejects(mfa.verify(f.token, next), { code: "INVALID_MFA_CODE" });
  await pool.query(
    "UPDATE identity.sessions SET mfa_verified_at=now()-interval '31 minutes' WHERE token_hash=$1",
    [hashToken(second)],
  );
  assert.equal(((await mfa.status(second)) as any).verified, false);
  const identity = new PostgresIdentity(
    {
      available: () => false,
      send: async () => {
        throw new Error("No provider invoked");
      },
    },
    "",
  );
  assert.equal((await identity.authenticate(second)).mfaVerified, false);
  await assert.rejects(mfa.begin(second), { code: "MFA_REQUIRED" });
});
test("BE:IAM-12 — failed verification attempts persist and enrollment cannot reset lockout", async () => {
  const f = await fixture(),
    e = await enroll(f.token);
  let invalid = "000000";
  const now = await clock();
  while (matchingCounter(e.secretBytes, invalid, now, -1) !== null)
    invalid = (Number(invalid) + 1).toString().padStart(6, "0");
  for (let n = 0; n < 5; n++)
    await assert.rejects(mfa.verify(f.token, invalid), {
      code: "INVALID_MFA_CODE",
    });
  assert.equal(
    (
      await pool.query(
        "SELECT failures FROM identity.mfa WHERE account_id=$1",
        [f.owner],
      )
    ).rows[0].failures,
    5,
  );
  await assert.rejects(mfa.verify(f.token, invalid), {
    code: "MFA_RATE_LIMITED",
  });
  await assert.rejects(mfa.begin(f.token), { code: "MFA_RATE_LIMITED" });
  await pool.query(
    "UPDATE identity.mfa SET window_started_at=now()-interval '6 minutes' WHERE account_id=$1",
    [f.owner],
  );
  await assert.rejects(mfa.verify(f.token, invalid), {
    code: "INVALID_MFA_CODE",
  });
  assert.equal(
    (
      await pool.query(
        "SELECT failures FROM identity.mfa WHERE account_id=$1",
        [f.owner],
      )
    ).rows[0].failures,
    1,
  );
});
test("BE:IAM-12 — simultaneous recovery-code uses have one winner, never grant roles", async () => {
  const f = await fixture(),
    e = await enroll(f.token),
    second = await addSession(f.owner);
  const outcomes = await Promise.allSettled(
    Array.from({ length: 4 }, () => mfa.recover(second, e.recoveryCodes[0])),
  );
  assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
  for (const o of outcomes)
    if (o.status === "rejected")
      assert.equal(o.reason.code, "INVALID_RECOVERY_CODE");
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM identity.mfa_recovery_codes WHERE account_id=$1 AND used_at IS NOT NULL",
        [f.owner],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM identity.grants WHERE account_id=$1",
        [f.owner],
      )
    ).rows[0].n,
    0,
  );
});
test("BE:IAM-12 — MFA ciphertext cannot be transplanted to another account", () => {
  const secrets = new MfaSecrets(encryptionKey),
    secret = randomBytes(20),
    sealed = secrets.seal(secret, "account-a");
  assert.deepEqual(secrets.open(sealed, "account-a"), secret);
  assert.throws(() => secrets.open(sealed, "account-b"));
});
test("HTTP MFA workflow verifies real session and rechecks account suspension", async () => {
  const f = await fixture(),
    app = await buildApp();
  try {
    assert.equal(
      (await app.inject({ url: "/api/v1/auth/mfa" })).statusCode,
      401,
    );
    const setup = await app.inject({
      method: "POST",
      url: "/api/v1/auth/mfa/enroll",
      cookies: { session: f.token },
    });
    assert.equal(setup.statusCode, 200);
    const s = setup.json();
    const code = hotp(
      decodeBase32(s.secret),
      Math.floor((await clock()).getTime() / 30000),
    );
    const confirm = await app.inject({
      method: "POST",
      url: "/api/v1/auth/mfa/confirm",
      cookies: { session: f.token },
      payload: { enrollmentId: s.enrollmentId, code },
    });
    assert.equal(confirm.statusCode, 200);
    assert.equal(confirm.json().verified, true);
    assert.equal(
      (
        await app.inject({ url: "/api/v1/me", cookies: { session: f.token } })
      ).json().mfaVerified,
      true,
    );
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [f.owner],
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/auth/mfa",
          cookies: { session: f.token },
        })
      ).statusCode,
      401,
    );
  } finally {
    await app.close();
  }
});
