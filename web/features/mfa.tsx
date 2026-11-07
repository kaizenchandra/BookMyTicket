import { useEffect, useState } from "react";
import { api } from "../api.ts";
export function AccountSecurity() {
  const [status, setStatus] = useState<{
      enrolled: boolean;
      verified: boolean;
      enrollmentPending: boolean;
    } | null>(null),
    [setup, setSetup] = useState<{
      enrollmentId: string;
      secret: string;
    } | null>(null),
    [recovery, setRecovery] = useState<string[]>([]),
    [code, setCode] = useState(""),
    [recoveryCode, setRecoveryCode] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    api("/auth/mfa")
      .then((r) => {
        if (current) setStatus(r);
      })
      .catch((e) => {
        if (current) setMessage(e.message);
      });
    return () => {
      current = false;
    };
  }, [revision]);
  function changed() {
    setCode("");
    setRecoveryCode("");
    setRevision((r) => r + 1);
    window.dispatchEvent(new Event("bmt-session"));
  }
  return (
    <section className="quote-panel">
      <h2>Account security</h2>
      {status ? (
        <>
          <p>
            Authenticator: {status.enrolled ? "enrolled" : "not enrolled"}. This
            session:{" "}
            {status.verified
              ? "MFA verified"
              : "MFA verification required for staff actions"}
            .
          </p>
          {!setup && (!status.enrolled || status.verified) && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMessage("");
                setRecovery([]);
                try {
                  setSetup(await api("/auth/mfa/enroll", { method: "POST" }));
                  setCode("");
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {status.enrolled
                ? "Replace authenticator"
                : "Set up authenticator"}
            </button>
          )}
          {setup && (
            <>
              <p>
                In your authenticator app, add a time-based entry named
                BookMyTicket using this setup key. Use six digits and a
                30-second period. Setup expires in ten minutes.
              </p>
              <div className="secret-key">
                <code>{setup.secret}</code>
              </div>
              <p>
                Keep this key private. It is only displayed during this setup.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setMessage("");
                  try {
                    const r = await api("/auth/mfa/confirm", {
                      method: "POST",
                      body: JSON.stringify({
                        enrollmentId: setup.enrollmentId,
                        code,
                      }),
                    });
                    setRecovery(r.recoveryCodes);
                    setSetup(null);
                    setMessage(
                      "Authenticator enrolled. Other sessions were revoked. Save the recovery codes below.",
                    );
                    changed();
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label htmlFor="enrollment-code">Authenticator code</label>
                <input
                  id="enrollment-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button className="primary" disabled={busy}>
                  Confirm authenticator
                </button>
              </form>
            </>
          )}
          {status.enrolled && !status.verified && !setup && (
            <>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setMessage("");
                  try {
                    await api("/auth/mfa/verify", {
                      method: "POST",
                      body: JSON.stringify({ code }),
                    });
                    setMessage(
                      "This session is MFA verified for up to 30 minutes. Existing role permissions still apply.",
                    );
                    changed();
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label htmlFor="mfa-code">Authenticator code</label>
                <input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button className="primary" disabled={busy}>
                  Verify this session
                </button>
              </form>
              <details>
                <summary>Use a recovery code</summary>
                <p>
                  Each recovery code can be used once. Replace your
                  authenticator if it has been lost.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setMessage("");
                    try {
                      await api("/auth/mfa/recover", {
                        method: "POST",
                        body: JSON.stringify({
                          code: recoveryCode.trim().toLowerCase(),
                        }),
                      });
                      setMessage(
                        "Recovery code consumed. You can now replace your authenticator.",
                      );
                      changed();
                    } catch (e) {
                      setMessage((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label htmlFor="recovery-code">Recovery code</label>
                  <input
                    id="recovery-code"
                    autoComplete="off"
                    required
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                  />
                  <button disabled={busy}>Use recovery code</button>
                </form>
              </details>
            </>
          )}
        </>
      ) : (
        <p>Loading security status…</p>
      )}
      {recovery.length > 0 && (
        <section>
          <h3>Save your recovery codes</h3>
          <p>
            Store these privately. They will not be displayed again after you
            leave this page.
          </p>
          <ul className="recovery-codes">
            {recovery.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          <button onClick={() => setRecovery([])}>
            I have saved my recovery codes
          </button>
        </section>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <p className="muted">
        Enrolling MFA does not grant staff access. A separately authorized role
        is required.
      </p>
    </section>
  );
}
