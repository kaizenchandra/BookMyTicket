import { useEffect, useState } from "react";
import { api } from "../api.ts";
export function ProviderStaff({
  org,
  onChanged,
}: {
  org?: string;
  onChanged: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("viewer"),
    [key, setKey] = useState(() => crypto.randomUUID());
  const path = org ? `/organizations/${org}/staff` : "/provider-invitations";
  useEffect(() => {
    let current = true;
    setData(null);
    setError("");
    api(path)
      .then((r) => {
        if (current) setData(r);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [path, revision]);
  useEffect(() => {
    const clear = () => {
      setData(null);
      setEmail("");
      setMessage("");
      setRevision((r) => r + 1);
    };
    window.addEventListener("bmt-session", clear);
    return () => window.removeEventListener("bmt-session", clear);
  }, []);
  async function run(
    url: string,
    body: unknown,
    method = "POST",
    invite = false,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(url, {
        method,
        body: JSON.stringify(body),
        ...(invite ? { headers: { "idempotency-key": key } } : {}),
      });
      setMessage(
        invite
          ? "Invitation saved. Recipient must sign in with this email and accept it in the partner portal. No invitation email was sent."
          : "Change saved.",
      );
      if (invite) {
        setEmail("");
        setKey(crypto.randomUUID());
      }
      setRevision((r) => r + 1);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>
        {org
          ? "Manage staff and invitations"
          : "Invitations for your verified email"}
      </summary>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!data && !error && <p role="status">Loading…</p>}
      {org && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              `/organizations/${org}/invitations`,
              { email, role },
              "POST",
              true,
            );
          }}
        >
          <p>
            Fresh authenticator verification is required to manage staff.
            Invitations expire after seven days. Editors can change catalog and
            venue data; viewers have read-only organization access. Ownership
            and attendee exports are not granted.
          </p>
          <p>
            <a href="/profile">Verify authenticator in account security</a>
          </p>
          <label>
            Staff email
            <input
              type="email"
              required
              maxLength={254}
              value={email}
              disabled={busy}
              onChange={(e) => {
                setEmail(e.target.value);
                setKey(crypto.randomUUID());
              }}
            />
          </label>
          <label>
            Role
            <select
              value={role}
              disabled={busy}
              onChange={(e) => {
                setRole(e.target.value);
                setKey(crypto.randomUUID());
              }}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
          </label>
          <button disabled={busy}>Create invitation</button>
        </form>
      )}
      {org &&
        data?.members.map((m: any) => (
          <article className="organization" key={m.account_id}>
            <p>Account: {m.account_id}</p>
            <p>Role: {m.role}</p>
            {m.role !== "owner" && (
              <>
                {["viewer", "editor", "revoke"]
                  .filter((r) => r !== m.role)
                  .map((r) => (
                    <button
                      key={r}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Confirm ${r === "revoke" ? "revoking access" : "role change to " + r} for this account?`,
                          )
                        )
                          void run(
                            `/organizations/${org}/staff/${m.account_id}`,
                            { version: Number(m.version), role: r },
                            "PUT",
                          );
                      }}
                    >
                      {r === "revoke" ? "Revoke access" : `Make ${r}`}
                    </button>
                  ))}
              </>
            )}
          </article>
        ))}
      {data && (org ? data.invitations : data.items).length === 0 && (
        <p>No invitations.</p>
      )}
      {data &&
        (org ? data.invitations : data.items).map((i: any) => (
          <article className="organization" key={i.id}>
            <p>
              {org ? i.email : i.organization_name} · {i.role} ·{" "}
              {i.state ?? "pending"}
            </p>
            <p>Expires {new Date(i.expires_at).toLocaleString("en-IN")}</p>
            {org ? (
              i.state === "pending" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(
                      `/organizations/${org}/invitations/${i.id}/revoke`,
                      { version: i.version },
                    )
                  }
                >
                  Revoke invitation
                </button>
              )
            ) : (
              <button
                disabled={busy}
                onClick={() =>
                  void run(`/provider-invitations/${i.id}/accept`, {})
                }
              >
                Accept invitation
              </button>
            )}
          </article>
        ))}
    </details>
  );
}
