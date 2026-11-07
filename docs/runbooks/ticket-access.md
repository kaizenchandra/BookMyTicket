# Customer ticket access

Open `/bookings/:id` while signed in as the booking owner. The wallet reads current order, occurrence and entitlement data. Confirmed bookings display each issued ticket's status and QR where appropriate. Pending orders show no admission credential; confirmed orders with incomplete issuance explicitly report pending tickets.

The **Download printable tickets** action requests an authenticated HTML attachment containing embedded QR images, readable IDs, venue-local times, gate information when available, policy instructions and a synchronization timestamp. Open the saved file and use the browser Print command. This is portable offline display only: the admission server still determines validity. Never publish or forward the file as a public link. Revocation or admission after download cannot remove already-saved credentials; scanners must always check the server.

The **Add to calendar (.ics)** action returns RFC 5545 events using current occurrence times. Instants are encoded in UTC and the venue-local IANA zone remains in the description. Event IDs identify occurrences, not customers. No ticket credential, attendee answers or customer contact is included. Static calendar imports are not subscriptions; import again after checking schedule changes. A cancelled occurrence produces cancelled event status.

## Routes and compatibility

- `GET /api/v1/bookings/:id/tickets`: owner-only wallet response, synchronization time, issuance state and per-ticket status/QR SVG. The former development response exposed raw `token`; the new contract intentionally provides QR SVG and does not expose that raw field. No production client compatibility is claimed.
- `GET /api/v1/bookings/:id/tickets/download`: owner-only, confirmed-order HTML attachment with escaped metadata, embedded images, no script or external assets, restrictive CSP and no-store headers.
- `GET /api/v1/bookings/:id/calendar`: owner-only, confirmed-order calendar attachment, independent of ticket-key configuration or QR rendering.

Rendering never issues new tickets. Retry document retrieval after fixing configuration; do not delete/reissue entitlements to repair a document failure. `TICKETING_UNAVAILABLE` requires checking the protected `TICKET_ENCRYPTION_KEY` configuration without printing it. Preserve the key with encrypted backups; historical key rotation/recovery is not automated. The existing development admission window is one hour before start through event end; configurable product policies remain outstanding.

## Evidence and limits

Nine ticket tests exercise real PostgreSQL/application components: owner isolation, stable independently decoded QR data, per-ticket status suppression, explicit incomplete issuance, malicious-text escaping, UTF-8 calendar folding parsed by an independent library, UTC conversion of an after-midnight India show, authenticated download headers, configuration outage/retry, and decoded QR through authorized HTTP admission. Capture and incomplete-issuance fixtures are isolated test inputs, not live payment evidence.

81 total tests pass natively and in Linux containers. 26 deployed HTTP checks pass. Build/typecheck, architecture checks, contract generation and dependency audit passed; the audit reported zero vulnerabilities at execution time, not a security certification. Local restart and fixture restore include ticket/admission counts, but do not verify historical decryption because fixture keys are ephemeral.

Browser access remains unavailable. QR screen presentation, physical scanning, actual browser printing, viewport/a11y/theme acceptance and visual fidelity are unverified. PDF generation, resend/delivery, directions, complete attendee-to-entitlement mapping, configurable entry policies, transfers/cancellations/refunds and offline admission are not provided by this slice.
