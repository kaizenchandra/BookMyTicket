# Cab & transfer management

Open `/admin/cabs`. Assign `cabs.read` for catalogue/history/estimates and additionally `cabs.manage` for changes; authenticate with current MFA. No existing account receives these grants automatically.

1. Create suppliers with stable codes, business contacts and contract references. Do not enter credentials in these fields.
2. Create vehicle categories with passenger/luggage limits and amenities.
3. Create a city, airport-transfer or outstation service. Choose active supplier/category records with searchable pickers. Specify directional endpoints (use an airport code for the airport endpoint), ISO timestamps with timezone, maximum/included metres and tariff values in **paise**. City endpoints must match. Configure cancellation/rescheduling policy text.
4. Use the fare estimate form to provide pickup time, distance, total duration, waiting, passengers and luggage. The server validates coverage and current capacity rules. Estimates exclude taxes, tolls and parking. They are not live supplier quotes or confirmed availability.
5. Edit with a reason and confirmation. Conflicts require reloading the latest version. Changes to current category limits affect subsequent previews. Lists support name/code/status, supplier/category IDs and overlapping coverage-window filters, with first/next pagination. History shows before/after snapshots and reasons.
6. Record local disruptions, resolve them or permanently withdraw a service. Withdrawal does not cancel bookings, send notifications or issue refunds.

FR-10 is partial. No authorized cab supplier is configured: live vehicle availability, reservations, trip/booking/cancellation status, rescheduling, supplier escalation, actual trip charges and reconciliation are unavailable. To complete these, supply the authorized provider name, official booking/status/cancellation API contract and secure sandbox configuration location (not secret values in chat). Do not treat configured service coverage as available vehicles.

Migration: `082_cab_catalogue.sql`. APIs: GET/POST `/api/v1/admin/cabs/:kind`, GET/PATCH `/:kind/:id`, GET `/:kind/:id/history`, POST `/services/:id/preview` and `/services/:id/disruptions`; kinds are suppliers/categories/services. Create requires Idempotency-Key; edits/actions/preview require expectedVersion. See generated OpenAPI for schemas.

Verified: production build, architecture checks and 276 native integration tests. Browser acceptance remains unverified.
