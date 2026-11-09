# ADR 030 — Durable customer and staff reply retries

Scope: FE:SUP-C-04 and FE:SUP-A-03/04, supporting backend durable-command requirements.

Both first-party conversation forms now supply stable request keys while mounted. Migration 035 stores reply outcomes scoped by actor, customer/staff channel and key. Payload fingerprints bind case, body and audience; staff commands also bind expected case version. Changing text, audience or version under the same key conflicts.

The existing case ownership/staff authorization checks remain in force. The persistence adapter serializes keyed actor commands, locks the case, checks for an original outcome and otherwise atomically saves the message, case update, audit and command result. Replay happens before a new state/version transition, so a previously saved customer reply cannot reopen a case resolved later. A staff replay cannot send a second internal note or convert its audience. Permission is rechecked at every HTTP call.

Customer-visible versus internal messages retain the existing read filters. Neither command storage nor the audit duplicates message bodies; only the digest and minimal saved result are stored. No email/SMS delivery is implied.

Headerless legacy clients remain supported without deduplication. Keys are not persisted through page closure or component remount, and command rows currently have no expiry. Inspect conversation history before resubmitting after leaving the view. Durable draft recovery and approved retention remain outstanding.

Tests use real HTTP/PostgreSQL to race six identical customer and six staff replies, check one message each, reject changed content/audience, preserve internal-note privacy, prevent replay from reopening a resolved case and reject revoked staff permission. Browser interaction and accessibility remain unverified.
