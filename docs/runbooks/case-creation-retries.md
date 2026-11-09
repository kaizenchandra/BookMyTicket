# Support-case creation retries

Submit /cases normally. Keep the page open if the request fails or its outcome is uncertain, then retry the unchanged form. The first-party UI reuses its command key and recovers the existing case if the earlier attempt committed. A recovered response does not reopen or reset the case.

Editing the request creates a new command key. After closing/reloading the page, inspect your case list before creating another request; the draft key is intentionally not persisted in browser storage.

API clients should send an 8–100 character Idempotency-Key and reuse it only with the identical normalized payload. Reuse with changed input returns 409. Headerless legacy clients remain supported but have no duplicate protection. Authenticate every attempt. Do not delete command rows to force a retry.

Migration 034 is additive and retained across rollback. Prior artifacts do not provide this guarantee; avoid routing uncertain retries to old artifacts during rollback. Evidence: docs/evidence/case-retries-*. Browser verification is blocked.
