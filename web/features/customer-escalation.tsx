import { useRef, useState } from "react";
import { api } from "../api.ts";
export function CustomerEscalation({
  item,
  onSaved,
}: {
  item: any;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const command = useRef({ input: "", key: "" });
  if (item.state === "escalated")
    return (
      <p role="status">
        Escalation requested. Your case is in the support team's escalated
        queue.
      </p>
    );
  if (item.state === "resolved")
    return (
      <p>
        If the issue remains unresolved, reply below to reopen the case before
        requesting escalation.
      </p>
    );
  return (
    <details>
      <summary>Request escalation for an unresolved issue</summary>
      <p>
        This sends your case to the unassigned escalated support queue. It does
        not guarantee a response time or change any booking or refund.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage("");
          const input = JSON.stringify({
            version: item.version,
            reason: reason.trim(),
          });
          if (command.current.input !== input)
            command.current = { input, key: crypto.randomUUID() };
          try {
            await api(`/cases/${item.id}/escalation`, {
              method: "POST",
              headers: { "idempotency-key": command.current.key },
              body: input,
            });
            setReason("");
            onSaved();
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Why does this issue need further review?
          <textarea
            required
            minLength={10}
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy}
          />
        </label>
        <p>
          Do not include OTPs, card details or payment secrets. Your reason will
          appear in the case conversation.
        </p>
        <button disabled={busy || reason.trim().length < 10}>
          Request escalation
        </button>
      </form>
      <p role="status">{message}</p>
    </details>
  );
}
