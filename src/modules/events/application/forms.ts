import type { Transaction } from "../../../shared/database.ts";
import type {
  RegistrationForms,
  AssignedForm,
  RegistrationInput,
} from "../contracts/index.ts";
import {
  validateAnswers,
  validateDefinition,
  type FormDefinition,
} from "../domain/registration.ts";
import { AppError } from "../../../shared/errors.ts";
export interface FormStore {
  current(tx: Transaction, occurrenceId: string): Promise<AssignedForm | null>;
  list(actor: string, occurrenceId: string): Promise<unknown>;
  publish(
    actor: string,
    occurrenceId: string,
    version: number,
    definition: FormDefinition,
  ): Promise<AssignedForm>;
}
export class Forms implements RegistrationForms {
  constructor(private store: FormStore) {}
  current(tx: Transaction, id: string) {
    return this.store.current(tx, id);
  }
  list(actor: string, id: string) {
    return this.store.list(actor, id);
  }
  publish(
    actor: string,
    id: string,
    version: number,
    definition: FormDefinition,
  ) {
    validateDefinition(definition);
    return this.store.publish(actor, id, version, definition);
  }
  async validate(
    tx: Transaction,
    id: string,
    quantity: number,
    input?: RegistrationInput,
  ) {
    const form = await this.current(tx, id);
    if (!form?.definition.fields.length) {
      if (input)
        throw new AppError(
          "FORM_CHANGED",
          "Registration collection is not required for this occurrence. Refresh before continuing.",
          409,
        );
      return null;
    }
    if (!input || input.formId !== form.id)
      throw new AppError(
        "FORM_CHANGED",
        "The required attendee form changed. Refresh and review the current form.",
        409,
      );
    return {
      form,
      answers: validateAnswers(form.definition, quantity, input.answers),
    };
  }
}
