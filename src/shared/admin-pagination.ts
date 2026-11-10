import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "./errors.ts";
const shape = z
  .object({ id: z.uuid(), time: z.iso.datetime(), scope: z.string() })
  .strict();
export function pageScope(actor: string, filters: unknown) {
  return createHash("sha256")
    .update(JSON.stringify([actor, filters]))
    .digest("hex");
}
export function readPage(after: string | undefined, scope: string) {
  if (!after) return undefined;
  try {
    const page = shape.parse(
      JSON.parse(Buffer.from(after, "base64url").toString()),
    );
    if (page.scope !== scope) throw Error();
    return page;
  } catch {
    throw new AppError(
      "INVALID_CURSOR",
      "Account or filters changed. Return to the first page.",
      422,
    );
  }
}
export function nextPage(
  row: { id: string; page_time: string } | undefined,
  scope: string,
) {
  return row
    ? Buffer.from(
        JSON.stringify({ id: row.id, time: row.page_time, scope }),
      ).toString("base64url")
    : null;
}
