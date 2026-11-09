import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VenueImageView } from "../web/features/venue-media.tsx";

test("Venue image initial render preserves descriptions without loading external images or interpreting supplied markup", () => {
  const html = renderToStaticMarkup(
    createElement(VenueImageView, {
      item: {
        url: "https://images.fixture.invalid/map.png",
        kind: "map",
        alt: "Ramp from north gate",
        caption: "<script>alert(1)</script>",
        attribution: "Photographer & venue",
      },
    }),
  );
  assert(html.includes("Ramp from north gate"));
  assert(html.includes("Load image from images.fixture.invalid"));
  assert(html.includes("Venue map"));
  assert(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert(html.includes("Photographer &amp; venue"));
  assert(!html.includes("<img"));
  assert(!html.includes("<script"));
  assert(!html.includes('rel="preload"'));
});
