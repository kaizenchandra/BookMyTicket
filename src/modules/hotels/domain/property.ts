export type Content = {
  name: string;
  kind: "hotel" | "homestay";
  description: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  contactEmail: string;
  contactPhone: string;
  supplier: { name: string; reference: string };
  images: { url: string; alt: string }[];
  amenities: string[];
  facilities: string[];
  houseRules: string;
  checkIn: string;
  checkOut: string;
  cancellationPolicy: string;
};
export type State =
  "draft" | "pending_review" | "published" | "suspended" | "delisted";
export type Action =
  "submit" | "approve" | "reject" | "suspend" | "delist" | "reopen";
export function completeness(c: Content) {
  const missing: string[] = [];
  for (const field of [
    "name",
    "description",
    "city",
    "address",
    "contactEmail",
    "contactPhone",
    "houseRules",
    "checkIn",
    "checkOut",
    "cancellationPolicy",
  ] as const)
    if (!c[field].trim()) missing.push(field);
  if (c.description.trim().length < 40 && !missing.includes("description"))
    missing.push("description (at least 40 characters)");
  if (!c.supplier.name.trim() || !c.supplier.reference.trim())
    missing.push("supplier name and reference");
  if (c.latitude === null || c.longitude === null) missing.push("coordinates");
  if (!c.images.length) missing.push("images");
  if (!c.amenities.length) missing.push("amenities");
  return { complete: missing.length === 0, missing };
}
export function transition(state: State, action: Action): State | null {
  const transitions: Record<Action, Partial<Record<State, State>>> = {
    submit: { draft: "pending_review" },
    approve: { pending_review: "published" },
    reject: { pending_review: "draft" },
    suspend: { published: "suspended" },
    delist: { published: "delisted", suspended: "delisted" },
    reopen: { suspended: "draft", delisted: "draft" },
  };
  return transitions[action][state] ?? null;
}
export function publicContent(c: Content) {
  const { contactEmail, contactPhone, supplier, ...safe } = c;
  return safe;
}
