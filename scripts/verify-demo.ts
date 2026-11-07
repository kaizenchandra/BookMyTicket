import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const origin = process.env.SMOKE_ORIGIN ?? "http://127.0.0.1:3101";
const seed = JSON.parse(await readFile("docs/evidence/demo-seed.json", "utf8"));
const checks = [];
for (const listing of seed.items) {
  const response = await fetch(origin + `/api/v1/catalog/${listing.id}`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.metadata.demo, "true");
  assert.ok(data.title.startsWith("[DEMO]"));
  const category = await fetch(
    origin + `/api/v1/catalog/${listing.id}/${listing.kind}`,
  );
  assert.equal(category.status, 200);
  assert.equal((await category.json()).details.title, listing.title);
  const poster = await fetch(origin + data.poster_url);
  assert.equal(poster.status, 200);
  assert.ok((await poster.text()).includes("FICTIONAL"));
  const sessions = await (
    await fetch(origin + `/api/v1/catalog/${listing.id}/occurrences`)
  ).json();
  assert.equal(sessions.items.length, 2);
  assert.ok(
    sessions.items.every((o: any) => o.is_demo && o.available_units > 0),
  );
  assert.ok(sessions.items.some((o: any) => o.min_price_paise === 0));
  assert.ok(sessions.items.some((o: any) => o.min_price_paise > 0));
  for (const o of sessions.items) {
    const inventory = await fetch(
      origin + `/api/v1/occurrences/${o.id}/inventory`,
    );
    assert.equal(inventory.status, 200);
  }
  checks.push({
    title: listing.title,
    city: listing.city,
    kind: listing.kind,
    listingId: listing.id,
    posterAvailable: true,
    sessionCount: sessions.items.length,
    freeSessionId: sessions.items.find((o: any) => o.min_price_paise === 0).id,
  });
}
await writeFile(
  "docs/evidence/demo-http-verification.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      origin,
      level:
        "Read-only deployed HTTP; authenticated full journeys verified separately in isolated PostgreSQL tests; no browser acceptance",
      checks,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Verified ${checks.length} demo listings, category details, posters and ${checks.length * 2} persisted inventory sessions.`,
);
