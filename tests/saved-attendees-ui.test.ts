import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SavedAttendeeValue } from "../web/features/saved-attendees.tsx";
test("Saved attendee reuse is explicit and excludes declarations, dates and choices", () => {
  const items = [
    {
      id: "test",
      name: "<Private>",
      email: "person@fixture.invalid",
      phone: "",
    },
  ];
  for (const type of ["checkbox", "date", "choice"])
    assert.equal(
      renderToStaticMarkup(
        createElement(SavedAttendeeValue, {
          items,
          type,
          disabled: false,
          onChoose: () => {},
        }),
      ),
      "",
    );
  const html = renderToStaticMarkup(
    createElement(SavedAttendeeValue, {
      items,
      type: "text",
      disabled: false,
      onChoose: () => {},
    }),
  );
  assert(html.includes("Choose saved name"));
  assert(html.includes("&lt;Private&gt;"));
  assert(!html.includes("person@fixture.invalid"));
  assert(html.includes('value="" selected=""'));
});

test("Consent history panels distinguish attendee storage from marketing permission", async () => {
  const { SavedAttendeesEditor } =
    await import("../web/features/saved-attendees.tsx");
  const { MarketingConsentHistory } =
    await import("../web/features/marketing-consent-history.tsx");
  const attendee = renderToStaticMarkup(createElement(SavedAttendeesEditor));
  assert(attendee.includes("Saved attendee consent history"));
  assert(
    attendee.includes("History contains no attendee names or contact details"),
  );
  assert(!attendee.includes("Marketing email consent history"));
  assert(attendee.includes("View consent history"));
  const marketing = renderToStaticMarkup(
    createElement(MarketingConsentHistory, { revision: 0 }),
  );
  assert(marketing.includes("Marketing email consent history"));
  assert(marketing.includes("prove that an email was sent"));
  assert(!marketing.includes("Saved attendee consent history"));
});

test("Consent wording renders retained text safely and identifies missing historical text", async () => {
  const { ConsentWording } =
    await import("../web/features/consent-history.tsx");
  const missing = renderToStaticMarkup(
    createElement(ConsentWording, { text: null }),
  );
  assert(missing.includes("Consent wording was not retained"));
  assert(!missing.includes("Recorded consent wording"));
  const retained = renderToStaticMarkup(
    createElement(ConsentWording, {
      text: "<script>alert('x')</script>\nOriginal wording",
    }),
  );
  assert(retained.includes("Recorded consent wording"));
  assert(retained.includes("&lt;script&gt;"));
  assert(!retained.includes("<script>"));
  assert(retained.includes("Original wording"));
});
