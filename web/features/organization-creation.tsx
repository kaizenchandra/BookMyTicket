import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
type Attempt = { key: string; input: { name: string; kind: string } };
export function OrganizationCreationForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState(""),
    [kind, setKind] = useState("cinema"),
    [attempt, setAttempt] = useState<Attempt | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    const clear = () => {
      generation.current++;
      setAttempt(null);
      setName("");
      setKind("cinema");
      setMessage("");
      setBusy(false);
    };
    window.addEventListener("bmt-session", clear);
    return () => {
      generation.current++;
      window.removeEventListener("bmt-session", clear);
    };
  }, []);
  async function save(next: Attempt) {
    if (busy) return;
    const started = generation.current;
    setAttempt(next);
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/organizations", {
        method: "POST",
        headers: { "idempotency-key": next.key },
        body: JSON.stringify(next.input),
      });
      if (generation.current !== started) return;
      setAttempt(null);
      setName("");
      setMessage(
        `Organization creation recorded: ${result.id}. Refreshing its current status.`,
      );
      onSaved();
    } catch (error) {
      if (generation.current === started) setMessage((error as Error).message);
    } finally {
      if (generation.current === started) setBusy(false);
    }
  }
  return (
    <section aria-label="Create organization">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (attempt) return;
          const trimmed = name.trim();
          if (trimmed.length < 2) {
            setMessage(
              "Enter an organization name with at least two non-space characters.",
            );
            return;
          }
          void save({
            key: crypto.randomUUID(),
            input: { name: trimmed, kind },
          });
        }}
      >
        <fieldset disabled={busy || attempt !== null}>
          <legend>New organization</legend>
          <label>
            Organization name
            <input
              minLength={2}
              maxLength={150}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Organization type
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="cinema">Cinema partner</option>
              <option value="event">Event organizer</option>
              <option value="sports">Sports organizer</option>
            </select>
          </label>
          <button className="primary">Save onboarding draft</button>
        </fieldset>
      </form>
      {busy && <p role="status">Saving organization…</p>}
      {message && <p role="status">{message}</p>}
      {attempt && !busy && (
        <section aria-label="Recover organization creation">
          <p>
            The original request may have succeeded. Retry the same organization
            details to recover its reference without creating another. Fields
            stay locked until this attempt is resolved or cleared.
          </p>
          <button onClick={() => void save(attempt)}>
            Retry original organization creation
          </button>
          <button
            onClick={() => {
              if (
                window.confirm(
                  "Have you checked your organizations for an existing draft? Clearing recovery and saving again may create another organization.",
                )
              )
                setAttempt(null);
            }}
          >
            Clear creation recovery
          </button>
        </section>
      )}
    </section>
  );
}
