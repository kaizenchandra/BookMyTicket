import { randomUUID } from "node:crypto";
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
import { HelpResults, HelpNavigation } from "../web/features/help.tsx";
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
      { items: [], nextCursor: null },
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

test("Public FAQ search filters published content before stable bounded pages", async () => {
  const app = await buildApp(),
    prefix = `public-${randomUUID()}`,
    marker = randomUUID(),
    ids: string[] = [];
  const add = async (id: string, topic = "booking", published = true) => {
    ids.push(id);
    await pool.query(
      "INSERT INTO catalog.help_articles(id,topic,question,answer,href,action,published) VALUES($1,$2,$3,'SECOND word %_ literal','/bookings','View bookings',$4)",
      [id, topic, `Question ${marker}`, published],
    );
  };
  const get = async (params: Record<string, string> = {}) => {
    const response = await app.inject({
      url:
        "/api/v1/help?" +
        new URLSearchParams({
          q: `${marker} second`,
          topic: "booking",
          ...params,
        }),
    });
    assert.equal(response.statusCode, 200, response.body);
    return helpResponse.parse(response.json());
  };
  try {
    for (let i = 1; i <= 27; i++)
      await add(`${prefix}-${String(i).padStart(2, "0")}`, "booking", i !== 1);
    await add(`${prefix}-payment`, "payment");
    const first = await get();
    assert.equal(first.items.length, 20);
    assert.equal(first.nextCursor, ids[20]);
    assert.deepEqual(
      first.items.map((a) => a.id),
      ids.slice(1, 21),
    );
    await add(`${prefix}-00`);
    const second = await get({ after: first.nextCursor! });
    assert.equal(second.items.length, 6);
    assert.equal(second.nextCursor, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((a) => a.id)).size,
      26,
    );
    assert(
      ![...first.items, ...second.items].some(
        (a) => a.id === ids[0] || a.topic === "payment",
      ),
    );
    const literal = await get({ q: `${marker} %_` });
    assert.equal(literal.items.length, 20);
    assert.equal((await get({ q: `${marker} %x` })).items.length, 0);
    assert.equal(
      (await get({ q: `${marker} SeCoNd`, topic: "payment" })).items.length,
      1,
    );
    await pool.query(
      "UPDATE catalog.help_articles SET published=false WHERE id=$1",
      [ids[26]],
    );
    const afterWithdrawal = await get({ after: first.nextCursor! });
    assert.equal(afterWithdrawal.items.length, 5);
    assert(!afterWithdrawal.items.some((a) => a.id === ids[26]));
    assert.deepEqual(await get({ after: `${prefix}-zz` }), {
      items: [],
      nextCursor: null,
    });
    for (const query of [
      "after=UPPER",
      "after=",
      "after=one&after=two",
      "after=bad--slug",
    ])
      assert.equal(
        (await app.inject({ url: "/api/v1/help?" + query })).statusCode,
        422,
      );
  } finally {
    await pool.query(
      "UPDATE catalog.help_articles SET published=false WHERE id=ANY($1::text[])",
      [ids],
    );
    await app.close();
  }
});
test("Help pagination links retain search and topic while first-page navigation drops the cursor", () => {
  const html = renderToStaticMarkup(
    createElement(HelpNavigation, {
      q: "payment & refund",
      topic: "payment",
      after: "old",
      nextCursor: "next-answer",
    }),
  );
  assert(html.includes("First page"));
  assert(html.includes("Next answers"));
  assert(html.includes('href="/help?q=payment+%26+refund&amp;topic=payment"'));
  assert(
    html.includes(
      'href="/help?q=payment+%26+refund&amp;topic=payment&amp;after=next-answer"',
    ),
  );
  assert(!html.includes("after=old"));
  const last = renderToStaticMarkup(
    createElement(HelpNavigation, {
      q: "",
      topic: "",
      after: "last",
      nextCursor: null,
    }),
  );
  assert(!last.includes("Next answers"));
  assert(last.includes("First page"));
});
