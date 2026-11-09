import { migrate } from "../scripts/migrate.ts";
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildApp } from "../src/app.ts";
import { pool } from "../src/shared/database.ts";
import { Help } from "../src/modules/catalog/application/help.ts";
import { PublishedHelpContent } from "../src/modules/catalog/adapters/help-content.ts";
import { helpResponse } from "../src/modules/catalog/adapters/help-schema.ts";
import { HelpResults } from "../web/features/help.tsx";
before(migrate);
after(() => pool.end());
test("Published help searches all words case-insensitively and combines topic filters", async () => {
  const help = new Help(new PublishedHelpContent());
  const all = (await help.search()).items;
  assert.equal(all.length, 6);
  assert(
    all.every((a) =>
      ["/explore", "/bookings", "/profile", "/cases"].includes(a.href),
    ),
  );
  assert.equal(new Set(all.map((a) => a.id)).size, all.length);
  assert(all.every((a) => a.version === 1 && /^\/(?!\/)/.test(a.href)));
  assert.deepEqual(
    (await help.search("  PAYMENT   pending  ", "payment")).items.map(
      (a) => a.id,
    ),
    ["payment-pending"],
  );
  assert.equal((await help.search("pending", "accessibility")).items.length, 0);
  assert.equal((await help.search("%_")).items.length, 0);
  assert.equal((await help.search("", "booking")).items.length, 3);
  assert(
    (await help.search("refreshing")).items.some(
      (a) => a.id === "reservation-expiry",
    ),
  );
});
test("Public help HTTP contracts validate bounded searches and reject unsupported filters", async () => {
  const app = await buildApp();
  try {
    for (const query of [
      "",
      "?q=payment&topic=payment",
      "?q=not-a-real-answer",
      "?q=%20%20",
    ]) {
      const response = await app.inject({ url: "/api/v1/help" + query });
      assert.equal(response.statusCode, 200, response.body);
      helpResponse.parse(response.json());
    }
    assert.deepEqual(
      (await app.inject({ url: "/api/v1/help?q=not-a-real-answer" })).json(),
      { items: [] },
    );
    for (const query of [
      "q=" + "x".repeat(101),
      "topic=unknown",
      "accountId=private",
      "q=a&q=b",
      "topic=booking&topic=payment",
    ]) {
      assert.equal(
        (await app.inject({ url: "/api/v1/help?" + query })).statusCode,
        422,
        query,
      );
    }
    const plain = await app.inject({ url: "/api/v1/help?topic=payment" });
    const invalidSession = await app.inject({
      url: "/api/v1/help?topic=payment",
      headers: { cookie: "session=invalid" },
    });
    assert.deepEqual(plain.json(), invalidSession.json());
  } finally {
    await app.close();
  }
});
test("Help results render safe text, contextual links and explicit empty results", async () => {
  const items = (
    await new Help(new PublishedHelpContent()).search("pending", "payment")
  ).items;
  const html = renderToStaticMarkup(createElement(HelpResults, { items }));
  assert(html.includes('href="/bookings"'));
  assert(html.includes("payment callback is not a booking confirmation"));
  assert(html.includes('role="status"'));
  const empty = renderToStaticMarkup(createElement(HelpResults, { items: [] }));
  assert(empty.includes("No answers match"));
  const escaped = renderToStaticMarkup(
    createElement(HelpResults, {
      items: [{ ...items[0], answer: "<script>secret()</script>" }],
    }),
  );
  assert(!escaped.includes("<script>"));
  assert(escaped.includes("&lt;script&gt;"));
});
