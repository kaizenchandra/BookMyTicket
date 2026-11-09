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
