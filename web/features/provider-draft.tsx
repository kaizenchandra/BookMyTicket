import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
export function ProviderDraft({
  organization: current,
  onSaved,
  blockedByOtherDraft = false,
}: {
  organization: {
    id: string;
    name: string;
    kind: string;
    state: string;
    role: string;
    version: number;
    reason: string | null;
  };
  onSaved: () => void;
  blockedByOtherDraft?: boolean;
}) {
  const [o, setOrganization] = useState(current);
  const [name, setName] = useState(current.name),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [submission, setSubmission] = useState<{
    id: string;
    version: number;
  } | null>(null);
  const [editAttempt, setEditAttempt] = useState<{
    id: string;
    name: string;
    expectedVersion: number;
  } | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const clear = () => {
      generation.current++;
      setSubmission(null);
      setEditAttempt(null);
      setBusy(false);
      setError("");
      setMessage("");
    };
    window.addEventListener("bmt-session", clear);
    return () => {
      generation.current++;
      window.removeEventListener("bmt-session", clear);
    };
  }, []);
  const dirty = name !== o.name;
  useEffect(() => {
    if (!dirty && current.version >= o.version) {
      setOrganization(current);
      setName(current.name);
    }
  }, [current, dirty, o.version]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const editable =
    current.role === "owner" &&
    ["draft", "changes_requested"].includes(o.state);
  async function saveDraft(attempt: {
    id: string;
    name: string;
    expectedVersion: number;
  }) {
    if (busy) return;
    const started = generation.current;
    setEditAttempt(attempt);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/organizations/${attempt.id}/draft`, {
        method: "PUT",
        body: JSON.stringify({
          name: attempt.name,
          expectedVersion: attempt.expectedVersion,
        }),
      });
      if (started !== generation.current) return;
      const refreshed = await api<{ items: (typeof current)[] }>(
        "/organizations",
      );
      if (started !== generation.current) return;
      const latest = refreshed.items.find((item) => item.id === attempt.id);
      if (!latest)
        throw new Error(
          "Draft save recorded, but current organization access is unavailable.",
        );
      setOrganization(latest);
      if (name === attempt.name && latest.name === attempt.name.trim())
        setName(latest.name);
      setEditAttempt(null);
      setMessage(
        "Draft save recorded and current organization refreshed. Any different entered name is preserved as unsaved text.",
      );
      onSaved();
    } catch (e) {
      if (started === generation.current) setError((e as Error).message);
    } finally {
      if (started === generation.current) setBusy(false);
    }
  }
  async function submit(attempt = { id: o.id, version: o.version }) {
    if (busy) return;
    const started = generation.current;
    setSubmission(attempt);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/organizations/${attempt.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ version: attempt.version }),
      });
      if (started !== generation.current) return;
      setSubmission(null);
      setMessage(
        "Submission recorded. Refreshing current review status; it may have changed since submission.",
      );
      onSaved();
    } catch (e) {
      if (started === generation.current) setError((e as Error).message);
    } finally {
      if (started === generation.current) setBusy(false);
    }
  }
  return (
    <div>
      {o.reason && (
        <div>
          <h3>Latest review feedback</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{o.reason}</p>
        </div>
      )}
      {o.state === "changes_requested" && (
        <p>
          Review the requested corrections before resubmitting. Update the
          organization name and private onboarding form as needed. Documents and
          payout verification remain separate workflows.
        </p>
      )}
      {editable && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editAttempt)
              void saveDraft({ id: o.id, name, expectedVersion: o.version });
          }}
        >
          <label>
            Organization name
            <input
              required
              minLength={2}
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </label>
          <p>
            Organization type: {o.kind}. Saving a draft does not submit it for
            review.
          </p>
          <button disabled={busy || editAttempt !== null || !dirty}>
            Save draft changes
          </button>
          <button
            type="button"
            disabled={
              busy ||
              submission !== null ||
              editAttempt !== null ||
              dirty ||
              blockedByOtherDraft
            }
            onClick={() => void submit()}
          >
            {o.state === "changes_requested"
              ? "Resubmit for review"
              : "Submit for review"}
          </button>
          {(dirty || blockedByOtherDraft) && (
            <p>
              Save organization and private onboarding changes before
              submitting.
            </p>
          )}
        </form>
      )}
      {editAttempt && !busy && (
        <section aria-label="Recover provider draft save">
          <p>
            Retry the original name and version without overwriting later saved
            changes. Current unsaved text is preserved.
          </p>
          <button onClick={() => void saveDraft(editAttempt)}>
            Retry original organization draft save
          </button>
          <button onClick={() => setEditAttempt(null)}>
            Dismiss draft recovery
          </button>
        </section>
      )}
      {dirty && !busy && (
        <button
          onClick={() => {
            if (
              window.confirm(
                "Discard entered organization name and use the latest loaded name and version?",
              )
            ) {
              setOrganization(current);
              setName(current.name);
              onSaved();
            }
          }}
        >
          Reload saved organization
        </button>
      )}
      {submission && !busy && (
        <section aria-label="Recover provider submission">
          <p>
            Retry the original submission to recover its result without changing
            later review decisions. Current unsaved edits are not submitted by
            this retry.
          </p>
          <button onClick={() => void submit(submission)}>
            Retry original provider submission
          </button>
          <button onClick={() => setSubmission(null)}>
            Dismiss submission recovery
          </button>
        </section>
      )}
      {error && (
        <>
          <p role="alert">{error}</p>
          <p>
            Your draft is preserved. Copy any changes before reloading the
            latest organization.
          </p>
          <button
            disabled={busy}
            onClick={() => {
              setOrganization(current);
              setName(current.name);
              setError("");
              onSaved();
            }}
          >
            Discard draft and reload organization
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
