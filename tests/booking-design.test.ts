import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BookingProgress,
  SeatSelection,
} from "../web/features/booking-design.tsx";
test("Booking seat controls reflect authoritative availability, selection and accessible labels", () => {
  const html = renderToStaticMarkup(
    React.createElement(SeatSelection, {
      resources: [
        {
          id: "A1",
          label: "A1",
          kind: "seat",
          available: 1,
          price_paise: 25000,
        },
        {
          id: "A2",
          label: "A2",
          kind: "seat",
          available: 0,
          price_paise: 25000,
        },
      ],
      plan: {
        orientation: "All eyes this way",
        resources: [
          {
            id: "A1",
            x: 20,
            y: 20,
            row: "A",
            section: "Main",
            accessible: true,
          },
          {
            id: "A2",
            x: 30,
            y: 20,
            row: "A",
            section: "Main",
            accessible: false,
          },
        ],
      },
      selected: { A1: 1 },
      onChange: () => {},
      busy: false,
    }),
  );
  assert.match(html, /aria-label="A1, accessible, ₹250.00, selected"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /disabled="" aria-pressed="false" aria-label="A2/);
  assert.match(html, /Select seats from an accessible list/);
  assert.match(html, /All eyes this way/);
});
test("General admission quantities are bounded and all controls stop while reserving", () => {
  const html = renderToStaticMarkup(
    React.createElement(SeatSelection, {
      resources: [
        {
          id: "ga",
          label: "General admission",
          kind: "pool",
          available: 2,
          price_paise: 10000,
        },
      ],
      selected: { ga: 2 },
      onChange: () => {},
      busy: true,
    }),
  );
  assert.match(
    html,
    /disabled="" aria-label="Add one General admission ticket"/,
  );
  assert.match(
    html,
    /disabled="" aria-label="Remove one General admission ticket"/,
  );
  assert.match(html, /aria-label="General admission quantity">2/);
  assert.match(html, /2 available/);
});
test("Booking progress exposes the current stage without claiming confirmation", () => {
  const html = renderToStaticMarkup(
    React.createElement(BookingProgress, { step: 3 }),
  );
  assert.equal((html.match(/aria-current="step"/g) ?? []).length, 1);
  assert.match(html, /Review details/);
  assert(!html.includes("confirmed"));
});
