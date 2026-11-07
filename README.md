# BookMyTicket

India/INR ticket-booking platform under active implementation. **Not a completed or production-ready platform.** No live payment, external email delivery, supplier, payout or cloud deployment has been verified. Local Mailpit SMTP signup/login is verified.


Current local demo (**v0.14.0**): [Movies](http://127.0.0.1:3101/movies?city=) · [Sports](http://127.0.0.1:3101/sports?city=) · [Provider workspace](http://127.0.0.1:3101/partner/venues).

The user-requested sample catalog contains **4 fictional movies, 3 sports fixtures and 14 sessions**, clearly labeled DEMO. Choose a **Free session** to test actual reservation → confirmation → QR ticket → cancellation. Priced demo sessions cannot collect real payments. [Demo setup, operator sign-in and limits](docs/runbooks/cinema-sports-demo.md).

Implemented subsets include PostgreSQL reservations, immutable commercial quotes and accepted orders, confirmation and ticket/ledger transactions, OTP controls and authenticator MFA, published discovery, onboarding drafts, support cases, customer payment initiation/recovery, session management, listing favorites and initial role interfaces. The customer appearance is inferred: browser access to the reference was unavailable.

- [Current progress and blockers](docs/progress.md)
- [Verified development commands](docs/development.md)
- [Architecture and decisions](docs/architecture/initial-design.md)
- [Requirement register](docs/requirements/traceability.md)
- [Actual integration test results](docs/evidence/integration-tests.txt)
- [Local HTTP smoke results](docs/evidence/local-smoke.json)

The root frontend/backend specifications and prompt remain the complete acceptance scope. No MVP substitution is intended. Existing source requirement files and IDE changes have been preserved.

Local Compose setup: `node scripts/setup-compose.mjs`, then `docker compose up --build -d --wait`. See [development instructions](docs/development.md) for isolated container tests and recovery checks. The verified deployment is at http://127.0.0.1:3101 (separate verification project); the default Compose port is 3100.

- [Remaining implementation phases](docs/implementation-phases.md)

Version 0.4.0 adds the `/partner/venues` catalog/venue/plan/scheduling workspace and saved seating metadata in the customer journey. Full acceptance scope remains open.

### Local email verification

The running app is http://127.0.0.1:3101 and its Mailpit inbox is http://127.0.0.1:8025. Request a verification code in the app, read it in Mailpit, and enter it to sign up or log in. Emails are captured locally, not delivered externally. See [setup and verification](docs/runbooks/local-email-login.md).

Version 0.8.0 adds the support case workspace at `/operations`: authorized agents can filter and claim cases, set priority, escalate, resolve/reopen, and send explicitly labeled customer replies or internal notes. A platform support grant and fresh MFA are required. See [workflow decisions and remaining scope](docs/architecture/adr-011-support-workflow.md).

Version 0.9.0 adds staff invitations and role management in `/partner`. Owners verify MFA in account security, invite an email as editor/viewer, and manage access; recipients sign in with that verified email and accept in the partner portal. Invitations expire after seven days. No invitation email is sent. See [workflow and limitations](docs/architecture/adr-012-provider-staff.md).

Version 0.10.0 adds `/notifications`: persisted booking confirmation, pending cancellation and payment recovery notices with read/unread state and booking links. Support staff can inspect exhausted inbox deliveries and request audited replay in `/operations`. These are in-app messages, not external email/SMS deliveries. See [delivery design and limits](docs/architecture/adr-013-in-app-notifications.md).

Version 0.11.0 supports explicitly authorized free bookings. Pricing staff approve a new policy with “Authorize free bookings” in `/admin/pricing` and assign it to an occurrence. When the full quote is ₹0, customers accept the policies and choose “Confirm free booking”; the server consumes inventory and issues tickets without a payment transaction. Existing policies do not authorize this by default. See [eligibility and transaction rules](docs/architecture/adr-014-free-bookings.md).

Version 0.12.0 adds full cancellation of confirmed free bookings when the accepted policy explicitly allows it before a configured cutoff. Customers review affected tickets and confirm cancellation; unused tickets are revoked and capacity is returned atomically. No refund is due for these zero-total bookings. Paid/partial cancellation is not included. See [policy and concurrency rules](docs/architecture/adr-015-free-cancellation.md).
