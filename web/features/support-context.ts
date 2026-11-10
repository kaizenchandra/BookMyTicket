export function customerCaseLink(
  filters: {
    bookingId?: string | null;
    caseId?: string | null;
    after?: string | null;
    state?: string | null;
    category?: string | null;
  } = {},
) {
  const params = new URLSearchParams();
  for (const key of [
    "bookingId",
    "caseId",
    "after",
    "state",
    "category",
  ] as const)
    if (filters[key]) params.set(key, filters[key]);
  return "/cases" + (params.size ? `?${params}` : "");
}
