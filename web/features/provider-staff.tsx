import { useEffect, useRef, useState } from "react";
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
  const [revocation, setRevocation] = useState<{
    url: string;
    body: unknown;
  } | null>(null);
  const [membershipAttempt, setMembershipAttempt] = useState<{
    url: string;
    body: unknown;
  } | null>(null);
  const generation = useRef(0);
  type Cursor = { afterCreatedAt: string; afterId: string };
  const [pages, setPages] = useState<(Cursor | null)[]>([null]);
  const [memberPages, setMemberPages] = useState<(string | null)[]>([null]);
  const [invitationState, setInvitationState] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const cursor = pages.at(-1);
  const params = new URLSearchParams(cursor ?? {});
  const memberCursor = memberPages.at(-1);
  if (org && memberCursor) params.set("afterMemberId", memberCursor);
  if (org && memberRole) params.set("memberRole", memberRole);
  if (org && invitationState) params.set("invitationState", invitationState);
  const query = params.size ? `?${params.toString()}` : "";
  const path = org
    ? `/organizations/${org}/staff${query}`
    : `/provider-invitations${query}`;
  useEffect(() => {
    generation.current++;
    setRevocation(null);
    setMembershipAttempt(null);
    setBusy(false);
    setPages([null]);
    setMemberPages([null]);
    setInvitationState("");
    setMemberRole("");
    setEmail("");
    setMessage("");
    return () => {
      generation.current++;
    };
  }, [org]);
  useEffect(() => {
    let current = true;
    const started = generation.current;
    setData(null);
    setError("");
    api(path)
      .then((r) => {
        if (current && started === generation.current) setData(r);
      })
      .catch((e) => {
        if (current && started === generation.current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [path, revision]);
  useEffect(() => {
    const clear = () => {
      generation.current++;
      setRevocation(null);
      setMembershipAttempt(null);
      setBusy(false);
      setError("");
      setData(null);
      setPages([null]);
      setMemberPages([null]);
      setInvitationState("");
      setMemberRole("");
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
    revoke = false,
    membership = false,
  ) {
    if (busy) return;
    const started = generation.current;
    if (revoke) setRevocation({ url, body });
    if (membership) setMembershipAttempt({ url, body });
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(url, {
        method,
        body: JSON.stringify(body),
        ...(invite ? { headers: { "idempotency-key": key } } : {}),
      });
      if (started !== generation.current) return;
      if (revoke) setRevocation(null);
      if (membership) setMembershipAttempt(null);
      setMessage(
        invite
          ? "Invitation saved. Recipient must sign in with this email and accept it in the partner portal. No invitation email was sent."
          : "Change saved.",
      );
      if (invite) {
        setEmail("");
        setPages([null]);
        setKey(crypto.randomUUID());
      }
      setRevision((r) => r + 1);
      onChanged();
    } catch (e) {
      if (started === generation.current) setError((e as Error).message);
    } finally {
      if (started === generation.current) setBusy(false);
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
      {membershipAttempt && !busy && (
        <section aria-label="Recover staff membership action">
          <p>
            Retry the original role change or access revocation. Later roles and
            replacement memberships are preserved; current staff will refresh
            after recovery.
          </p>
          <button
            onClick={() =>
              void run(
                membershipAttempt.url,
                membershipAttempt.body,
                "PUT",
                false,
                false,
                true,
              )
            }
          >
            Retry original membership action
          </button>
          <button onClick={() => setMembershipAttempt(null)}>
            Dismiss membership recovery
          </button>
        </section>
      )}
      {revocation && !busy && (
        <section aria-label="Recover invitation revocation">
          <p>
            The revocation may have succeeded. Retry the original request to
            recover its result; replacement invitations are unaffected.
          </p>
          <button
            onClick={() =>
              void run(revocation.url, revocation.body, "POST", false, true)
            }
          >
            Retry original invitation revocation
          </button>
          <button onClick={() => setRevocation(null)}>
            Dismiss revocation recovery
          </button>
        </section>
      )}
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
      {org && (
        <label>
          Member role
          <select
            value={memberRole}
            disabled={busy}
            onChange={(e) => {
              setMemberRole(e.target.value);
              setMemberPages([null]);
            }}
          >
            <option value="">All roles</option>
            <option value="owner">Owners</option>
            <option value="editor">Editors</option>
            <option value="viewer">Viewers</option>
          </select>
        </label>
      )}
      {org && (
        <nav aria-label="Member pages">
          <button
            disabled={busy || memberPages.length === 1}
            onClick={() => setMemberPages([null])}
          >
            First member page
          </button>
          <button
            disabled={busy || memberPages.length === 1}
            onClick={() => setMemberPages((p) => p.slice(0, -1))}
          >
            Previous member page
          </button>
          <span>Member page {memberPages.length}</span>
          <button
            disabled={busy || !data?.nextMemberCursor}
            onClick={() =>
              setMemberPages((p) => [...p, data.nextMemberCursor.afterMemberId])
            }
          >
            Next member page
          </button>
          <p>
            Members are ordered by account reference. Changes appear on refresh.
          </p>
        </nav>
      )}
      {org && data?.members.length === 0 && (
        <p>
          {memberRole
            ? "No members match this role on this page."
            : "No members on this page."}
        </p>
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
                      disabled={busy || membershipAttempt !== null}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Confirm ${r === "revoke" ? "revoking access" : "role change to " + r} for this account?`,
                          )
                        )
                          void run(
                            `/organizations/${org}/staff/${m.account_id}`,
                            { version: m.version, role: r },
                            "PUT",
                            false,
                            false,
                            true,
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
      {org && (
        <label>
          Invitation status
          <select
            value={invitationState}
            disabled={busy}
            onChange={(e) => {
              setInvitationState(e.target.value);
              setPages([null]);
            }}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
            <option value="accepted">Accepted</option>
            <option value="revoked">Revoked</option>
          </select>
        </label>
      )}
      {
        <nav aria-label="Invitation pages">
          <button
            disabled={busy || pages.length === 1}
            onClick={() => setPages([null])}
          >
            First page
          </button>
          <button
            disabled={busy || pages.length === 1}
            onClick={() => setPages((p) => p.slice(0, -1))}
          >
            Previous page
          </button>
          <span>Invitation page {pages.length}</span>
          <button
            disabled={busy || !data?.nextCursor}
            onClick={() => setPages((p) => [...p, data.nextCursor])}
          >
            Next page
          </button>
          <p>
            Newest invitations first. Invitation status is refreshed on each
            page load.
          </p>
        </nav>
      }
      {data && (org ? data.invitations : data.items).length === 0 && (
        <p>
          {org && invitationState
            ? "No invitations match this status on this page."
            : "No invitations."}
        </p>
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
                  disabled={busy || revocation !== null}
                  onClick={() =>
                    void run(
                      `/organizations/${org}/invitations/${i.id}/revoke`,
                      { version: i.version },
                      "POST",
                      false,
                      true,
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
