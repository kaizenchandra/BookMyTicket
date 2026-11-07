import { useEffect, useState } from "react";
import { api } from "../api.ts";
import type {
  AssignedForm,
  Answers,
  FormDefinition,
} from "../../src/modules/events/contracts/index.ts";
export type RegistrationPreview = {
  form: AssignedForm | null;
  quantity: number;
};
export function AttendeeFields({
  preview,
  answers,
  onChange,
  disabled = false,
}: {
  preview: RegistrationPreview;
  answers: Answers[];
  onChange: (a: Answers[]) => void;
  disabled?: boolean;
}) {
  const form = preview.form;
  if (!form?.definition.fields.length) return null;
  return (
    <section>
      <h3>{form.definition.title}</h3>
      <p>{form.definition.instructions}</p>
      <p>Form version {form.version}. Information is saved with this order.</p>
      {Array.from({ length: preview.quantity }, (_, i) => (
        <fieldset key={i} disabled={disabled}>
          <legend>Attendee {i + 1}</legend>
          {form.definition.fields.map((f) => {
            const id = `attendee-${i}-${f.id}`,
              value = answers[i]?.[f.id];
            const change = (value: string | boolean) =>
              onChange(
                Array.from({ length: preview.quantity }, (_, j) =>
                  j === i
                    ? { ...answers[j], [f.id]: value }
                    : { ...answers[j] },
                ),
              );
            return (
              <div key={f.id}>
                <label htmlFor={id}>
                  {f.label}
                  {f.required ? " (required)" : ""}
                </label>
                <p id={`${id}-help`} className="muted">
                  {f.purpose}
                </p>
                {f.type === "choice" ? (
                  <select
                    id={id}
                    aria-describedby={`${id}-help`}
                    required={f.required}
                    value={String(value ?? "")}
                    onChange={(e) => change(e.target.value)}
                  >
                    <option value="">Select an option</option>
                    {f.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    aria-describedby={`${id}-help`}
                    type={
                      f.type === "checkbox"
                        ? "checkbox"
                        : f.type === "phone"
                          ? "tel"
                          : f.type
                    }
                    required={f.required}
                    maxLength={f.maxLength}
                    {...(f.type === "checkbox"
                      ? { checked: value === true }
                      : { value: String(value ?? "") })}
                    onChange={(e) =>
                      change(
                        f.type === "checkbox"
                          ? e.target.checked
                          : e.target.value,
                      )
                    }
                  />
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
    </section>
  );
}
const empty: FormDefinition = {
  title: "Attendee registration",
  instructions: "",
  fields: [],
};
export function RegistrationEditor({ occurrenceId }: { occurrenceId: string }) {
  const [previewAnswers, setPreviewAnswers] = useState<Answers[]>([]);
  const [definition, setDefinition] = useState<FormDefinition>(empty),
    [version, setVersion] = useState<number | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setVersion(null);
    api<{ current: AssignedForm | null }>(
      `/occurrences/${occurrenceId}/registration-form`,
    )
      .then((r) => {
        if (current) {
          setDefinition(r.current?.definition ?? empty);
          setVersion(r.current?.version ?? 0);
        }
      })
      .catch((e) => {
        if (current) setMessage(e.message);
      });
    return () => {
      current = false;
    };
  }, [occurrenceId, revision]);
  async function publish() {
    if (version === null) return;
    setBusy(true);
    try {
      const f = await api<AssignedForm>(
        `/occurrences/${occurrenceId}/registration-form`,
        {
          method: "PUT",
          body: JSON.stringify({ expectedVersion: version, definition }),
        },
      );
      setVersion(f.version);
      setMessage(
        `Published version ${f.version}. Accepted orders keep their original form.`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Attendee form</summary>
      <p>
        Changes apply to future order acceptance. Removing every field stops
        collecting details for new orders.
      </p>
      <fieldset disabled={busy || version === null}>
        <label>
          Form title
          <input
            value={definition.title}
            onChange={(e) =>
              setDefinition({ ...definition, title: e.target.value })
            }
          />
        </label>
        <label>
          Instructions
          <textarea
            value={definition.instructions}
            onChange={(e) =>
              setDefinition({ ...definition, instructions: e.target.value })
            }
          />
        </label>
        {definition.fields.map((f, i) => (
          <fieldset key={i}>
            <legend>Field {i + 1}</legend>
            {(["id", "label", "purpose"] as const).map((k) => (
              <label key={k}>
                {k}
                <input
                  value={f[k]}
                  onChange={(e) =>
                    setDefinition({
                      ...definition,
                      fields: definition.fields.map((x, j) =>
                        i === j ? { ...x, [k]: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
            ))}
            <label>
              Type
              <select
                value={f.type}
                onChange={(e) =>
                  setDefinition({
                    ...definition,
                    fields: definition.fields.map((x, j) =>
                      i === j
                        ? {
                            ...x,
                            type: e.target.value as typeof f.type,
                            options: [],
                          }
                        : x,
                    ),
                  })
                }
              >
                {["text", "email", "phone", "date", "choice", "checkbox"].map(
                  (t) => (
                    <option key={t}>{t}</option>
                  ),
                )}
              </select>
            </label>
            {f.type === "choice" && (
              <label>
                Choices (one per line)
                <textarea
                  value={f.options.join("\n")}
                  onChange={(e) =>
                    setDefinition({
                      ...definition,
                      fields: definition.fields.map((x, j) =>
                        i === j
                          ? { ...x, options: e.target.value.split("\n") }
                          : x,
                      ),
                    })
                  }
                />
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e) =>
                  setDefinition({
                    ...definition,
                    fields: definition.fields.map((x, j) =>
                      i === j ? { ...x, required: e.target.checked } : x,
                    ),
                  })
                }
              />
              Required
            </label>
            <button
              onClick={() =>
                setDefinition({
                  ...definition,
                  fields: definition.fields.filter((_, j) => i !== j),
                })
              }
            >
              Remove field {i + 1}
            </button>
          </fieldset>
        ))}
        <button
          disabled={definition.fields.length >= 20}
          onClick={() =>
            setDefinition({
              ...definition,
              fields: [
                ...definition.fields,
                {
                  id: `field_${definition.fields.length + 1}`,
                  label: "",
                  purpose: "",
                  type: "text",
                  required: true,
                  maxLength: 150,
                  options: [],
                },
              ],
            })
          }
        >
          Add field
        </button>
        <button onClick={publish}>Publish form version</button>
      </fieldset>
      <details>
        <summary>Preview attendee form</summary>
        <p>
          Preview only: these answers are not saved. This shows one attendee;
          checkout renders one form per admission.
        </p>
        <AttendeeFields
          preview={{
            form: { id: "preview", version: (version ?? 0) + 1, definition },
            quantity: 1,
          }}
          answers={previewAnswers}
          onChange={setPreviewAnswers}
        />
      </details>
      <button disabled={busy} onClick={() => setRevision((v) => v + 1)}>
        Reload saved form (discard edits)
      </button>
      {message && <p role="status">{message}</p>}
    </details>
  );
}

export function SavedRegistration({ orderId }: { orderId: string }) {
  const [saved, setSaved] = useState<{
      form: AssignedForm;
      answers: Answers[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    api<{ registration: typeof saved }>(`/bookings/${orderId}/registration`)
      .then((r) => {
        if (current) setSaved(r.registration);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [orderId]);
  if (error) return <p role="alert">Attendee details: {error}</p>;
  if (!saved) return null;
  return (
    <details>
      <summary>
        Accepted attendee details · version {saved.form.version}
      </summary>
      {saved.answers.map((a, i) => (
        <section key={i}>
          <h3>Attendee {i + 1}</h3>
          <dl>
            {saved.form.definition.fields.map((f) => (
              <div key={f.id}>
                <dt>{f.label}</dt>
                <dd>
                  {typeof a[f.id] === "boolean"
                    ? a[f.id]
                      ? "Yes"
                      : "No"
                    : a[f.id] || "Not supplied"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </details>
  );
}
