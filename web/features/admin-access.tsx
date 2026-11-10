import { adminPageLink, permissionSources } from "./admin-access-links.ts";
import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
import { AdminNavigation } from "./admin-workspace.tsx";
const permissions = [
  ["access.manage", "Manage administrators and roles"],
  ["cabs.read", "Read cab catalogue and fare estimates"],
  ["cabs.manage", "Manage cab services (also requires cabs.read)"],
  ["packages.read", "Read holiday packages"],
  ["packages.manage", "Edit packages and allotments (also requires packages.read)"],
  ["packages.review", "Review/publish packages (also requires packages.read)"],
  ["trains.read", "Read train catalogue"],
  ["trains.manage", "Manage train catalogue (also requires trains.read)"],
  ["buses.read", "Read bus catalogue"],
  ["buses.manage", "Manage bus catalogue (also requires buses.read)"],
  ["hotels.read", "Read hotel properties"],
  ["hotels.manage", "Edit properties (also requires hotels.read)"],
  ["hotels.review", "Review/publish properties (also requires hotels.read)"],
  ["flights.read", "Read flight supplier profiles"],
  ["flights.manage", "Manage flight suppliers (also requires flights.read)"],
  ["customers.read", "Read customer directory"],
  ["bookings.manage", "Manage booking exceptions, pending cancellation and ticket documents (also requires bookings.read)"],
  ["bookings.read", "Read bookings and payment history"],
  ["finance", "Read financial reports and payment records"],
  ["support", "Handle support cases"],
  ["support_assign", "Assign support cases (also requires support)"],
  ["moderate", "Review partners, listings and help content"],
  ["pricing", "Manage commercial policies"],
  ["audit", "Read platform audit history"],
] as const;
type Role = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  version: number;
  permissions: string[];
  members?: string;
};
type User = {
  id: string;
  name: string;
  contact: string;
  status: string;
  version: number;
  roles: string[];
  permissions: string[];
  directPermissions: string[];
};
function useLoad<T>(path: string, revision = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    api<T>(path, { signal: c.signal })
      .then((x) => {
        if (!c.signal.aborted) setData(x);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [path, revision]);
  return { data, error };
}
function PermissionFields({ selected }: { selected: string[] }) {
  return (
    <fieldset>
      <legend>Direct module/action permissions</legend>
      {permissions.map(([p, label]) => (
        <label className="admin-permission" key={p}>
          <input
            type="checkbox"
            name="permissions"
            value={p}
            defaultChecked={selected.includes(p)}
          />
          {label} <small>({p})</small>
        </label>
      ))}
    </fieldset>
  );
}
function RolePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [q, setQ] = useState(""),
    [after, setAfter] = useState(""),
    [labels, setLabels] = useState<Record<string, string>>({});
  const { data, error } = useLoad<{ items: Role[]; nextCursor: string | null }>(
    `/admin/roles?active=true&q=${encodeURIComponent(q)}${after ? `&after=${encodeURIComponent(after)}` : ""}`,
  );
  useEffect(() => {
    let active = true;
    Promise.all(
      value.map((id) =>
        api<Role>(`/admin/roles/${id}`).then((r) => [id, r.name] as const),
      ),
    )
      .then((rows) => {
        if (active) setLabels(Object.fromEntries(rows));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value.join(",")]);
  return (
    <fieldset>
      <legend>Assigned roles</legend>
      <p>Role permissions combine with direct grants. At most 20 roles.</p>
      <label>
        Find role
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAfter("");
          }}
        />
      </label>
      {value.length > 0 && (
        <ul>
          {value.map((id) => (
            <li key={id}>
              {labels[id] ?? id}{" "}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== id))}
              >
                Remove role
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert">{error}</p>
      ) : data ? (
        <>
          {data.items.map((r) => (
            <label className="admin-permission" key={r.id}>
              <input
                type="checkbox"
                checked={value.includes(r.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, r.id]
                      : value.filter((x) => x !== r.id),
                  )
                }
              />
              {r.name}
            </label>
          ))}
          {!data.items.length && <p>No active roles match.</p>}
          <button type="button" onClick={() => setAfter("")}>
            First role page
          </button>
          {data.nextCursor && (
            <button type="button" onClick={() => setAfter(data.nextCursor!)}>
              More roles
            </button>
          )}
        </>
      ) : (
        <p>Loading roles…</p>
      )}
    </fieldset>
  );
}
function UserEditor({ user, done }: { user: User | null; done: () => void }) {
  const [roles, setRoles] = useState(user?.roles ?? []),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    request = useRef({ body: "", key: "" });
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      !confirm(
        user
          ? "Apply account/role changes and revoke all sessions for this administrator?"
          : "Create this administrator with the selected access? They must verify their email and complete MFA.",
      )
    )
      return;
    const payload = {
        name: f.get("name"),
        roles,
        permissions: f.getAll("permissions"),
        reason: f.get("reason"),
        ...(user
          ? { expectedVersion: user.version, status: f.get("status") }
          : { contact: f.get("contact") }),
      },
      body = JSON.stringify(payload);
    if (request.current.body !== body)
      request.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      await api(user ? `/admin/users/${user.id}` : "/admin/users", {
        method: user ? "PATCH" : "POST",
        headers: { "idempotency-key": request.current.key },
        body,
      });
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="dashboard-panel">
      <h2>{user ? "Edit administrator" : "Create administrator"}</h2>
      <p>
        No invitation is sent. New administrators sign in through email
        verification and must enroll/verify MFA before protected actions.
      </p>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <label>
            Admin display name
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={user?.name ?? ""}
            />
          </label>
          {user ? (
            <>
              <p>
                {user.contact} · {user.id}
              </p>
              <label>
                Account status
                <select name="status" defaultValue={user.status}>
                  <option>active</option>
                  <option>suspended</option>
                </select>
              </label>
              <p>
                Effective permissions: {user.permissions.join(", ") || "none"}
              </p>
            </>
          ) : (
            <label>
              Email
              <input type="email" name="contact" required maxLength={254} />
            </label>
          )}
          <RolePicker value={roles} onChange={setRoles} />
          <PermissionFields selected={user?.directPermissions ?? []} />
          <label>
            Reason
            <textarea name="reason" required minLength={10} maxLength={1000} />
          </label>
          <button>{busy ? "Saving…" : "Save administrator"}</button>
          <button type="button" onClick={done}>
            Cancel
          </button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function AdminUsers() {
  const params = new URLSearchParams(location.search),
    [revision, setRevision] = useState(0),
    [edit, setEdit] = useState<User | null | undefined>(undefined),
    { data, error } = useLoad<{ items: User[]; nextCursor: string | null }>(
      `/admin/users${location.search}`,
      revision,
    );
  const next = new URLSearchParams(params);
  if (data?.nextCursor) next.set("after", data.nextCursor);
  return (
    <main className="admin-dashboard">
      <AdminNavigation />
      <h1>Administrators & access</h1>
      <p>
        Direct grants and active role permissions combine. Suspension blocks
        access; changes revoke sessions. Another access administrator must
        change your own access.
      </p>
      <button onClick={() => setEdit(null)}>Create administrator</button>{" "}
      <a href="/admin/roles">Manage roles</a>
      <form className="dashboard-controls" method="get">
        {[
          ["q", "Admin name"],
          ["contact", "Exact registered email"],
          ["id", "Account reference"],
          ["role", "Role reference"],
        ].map(([name, label]) => (
          <label key={name}>
            {label}
            <input name={name} defaultValue={params.get(name) ?? ""} />
          </label>
        ))}
        <label>
          Status
          <select name="status" defaultValue={params.get("status") ?? ""}>
            <option value="">All</option>
            <option>active</option>
            <option>suspended</option>
          </select>
        </label>
        <label>
          Effective permission
          <select
            name="permission"
            defaultValue={params.get("permission") ?? ""}
          >
            <option value="">Any</option>
            {permissions.map(([p, label]) => (
              <option key={p} value={p}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={params.get("sort") ?? "newest"}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <button>Search</button>
        <a href="/admin/users">Clear</a>
      </form>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Loading administrators…</p>
      ) : (
        <>
          <div className="dashboard-table dashboard-panel">
            <table>
              <thead>
                <tr>
                  <th>Name / reference</th>
                  <th>Masked contact</th>
                  <th>Status</th>
                  <th>Effective access</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.name || "Unnamed administrator"}
                      <br />
                      {u.id}
                    </td>
                    <td>{u.contact}</td>
                    <td>{u.status}</td>
                    <td>
                      {u.permissions.join(", ") || "No effective permissions"}
                      <br />
                      {u.roles.length} assigned roles
                    </td>
                    <td>
                      <a href={`/admin/users/${u.id}`}>View administrator</a>
                      <button onClick={() => setEdit(u)}>
                        Edit access/status
                      </button>
                      <a href={`/admin/users/${u.id}/activity`}>
                        Activity & privilege history
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && (
              <p>
                No administrators match. Find an existing customer by exact
                email/reference to explicitly appoint them.
              </p>
            )}
          </div>
          <a href={adminPageLink("/admin/users", location.search)}>
            First page
          </a>
          {data.nextCursor && (
            <>
              {" "}
              · <a href={`?${next}`}>Next page</a>
            </>
          )}
        </>
      )}
      {edit !== undefined && (
        <UserEditor
          key={edit?.id ?? "new"}
          user={edit}
          done={() => {
            setEdit(undefined);
            setRevision((x) => x + 1);
          }}
        />
      )}
    </main>
  );
}
function RoleEditor({ role, done }: { role: Role | null; done: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    request = useRef({ body: "", key: "" });
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      !confirm(
        role
          ? "Update this role for all assigned administrators and revoke their sessions?"
          : "Create this role definition? No accounts are assigned automatically.",
      )
    )
      return;
    const body = JSON.stringify({
      name: f.get("name"),
      description: f.get("description"),
      permissions: f.getAll("permissions"),
      reason: f.get("reason"),
      ...(role
        ? { expectedVersion: role.version, active: f.get("active") === "true" }
        : {}),
    });
    if (request.current.body !== body)
      request.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      await api(role ? `/admin/roles/${role.id}` : "/admin/roles", {
        method: role ? "PATCH" : "POST",
        headers: { "idempotency-key": request.current.key },
        body,
      });
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="dashboard-panel">
      <h2>{role ? "Edit role" : "Create role"}</h2>
      <p>
        Deactivation removes role-derived access but preserves direct grants.
        Reactivation restores role-derived access to retained assignments. A
        role assigned to you must be edited by another administrator.
      </p>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <label>
            Name
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              defaultValue={role?.name ?? ""}
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              maxLength={500}
              defaultValue={role?.description ?? ""}
            />
          </label>
          {role && (
            <label>
              Role status
              <select name="active" defaultValue={String(role.active)}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
          )}
          <PermissionFields selected={role?.permissions ?? []} />
          <label>
            Reason
            <textarea name="reason" required minLength={10} maxLength={1000} />
          </label>
          <button>{busy ? "Saving…" : "Save role"}</button>
          <button type="button" onClick={done}>
            Cancel
          </button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function AdminRoleList() {
  const params = new URLSearchParams(location.search),
    [revision, setRevision] = useState(0),
    [edit, setEdit] = useState<Role | null | undefined>(),
    { data, error } = useLoad<{ items: Role[]; nextCursor: string | null }>(
      `/admin/roles${location.search}`,
      revision,
    ),
    next = new URLSearchParams(params);
  if (data?.nextCursor) next.set("after", data.nextCursor);
  return (
    <main className="admin-dashboard">
      <AdminNavigation />
      <h1>Roles & permissions</h1>
      <button onClick={() => setEdit(null)}>Create role</button>
      <form className="dashboard-controls" method="get">
        <label>
          Role name
          <input name="q" defaultValue={params.get("q") ?? ""} />
        </label>
        <label>
          Status
          <select name="active" defaultValue={params.get("active") ?? ""}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={params.get("sort") ?? "newest"}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <button>Search</button>
        <a href="/admin/roles">Clear</a>
      </form>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Loading roles…</p>
      ) : (
        <>
          <div className="dashboard-table dashboard-panel">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Permissions</th>
                  <th>Assignments</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.name}
                      <p>{r.description}</p>
                    </td>
                    <td>{r.active ? "Active" : "Inactive"}</td>
                    <td>{r.permissions.join(", ") || "None"}</td>
                    <td>
                      <a href={`/admin/users?role=${r.id}`}>{r.members}</a>
                    </td>
                    <td>
                      <button onClick={() => setEdit(r)}>Edit</button>
                      <a href={`/admin/users/${r.id}/activity`}>
                        Privilege history
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && <p>No roles match.</p>}
          </div>
          <a href={adminPageLink("/admin/roles", location.search)}>
            First page
          </a>
          {data.nextCursor && (
            <>
              {" "}
              · <a href={`?${next}`}>Next page</a>
            </>
          )}
        </>
      )}
      {edit !== undefined && (
        <RoleEditor
          key={edit?.id ?? "new"}
          role={edit}
          done={() => {
            setEdit(undefined);
            setRevision((x) => x + 1);
          }}
        />
      )}
    </main>
  );
}
export function AdminAccessActivity({ id }: { id: string }) {
  const params = new URLSearchParams(location.search),
    { data, error } = useLoad<{
      items: {
        id: string;
        actor_id: string;
        action: string;
        target: string;
        created_at: string;
        change: Record<string, unknown>;
      }[];
      nextCursor: string | null;
    }>(`/admin/users/${id}/activity${location.search}`),
    next = new URLSearchParams(params);
  if (data?.nextCursor) next.set("after", data.nextCursor);
  return (
    <main className="admin-dashboard">
      <AdminNavigation />
      <h1>Activity & privilege history</h1>
      <p>
        Account or role: {id}. Includes actions performed, direct changes and
        role changes affecting the account.
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p>Loading history…</p>
      ) : (
        <>
          {data.items.map((r) => (
            <article className="dashboard-panel" key={r.id}>
              <h2>{r.action}</h2>
              <p>
                {new Date(r.created_at).toLocaleString("en-IN")} · Actor{" "}
                {r.actor_id} · Target {r.target}
              </p>
              {Object.keys(r.change).length > 0 && (
                <details>
                  <summary>Reason and before/after privileges</summary>
                  <pre
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {JSON.stringify(r.change, null, 2)}
                  </pre>
                </details>
              )}
            </article>
          ))}
          {!data.items.length && <p>No recorded activity.</p>}
          <a href={`/admin/users/${id}/activity`}>First page</a>
          {data.nextCursor && (
            <>
              {" "}
              · <a href={`?${next}`}>Next page</a>
            </>
          )}
        </>
      )}
    </main>
  );
}
export function AdminUserDetail({ id }: { id: string }) {
  const [revision, setRevision] = useState(0),
    [editing, setEditing] = useState(false),
    { data, error } = useLoad<
      User & { created_at: string; roleDefinitions: Role[] }
    >(`/admin/users/${encodeURIComponent(id)}`, revision);
  return (
    <main className="admin-dashboard">
      <AdminNavigation />
      <h1>Administrator details</h1>
      <a href="/admin/users">Administrator directory</a> ·{" "}
      <a href={`/admin/users/${id}/activity`}>Activity & privilege history</a>
      <button
        onClick={() => {
          setEditing(false);
          setRevision((n) => n + 1);
        }}
      >
        Reload
      </button>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Loading administrator…</p>
      ) : (
        <>
          <section className="dashboard-panel">
            <h2>{data.name || "Unnamed administrator"}</h2>
            <p>
              {data.contact} · {data.id}
            </p>
            <p>
              Status: <strong>{data.status}</strong> · Registered{" "}
              {new Date(data.created_at).toLocaleString("en-IN")}
            </p>
            {data.status === "suspended" && (
              <p>
                Suspended accounts cannot authenticate, even when grants are
                assigned.
              </p>
            )}
            <button onClick={() => setEditing(true)}>
              Edit account and access
            </button>
          </section>
          <section className="dashboard-panel">
            <h2>Assigned roles</h2>
            {data.roleDefinitions.length ? (
              <ul>
                {data.roleDefinitions.map((r) => (
                  <li key={r.id}>
                    {r.name} —{" "}
                    {r.active ? "Active" : "Inactive; contributes no access"}
                    <p>{r.description}</p>
                    <a href={`/admin/users/${r.id}/activity`}>
                      Role privilege history
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No roles assigned.</p>
            )}
          </section>
          <section className="dashboard-panel">
            <h2>Effective platform permissions</h2>
            <p>
              Active role permissions combine with independent direct grants.
              Scoped gate/tenant grants are managed separately and are
              preserved.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Permission</th>
                  <th>Granted through</th>
                </tr>
              </thead>
              <tbody>
                {data.permissions.map((p) => (
                  <tr key={p}>
                    <th>{p}</th>
                    <td>
                      {permissionSources(
                        p,
                        data.directPermissions,
                        data.roleDefinitions,
                      ).join("; ") || "Existing platform grant"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.permissions.length && (
              <p>No effective platform permissions.</p>
            )}
          </section>
          {editing && (
            <UserEditor
              key={`${data.id}:${data.version}`}
              user={data}
              done={() => {
                setEditing(false);
                setRevision((n) => n + 1);
              }}
            />
          )}
        </>
      )}
    </main>
  );
}
