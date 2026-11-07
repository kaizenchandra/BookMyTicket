import { AppError } from "../../../shared/errors.ts";
export type PlanResource = {
  id: string;
  kind: "seat" | "pool";
  label: string;
  section: string;
  row: string;
  gate: string;
  capacity: number;
  x: number;
  y: number;
  accessible: boolean;
  companionOf?: string;
};
export type Plan = { orientation: string; resources: PlanResource[] };
export function validatePlan(plan: Plan, physicalCapacity: number) {
  const ids = new Set<string>(),
    labels = new Set<string>(),
    positions = new Set<string>();
  let total = 0;
  if (
    !plan.orientation.trim() ||
    !plan.resources.length ||
    plan.resources.length > 1000
  )
    throw new AppError(
      "INVALID_PLAN",
      "Specify orientation and between 1 and 1000 resources.",
      422,
    );
  for (const r of plan.resources) {
    const label = JSON.stringify([r.section, r.row, r.label]),
      position = `${r.x}:${r.y}`;
    if (
      !r.id.trim() ||
      !r.label.trim() ||
      !r.section.trim() ||
      ids.has(r.id) ||
      labels.has(label) ||
      positions.has(position)
    )
      throw new AppError(
        "DUPLICATE_RESOURCE",
        "Resource IDs, section/row/labels and map positions must be unique.",
        422,
      );
    if (
      !Number.isInteger(r.capacity) ||
      r.capacity < 1 ||
      (r.kind === "seat" && r.capacity !== 1) ||
      ![r.x, r.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)
    )
      throw new AppError(
        "INVALID_CAPACITY",
        "Check capacity and coordinates (0–100). Assigned seats have capacity one.",
        422,
      );
    ids.add(r.id);
    labels.add(label);
    positions.add(position);
    total += r.capacity;
  }
  if (total > physicalCapacity)
    throw new AppError(
      "PHYSICAL_CAPACITY_EXCEEDED",
      "The plan exceeds the physical capacity of this space.",
      409,
    );
  for (const r of plan.resources)
    if (r.companionOf) {
      const target = plan.resources.find((t) => t.id === r.companionOf);
      if (
        !target ||
        !target.accessible ||
        target.id === r.id ||
        r.kind !== "seat" ||
        target.kind !== "seat" ||
        target.section !== r.section
      )
        throw new AppError(
          "INVALID_COMPANION",
          "A companion seat must reference another accessible seat in its section.",
          422,
        );
    }
  return total;
}
