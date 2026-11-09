import {
  SupportAgentPicker,
  type SupportAgent,
} from "./support-agent-picker.tsx";
import { useRef, useState } from "react";
import { api } from "../api.ts";
export function SupportAssignment({
  detail,
  onSaved,
}: {
  detail: any;
  onSaved: (message: string) => void;
}) {
  const [selected, setSelected] = useState<SupportAgent | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const command = useRef({ fingerprint: "", key: "" });
  return (
    <details>
      <summary>Supervisor assignment</summary>
      <p>
        Requires platform support and support_assign permissions with recent
        MFA. Search for and select an active support agent. This replaces the
        current assignment and records your reason.
      </p>
      <p>Current agent: {detail.assigned_to ?? "Unassigned"}</p>
      <SupportAgentPicker
        disabled={busy || detail.state === "resolved"}
        onSelect={setSelected}
      />
      <p>
        Selected agent:{" "}
        {selected ? `${selected.contact} · ${selected.id}` : "None"}
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !selected) return;
          const data = new FormData(event.currentTarget);
          const input = {
            version: detail.version,
            assigneeId: String(data.get("assigneeId")).trim(),
            reason: String(data.get("reason")).trim(),
          };
          const fingerprint = JSON.stringify(input);
          if (command.current.fingerprint !== fingerprint)
            command.current = { fingerprint, key: crypto.randomUUID() };
          setBusy(true);
          setMessage("");
          try {
            const result = await api(
              `/operations/cases/${detail.id}/assignment`,
              {
                method: "POST",
                headers: { "idempotency-key": command.current.key },
                body: JSON.stringify(input),
              },
            );
            setMessage(
              result.replayed
                ? "Original assignment recovered. Refreshing current case."
                : "Assignment saved. Refreshing current case.",
            );
            onSaved(
              result.replayed
                ? "Original assignment recovered. Current case refreshed."
                : "Assignment saved. Current case refreshed.",
            );
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || detail.state === "resolved"}>
          <label>
            Support agent account UUID
            <input
              name="assigneeId"
              required
              value={selected?.id ?? ""}
              readOnly
            />
          </label>
          <label>
            Assignment reason
            <textarea name="reason" required minLength={5} maxLength={2000} />
          </label>
          <label>
            <input type="checkbox" required />I confirm replacing the current
            assignment.
          </label>
          <button className="primary" disabled={!selected}>
            Confirm assignment
          </button>
        </fieldset>
      </form>
      {detail.state === "resolved" && (
        <p>Reopen the case before assigning it.</p>
      )}
      <p role="status">{message}</p>
    </details>
  );
}
