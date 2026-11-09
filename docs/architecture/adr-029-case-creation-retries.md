# ADR 029 — Durable support-case creation retries

The /cases form now supplies a stable Idempotency-Key for unchanged creation attempts. Support stores the request fingerprint and original result in migration 034's creation_commands table, scoped by customer and operation. An owner advisory lock serializes matching attempts. Case, initial message, audit and outcome commit together. A lost-response replay returns the original case reference and does not reset a subsequently resolved or reassigned case.

The fingerprint includes normalized subject/category/body and optional booking reference. Changed input with an existing key returns 409. Authentication is revalidated on each HTTP attempt. Keys are retained with no automatic expiry; retention changes require explicit business-uniqueness policy.

For compatibility, pre-existing API clients may omit the header and keep their original non-deduplicated behavior. The new first-party form always sends it. This is not a claim that every legacy client has safe retry behavior. The form key survives retries while mounted, but not page closure/reload; users are advised to check case history before submitting again after leaving the page. No sensitive draft is persisted to browser storage.

Pending submission disables form fields, preserving the fingerprinted input. Success displays the saved/recovered case reference and clears the command; failures preserve draft/key. Creation audit omits subject/body and records the reference and outcome only.

Real PostgreSQL/HTTP tests cover eight concurrent identical retries, one case/message/audit, changed input, account scoping, malformed keys, suspended-account denial and replay after resolution. Browser host remains unavailable; interactive and accessibility acceptance are pending. Durable reply retries, attachments and all broader support requirements remain outstanding.
