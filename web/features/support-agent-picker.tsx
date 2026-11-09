import { useEffect, useState } from "react";
import { api } from "../api.ts";
export type SupportAgent = { id: string; contact: string };
export function SupportAgentPicker({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (agent: SupportAgent) => void;
}) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState({ q: "", after: "", revision: 0 });
  const [items, setItems] = useState<SupportAgent[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setItems([]);
    setNext(null);
    setError("");
    if (!search.q) return;
    setLoading(true);
    const query = new URLSearchParams({ q: search.q });
    if (search.after) query.set("after", search.after);
    api(`/operations/support-agents?${query}`)
      .then((result) => {
        if (active) {
          setItems(result.items);
          setNext(result.nextCursor);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search]);
  return (
    <section aria-label="Find support agent">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSearch({
            q: draft.trim(),
            after: "",
            revision: search.revision + 1,
          });
        }}
      >
        <label>
          Agent contact or exact account UUID
          <input
            required
            minLength={3}
            maxLength={254}
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <button disabled={disabled || draft.trim().length < 3}>
          Search agents
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Searching agents…</p>
      ) : !error && search.q && !items.length ? (
        <p role="status">No matching active support agents.</p>
      ) : null}
      <ul>
        {items.map((agent) => (
          <li key={agent.id}>
            <span>
              {agent.contact} · {agent.id}
            </span>{" "}
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => onSelect(agent)}
            >
              Select {agent.contact}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={disabled || loading || !search.after}
        onClick={() => setSearch({ ...search, after: "" })}
      >
        First results
      </button>{" "}
      <button
        type="button"
        disabled={disabled || loading || !next}
        onClick={() => {
          if (next) setSearch({ ...search, after: next });
        }}
      >
        More agents
      </button>
    </section>
  );
}
