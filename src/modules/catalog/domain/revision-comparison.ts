import {
  categoryRevisionFields,
  type CategoryRevisionField,
} from "./revision-snapshot.ts";
export const revisionFields = [
  "title",
  "description",
  "city",
  "kind",
  "state",
] as const;
export type RevisionSnapshot = Record<
  (typeof revisionFields)[number],
  string | null
> & { categoryDetails?: Partial<Record<CategoryRevisionField, string | null>> };
export function compareRevisionSnapshots(
  from: RevisionSnapshot,
  to: RevisionSnapshot,
) {
  return [
    ...revisionFields
      .filter((field) => from[field] !== to[field])
      .map((field) => ({
        field: field as string,
        before: from[field],
        after: to[field],
      })),
    ...categoryRevisionFields
      .filter(
        (field) =>
          (from.categoryDetails?.[field] ?? null) !==
          (to.categoryDetails?.[field] ?? null),
      )
      .map((field) => ({
        field: `categoryDetails.${field}`,
        before: from.categoryDetails?.[field] ?? null,
        after: to.categoryDetails?.[field] ?? null,
      })),
  ];
}
