# ADR 018 — account communication preferences

Decision: Profiles owns language preference and optional email-marketing consent. The customer edits these at `/profile` using authenticated GET/PUT `/api/v1/profile/communications`. Contact identity is never accepted from the request. Existing name/city/theme saves remain separate and cannot overwrite consent.

Marketing defaults to false. Policy version 1 text is displayed beside an unchecked checkbox. Grant and withdrawal append purpose, policy version, database timestamp and preference version in the same transaction as current state. No campaign sender or external subscription is created. Transactional booking/security inbox delivery remains independent of marketing permission. Language is stored for future supported communication localization; the English interface is not presented as translated.

The first write inserts the account row if absent, then locks it. Writes require the current version; an identical retry at the immediately following version returns the original state without another history entry. Changed stale requests return 409. The UI keeps edits after errors and offers an explicit reload of saved values. Row locks also serialize first-write races. No deletion/update API exists for consent history.

Verification: `tests/communication-preferences.test.ts` exercises real PostgreSQL and HTTP authentication, eight concurrent identical writes, changed-payload conflict, unsupported consent version, owner-field injection, another account's default state and grant/withdrawal history. Browser and accessibility acceptance remain separate. Marketing campaign dispatch must check current permission at execution time when implemented; this feature does not claim full BE:NTF-10 fulfillment.

Outstanding: transactional channel controls, actual localized templates, campaigns/unsubscribe links, broader attendee/privacy consent, exports/deletion and retention policy.
