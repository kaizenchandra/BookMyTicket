import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api.ts";
type Fields = {
  legalName: string;
  businessAddress: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};
type Data = {
  organizationId: string;
  version: number;
  state: string;
  details: Fields;
};
const fields = [
  ["legalName", "Legal business name", 200],
  ["businessAddress", "Business address", 2000],
  ["contactName", "Contact person", 100],
  ["contactEmail", "Contact email", 254],
  ["contactPhone", "Contact phone with country code (optional)", 16],
] as const;
export function ProviderOnboarding({
  org,
  onSaved,
  review,
  state,
  onDirty,
}: {
  org: string;
  state?: string;
  onDirty?: (dirty: boolean) => void;
  onSaved: () => void;
  review?: (item: { id: string; version: number }, state: string) => void;
}) {
  const [data, setData] = useState<Data | null>(null),
    [draft, setDraft] = useState<Fields | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [conflict, setConflict] = useState(false);
  const [attempt, setAttempt] = useState<{
    org: string;
    input: Fields & { expectedVersion: number };
  } | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const clear = () => {
      generation.current++;
      setData(null);
      setDraft(null);
      setAttempt(null);
      setBusy(false);
      setError("");
      setMessage("");
      setConflict(false);
    };
    clear();
    window.addEventListener("bmt-session", clear);
    return () => {
      generation.current++;
      window.removeEventListener("bmt-session", clear);
    };
  }, [org, !!review]);
  const dirty =
    !!data && JSON.stringify(data.details) !== JSON.stringify(draft);
  useEffect(() => {
    onDirty?.(dirty || attempt !== null);
  }, [dirty, attempt, onDirty]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty || attempt) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, attempt]);
  async function load() {
    if (busy) return;
    const started = generation.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<Data>(
        review
          ? `/admin/providers/${org}/onboarding`
          : `/organizations/${org}/onboarding`,
      );
      if (started !== generation.current) return;
      setData(result);
      setDraft(result.details);
      setConflict(false);
    } catch (e) {
      if (started === generation.current) setError((e as Error).message);
    } finally {
      if (started === generation.current) setBusy(false);
    }
  }
  async function save(next: NonNullable<typeof attempt>) {
    if (busy) return;
    const started = generation.current;
    setAttempt(next);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await api<Data>(`/organizations/${next.org}/onboarding`, {
        method: "PUT",
        body: JSON.stringify(next.input),
      });
      if (started !== generation.current) return;
      const latest = await api<Data>(`/organizations/${next.org}/onboarding`);
      if (started !== generation.current) return;
      setData(latest);
      const { expectedVersion: _, ...original } = next.input;
      if (
        JSON.stringify(draft) === JSON.stringify(original) &&
        JSON.stringify(saved.details) === JSON.stringify(latest.details)
      )
        setDraft(latest.details);
      setAttempt(null);
      setConflict(false);
      setMessage(
        "Onboarding save recorded and current details refreshed. Different entered details remain unsaved; submit separately when complete.",
      );
      onSaved();
    } catch (e) {
      if (started === generation.current) {
        setError((e as Error).message);
        if (e instanceof ApiError && e.status === 409) setConflict(true);
      }
    } finally {
      if (started === generation.current) setBusy(false);
    }
  }
  const editable =
    !review &&
    data &&
    ["draft", "changes_requested"].includes(state ?? data.state);
  return (
    <section aria-label="Private onboarding details">
      <h3>Private business and contact information</h3>
      <p>
        Visible to organization owners and authorized reviewers. Contact details
        are supplied for onboarding and are not verified login identifiers or
        public venue contacts. Business name, address, contact person and email
        are required for submission; documents and payout verification are
        separate.
      </p>
      <button
        disabled={busy}
        onClick={() => {
          if (
            !dirty ||
            window.confirm(
              "Discard unsaved onboarding changes and load the saved information?",
            )
          )
            void load();
        }}
      >
        {data ? "Reload saved onboarding" : "Open private onboarding"}
      </button>
      {busy && <p role="status">Loading or saving onboarding…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {attempt && !busy && !review && (
        <section aria-label="Recover private onboarding save">
          <p>
            Retry the original details and version. This does not overwrite
            later saved changes or submit different entries currently in the
            form.
          </p>
          <button onClick={() => void save(attempt)}>
            Retry original private onboarding save
          </button>
          <button onClick={() => setAttempt(null)}>
            Dismiss onboarding recovery
          </button>
        </section>
      )}
      {data && draft && (
        <>
          {editable ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!attempt)
                  void save({
                    org,
                    input: { ...draft, expectedVersion: data.version },
                  });
              }}
            >
              {fields.map(([name, label, max]) => (
                <label key={name}>
                  {label}
                  {name === "businessAddress" ? (
                    <textarea
                      value={draft[name]}
                      maxLength={max}
                      onChange={(e) =>
                        setDraft({ ...draft, [name]: e.target.value })
                      }
                      disabled={busy || conflict}
                    />
                  ) : (
                    <input
                      value={draft[name]}
                      type={
                        name === "contactEmail"
                          ? "email"
                          : name === "contactPhone"
                            ? "tel"
                            : "text"
                      }
                      maxLength={max}
                      onChange={(e) =>
                        setDraft({ ...draft, [name]: e.target.value })
                      }
                      disabled={busy || conflict}
                    />
                  )}
                </label>
              ))}
              <p>
                Incomplete drafts can be saved. Reload after a version conflict;
                your entries are preserved until you choose to discard them.
              </p>
              <button disabled={busy || conflict || attempt !== null || !dirty}>
                Save private onboarding draft
              </button>
            </form>
          ) : (
            <dl>
              {fields.map(([name, label]) => (
                <div key={name}>
                  <dt>{label}</dt>
                  <dd style={{ whiteSpace: "pre-wrap" }}>
                    {data.details[name] || "Not supplied"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {review && data.state === "submitted" && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  review({ id: org, version: data.version }, "approved")
                }
              >
                Approve reviewed application
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  review(
                    { id: org, version: data.version },
                    "changes_requested",
                  )
                }
              >
                Request changes
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  review({ id: org, version: data.version }, "rejected")
                }
              >
                Reject reviewed application
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
