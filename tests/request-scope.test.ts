import { test } from "node:test";
import assert from "node:assert/strict";
import { RequestScope } from "../web/request-scope.ts";

test("Favorite request scope ignores delayed responses after account or resource changes, including return visits", async () => {
  const scope = new RequestScope();
  scope.update("account-a/listing-a");
  const current = scope.capture();
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let displayed = "new account state";
  const response = pending.then(() => {
    if (current()) displayed = "old save result";
  });
  scope.update("account-b/listing-a");
  scope.update("account-a/listing-a");
  finish();
  await response;
  assert.equal(displayed, "new account state");
  const fresh = scope.capture();
  scope.update("account-a/listing-a");
  assert.equal(fresh(), true);
  scope.update("account-a/venue-a");
  assert.equal(fresh(), false);
  const unmounted = scope.capture();
  scope.invalidate();
  assert.equal(unmounted(), false);
});
