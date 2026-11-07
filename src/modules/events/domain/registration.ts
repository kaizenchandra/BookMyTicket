import { AppError } from "../../../shared/errors.ts";
export type FormField = {
  id: string;
  label: string;
  purpose: string;
  type: "text" | "email" | "phone" | "date" | "choice" | "checkbox";
  required: boolean;
  maxLength: number;
  options: string[];
};
export type FormDefinition = {
  title: string;
  instructions: string;
  fields: FormField[];
};
export type Answers = Record<string, string | boolean>;
export function validateDefinition(form: FormDefinition) {
  if (!form.title.trim() || form.fields.length > 20)
    throw new AppError(
      "INVALID_FORM",
      "Provide a title and at most 20 fields.",
      422,
    );
  const ids = new Set<string>();
  for (const f of form.fields) {
    if (
      !/^[a-z][a-z0-9_]{0,39}$/.test(f.id) ||
      ["constructor", "prototype", "__proto__"].includes(f.id) ||
      ids.has(f.id) ||
      !f.label.trim() ||
      !f.purpose.trim()
    )
      throw new AppError(
        "INVALID_FORM",
        "Fields need unique safe identifiers, labels and collection purposes.",
        422,
      );
    ids.add(f.id);
    if (
      !Number.isInteger(f.maxLength) ||
      f.maxLength < 1 ||
      f.maxLength > 500 ||
      !["text", "email", "phone", "date", "choice", "checkbox"].includes(f.type)
    )
      throw new AppError(
        "INVALID_FORM",
        "Unsupported field type or length limit.",
        422,
      );
    if (
      f.type === "choice"
        ? f.options.length < 1 ||
          f.options.length > 30 ||
          new Set(f.options).size !== f.options.length ||
          f.options.some((o) => !o.trim() || o.length > f.maxLength)
        : f.options.length !== 0
    )
      throw new AppError(
        "INVALID_FORM",
        "Only choice fields accept unique, nonempty options within the field length limit.",
        422,
      );
  }
}
export function validateAnswers(
  form: FormDefinition,
  quantity: number,
  answers: Answers[],
): Answers[] {
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 8 ||
    answers.length !== quantity
  )
    throw new AppError(
      "ATTENDEE_COUNT",
      "Provide one registration for each reserved admission.",
      422,
    );
  const allowed = new Set(form.fields.map((f) => f.id));
  return answers.map((answer, index) => {
    if (Object.keys(answer).some((k) => !allowed.has(k)))
      throw new AppError(
        "ATTENDEE_FIELD",
        "An attendee response contains an unsupported field.",
        422,
      );
    const result: Answers = {};
    for (const f of form.fields) {
      const value = answer[f.id];
      const fail = () => {
        throw new AppError(
          "ATTENDEE_VALIDATION",
          `Attendee ${index + 1}: check ${f.label}.`,
          422,
        );
      };
      if (value === undefined || value === "") {
        if (f.required) fail();
        continue;
      }
      if (f.type === "checkbox") {
        if (typeof value !== "boolean" || (f.required && value !== true))
          fail();
        result[f.id] = value;
        continue;
      }
      if (typeof value !== "string") fail();
      const v = (value as string).trim();
      if (
        v.length > f.maxLength ||
        (f.required && !v.length) ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
      )
        fail();
      if (v && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        fail();
      if (v && f.type === "phone" && !/^\+?[0-9 ()-]{7,25}$/.test(v)) fail();
      if (
        v &&
        f.type === "date" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          !Number.isFinite(Date.parse(v)) ||
          new Date(v).toISOString().slice(0, 10) !== v)
      )
        fail();
      if (v && f.type === "choice" && !f.options.includes(v)) fail();
      if (v) result[f.id] = v;
    }
    return result;
  });
}
