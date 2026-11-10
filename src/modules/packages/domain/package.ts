export type Component = {
  id: string;
  name: string;
  kind: "hotel" | "transport" | "activity" | "other";
  supplierReference: string;
  adultPaise: string;
  childPaise: string;
  fixedPaise: string;
};
export type Definition = {
  name: string;
  description: string;
  destinations: string[];
  itinerary: { day: number; title: string; description: string }[];
  inclusions: string[];
  exclusions: string[];
  images: { url: string; alt: string }[];
  departures: { start: string; end: string }[];
  maxAdults: number;
  maxChildren: number;
  maxGuests: number;
  childMaxAge: number;
  childPolicy: string;
  cancellationPolicy: string;
  components: Component[];
  addons: {
    id: string;
    name: string;
    pricePaise: string;
    basis: "person" | "booking";
  }[];
  markupBps: number;
  feePaise: string;
};
export function definitionErrors(d: Definition) {
  const errors: string[] = [];
  if (new Set(d.components.map((c) => c.id)).size !== d.components.length)
    errors.push("Component identifiers must be unique.");
  if (new Set(d.addons.map((c) => c.id)).size !== d.addons.length)
    errors.push("Add-on identifiers must be unique.");
  if (new Set(d.departures.map((c) => c.start)).size !== d.departures.length)
    errors.push("Departure start dates must be unique.");
  if (d.itinerary.some((x, i) => x.day !== i + 1))
    errors.push("Itinerary days must be consecutive, starting at 1.");
  if (d.departures.some((x) => x.end < x.start))
    errors.push("Travel end must not precede start.");
  if (
    d.departures.some(
      (x) =>
        d.itinerary.length &&
        (Date.parse(x.end) - Date.parse(x.start)) / 86400000 + 1 !==
          d.itinerary.length,
    )
  )
    errors.push(
      "Travel dates must match the number of itinerary days (inclusive).",
    );
  return errors;
}
export function completeness(d: Definition) {
  const missing: string[] = [];
  if (d.description.length < 40) missing.push("description (40 characters)");
  for (const k of [
    "destinations",
    "itinerary",
    "images",
    "departures",
    "components",
    "inclusions",
  ] as const)
    if (!d[k].length) missing.push(k);
  if (!d.childPolicy) missing.push("child policy");
  if (!d.cancellationPolicy) missing.push("cancellation policy");
  return { complete: missing.length === 0, missing };
}
export function packagePrice(
  d: Definition,
  adults: number,
  children: number,
  addons: string[],
) {
  const lines = d.components.map((c) => ({
    id: c.id,
    name: c.name,
    amountPaise: (
      BigInt(c.adultPaise) * BigInt(adults) +
      BigInt(c.childPaise) * BigInt(children) +
      BigInt(c.fixedPaise)
    ).toString(),
  }));
  const componentTotal = lines.reduce((n, c) => n + BigInt(c.amountPaise), 0n),
    markup = (componentTotal * BigInt(d.markupBps) + 5000n) / 10000n,
    extras = d.addons
      .filter((a) => addons.includes(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        amountPaise: (
          BigInt(a.pricePaise) *
          BigInt(a.basis === "person" ? adults + children : 1)
        ).toString(),
      })),
    total =
      componentTotal +
      markup +
      BigInt(d.feePaise) +
      extras.reduce((n, a) => n + BigInt(a.amountPaise), 0n);
  return {
    currency: "INR",
    components: lines,
    addons: extras,
    markupPaise: markup.toString(),
    feePaise: d.feePaise,
    totalPaise: total.toString(),
    bookable: false,
  };
}
export function publicDefinition(d: Definition) {
  const { components, markupBps, feePaise, addons, ...content } = d;
  return {
    ...content,
    components: components.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
    })),
    addons: addons.map((a) => ({ id: a.id, name: a.name, basis: a.basis })),
  };
}
