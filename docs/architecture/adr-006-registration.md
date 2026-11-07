# ADR 006 — Versioned registration at accepted-order placement

Events owns reusable occurrence registration-form versions (including sports participant fields); Bookings owns submitted attendee answers. Inventory owns the occurrence/hold and admission quantity. Forms are authored under verified organization access and the occurrence row lock; publication creates an immutable version and advances an optimistic assignment version.

Customer retrieval validates ownership and active reservation. It returns the currently assigned immutable form plus exactly one answer set per admission. At order acceptance, Inventory locks/revalidates the hold, Pricing validates the quote, Events validates the form ID and answers, and Bookings records the form snapshot and encrypted answers in the same transaction as the order. Changed form assignment requires fresh review. After acceptance, later form changes cannot rewrite purchased registrations or invalidate their accepted version at payment initiation.

Supported fields are bounded text, email, phone, date, choice and declaration checkbox, with explicit purpose, required flags and bounded choices. No executable schema expressions, arbitrary regex, upload, identification-document attachment or hidden collection is allowed. A form with no fields explicitly disables collection for new orders; historical answers remain intact. Optional answers are not manufactured. Copying another attendee's data is not automatic.

Answers use dedicated AES-256-GCM key configuration, random nonces and order/owner-bound associated data. A keyed digest participates in idempotency without storing plaintext answers in command fingerprints, logs, outbox or audit. Customer retrieval requires order ownership. Provider export, retention/deletion, restricted field views and participant credentials remain separate required follow-up work. No production retention/compliance claim is made.

Transitions: authorized writer + expected assignment version → new immutable form; owner + current hold/quote/form + valid quantity/answers → accepted order/registration atomically; identical retry → original order; changed input under the same key → conflict. Encryption/configuration failure rolls back the entire placement. Lock order is occurrence → form assignment after actor/order serialization, consistent with registration configuration changes.

Scope: BE:EVT-08/09/10, BE:SPT-08, BE:BKG-01, BE:CUS-11; FE:EVT-UI-07/09, FE:SPT-UI-09, FE:OPS-E-03/04/05. Broader event/sports models, passes, forms by package/category, sensitive identification data, online-event access and browser acceptance remain incomplete.

Crypto API reference checked: [Node.js 26 crypto](https://nodejs.org/api/crypto.html#ciphersetaadbuffer-options). AAD is set before encryption/decryption updates; the authentication tag is obtained after finalization and verified during decryption finalization.
