import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { venueDirections } from "../src/modules/bookings/domain/directions.ts";
import { TicketDirections } from "../web/features/tickets.tsx";
test("Ticket directions encode destinations and omit unusable links", () => {
  assert.equal(venueDirections("Venue", null, "City"), null);
  assert.equal(venueDirections("Venue", " ", "City"), null);
  assert.equal(venueDirections("Venue", "界".repeat(1000), "City"), null);
  const result = venueDirections("Venue & hall", "Main road?x=1#gate", "Pune")!;
  assert.equal(
    new URL(result).searchParams.get("destination"),
    "Venue & hall, Main road?x=1#gate, Pune",
  );
  assert.equal(new URL(result).hash, "");
});
test("Ticket direction rendering escapes addresses and retains a manual fallback", () => {
  const html = renderToStaticMarkup(
    createElement(TicketDirections, {
      occurrence: {
        venueAddress: "<Private address>",
        venueCity: "Pune",
        directionsUrl: venueDirections("Venue", "<Private address>", "Pune"),
      },
    }),
  );
  assert(html.includes("&lt;Private address&gt;"));
  assert(html.includes('rel="noopener noreferrer"'));
  assert(html.includes("location access is unavailable"));
  const missing = renderToStaticMarkup(
    createElement(TicketDirections, {
      occurrence: { venueAddress: null, venueCity: null, directionsUrl: null },
    }),
  );
  assert(missing.includes("No street address was supplied"));
  assert(!missing.includes("href="));
  const long = renderToStaticMarkup(
    createElement(TicketDirections, {
      occurrence: {
        venueAddress: "Long address",
        venueCity: null,
        directionsUrl: null,
      },
    }),
  );
  assert(long.includes("Long address"));
  assert(!long.includes("href="));
});
