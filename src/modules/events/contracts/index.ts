import type { Transaction } from "../../../shared/database.ts";
import type { FormDefinition, Answers } from "../domain/registration.ts";
export type {
  FormDefinition,
  Answers,
  FormField,
} from "../domain/registration.ts";
export type RegistrationInput = { formId: string; answers: Answers[] };
export type AssignedForm = {
  id: string;
  version: number;
  definition: FormDefinition;
};
export type AcceptedRegistration = { form: AssignedForm; answers: Answers[] };
export interface RegistrationForms {
  current(tx: Transaction, occurrenceId: string): Promise<AssignedForm | null>;
  validate(
    tx: Transaction,
    occurrenceId: string,
    quantity: number,
    input?: RegistrationInput,
  ): Promise<AcceptedRegistration | null>;
}

export interface RegistrationFormHistory {
  definition(
    tx: Transaction,
    occurrence: string,
    form: string,
  ): Promise<AssignedForm>;
}
