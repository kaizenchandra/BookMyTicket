# Flight supplier administration

Open `/admin/flights` after an access administrator assigns `flights.read` and the account completes MFA. Assign `flights.manage` for supplier creation/editing and `pricing` for commercial configuration. No privileges are granted automatically.

Register a stable lowercase supplier code, display name, two-character airline IATA codes and sandbox/production label. These are metadata only; entering production does not connect a supplier. API secrets must not be entered in profile fields. Profiles remain draft or suspended pending a real integration. Search by supplier name/code and filter status; cursors preserve filters.

Edits require a reason, confirmation and current version. Reload on a stale-version conflict before resubmitting. Create retries use the same idempotency key for unchanged payloads; the unique supplier code also prevents duplicate registration after a reload. Suspended metadata does not cancel external bookings—none are integrated.

Commercial rules use INR integer paise and markup basis points (100 basis points = 1%). Markup applies to base fare; supplied tax passes through; fees are fixed paise. Preview accepts manually entered numbers, explicitly returns `bookable:false`, and is not supplier availability or a quote. Commission, fee tax treatment and checkout application await the integration contract.

Blocked: live flight search, cabins/baggage/fare families, PNR/ticket status, disruption and fare discrepancy handling, supplier sync errors, revalidation/reservation/ticketing/reconciliation and supplier cancel/void/refund workflows. Supply the authorized provider name, official API documentation and secure sandbox configuration location to implement these. Do not paste credentials into chat or profile fields.

Migration 076 adds flights-owned tables and extends the admin role permission allowlist. Existing movie/event/sports bookings and grants are preserved. Tests are in `tests/flight-administration.test.ts`; full-suite and deployment evidence use `docs/evidence/flight-management-*`. Browser acceptance remains separate from HTTP/database checks.
