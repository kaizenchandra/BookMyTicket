import { AppError } from "../../../shared/errors.ts";
export type Component = {
  occurrenceId: string;
  resourceId: string;
  quantity: number;
};
export function validateComponents(items: Component[]) {
  if (
    !items.length ||
    items.length > 8 ||
    items.some(
      (i) => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 8,
    ) ||
    items.reduce((n, i) => n + i.quantity, 0) > 8
  )
    throw new AppError(
      "INVALID_QUANTITY",
      "Choose between 1 and 8 admission units.",
      422,
    );
  const keys = items.map((i) => `${i.occurrenceId}:${i.resourceId}`);
  if (new Set(keys).size !== keys.length)
    throw new AppError(
      "DUPLICATE_RESOURCE",
      "A resource may appear only once.",
      422,
    );
  return [...items].sort(
    (a, b) =>
      a.occurrenceId.localeCompare(b.occurrenceId) ||
      a.resourceId.localeCompare(b.resourceId),
  );
}
