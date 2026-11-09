import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
import type { HelpCreation } from "../../src/modules/catalog/application/help.ts";
import { helpDestinations } from "../../src/modules/catalog/domain/help.ts";
import { HelpResults } from "./help.tsx";
export function HelpCreationForm({ done }: { done: () => void }) {
  const [id, setId] = useState(""),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState(""),
    [topic, setTopic] = useState<HelpCreation["topic"]>("booking"),
    [destination, setDestination] =
      useState<HelpCreation["destination"]>("bookings"),
    [reason, setReason] = useState(""),
    [attempt, setAttempt] = useState<HelpCreation | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function save(input: HelpCreation) {
    setAttempt(input);
    setBusy(true);
    setError("");
    try {
      await api("/admin/help", { method: "POST", body: JSON.stringify(input) });
      if (active.current) done();
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return (
    <section aria-label="Create help draft">
      <h2>New help article</h2>
      <p>
        New answers start unpublished. Review and publish them from the article
        editor.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (attempt) return;
          if (!question.trim() || !answer.trim() || !reason.trim()) {
            setError(
              "Enter a question, answer and reason with non-space text.",
            );
            return;
          }
          void save({
            id,
            question: question.trim(),
            answer: answer.trim(),
            topic,
            destination,
            reason: reason.trim(),
          });
        }}
      >
        <fieldset disabled={busy || attempt !== null}>
          <legend>Draft content</legend>
          <label>
            Unique article ID
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={100}
              value={id}
              onChange={(e) => setId(e.target.value)}
            />
          </label>
          <p>
            Use lowercase letters, numbers and single hyphens. The ID cannot be
            changed later.
          </p>
          <label>
            Question
            <input
              required
              maxLength={200}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <label>
            Answer
            <textarea
              required
              maxLength={4000}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </label>
          <label>
            Topic
            <select
              value={topic}
              onChange={(e) =>
                setTopic(e.target.value as HelpCreation["topic"])
              }
            >
              <option value="booking">Booking</option>
              <option value="payment">Payment</option>
              <option value="account">Account</option>
              <option value="accessibility">Accessibility</option>
            </select>
          </label>
          <label>
            Action destination
            <select
              value={destination}
              onChange={(e) =>
                setDestination(e.target.value as HelpCreation["destination"])
              }
            >
              {Object.entries(helpDestinations).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.action}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reason
            <textarea
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button>Create unpublished draft</button>
        </fieldset>
      </form>
      <h3>Draft preview</h3>
      <HelpResults
        items={[
          {
            id: id || "preview",
            version: 1,
            question,
            answer,
            topic,
            ...helpDestinations[destination],
          },
        ]}
      />
      {error && <p role="alert">{error}</p>}
      {attempt && (
        <>
          <p>
            The original creation request is retained. Retry it to recover an
            uncertain result; changing the ID creates a separate article.
          </p>
          <button disabled={busy} onClick={() => void save(attempt)}>
            Retry original creation
          </button>
        </>
      )}
      <button disabled={busy} onClick={done}>
        Discard draft and load articles
      </button>
    </section>
  );
}
