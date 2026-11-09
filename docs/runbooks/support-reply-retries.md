# Support reply retries

Keep the customer case or selected staff conversation open when a send outcome is uncertain. Retry unchanged input to recover the original saved message. Changing content/audience or refreshing to a different version creates a different request; inspect conversation history first if a previous send may have succeeded.

First-party forms send Idempotency-Key. API clients should use the same 8–100 character key only for identical input in the same channel. Changed input conflicts. Headerless clients retain legacy non-deduplicated behavior. Authentication, case ownership and staff grants are still checked.

A replay returns the original message result and does not reopen a case or revert later staff changes. Internal notes remain staff-only; customer replies remain customer-visible. This is persisted conversation handling, not external notification delivery.

Migration 035 is additive. Retain command records across rollback; old application artifacts do not honor the new guarantee. Do not clear commands to force uncertain retries. Browser/interactive acceptance is unverified. Evidence: docs/evidence/reply-retries-*.
