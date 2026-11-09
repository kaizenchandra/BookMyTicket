# Local cinema and sports demo

Verified app: http://127.0.0.1:3101

- Movies across demo cities: http://127.0.0.1:3101/movies?city=
- Sports across demo cities: http://127.0.0.1:3101/sports?city=
- Provider workspace: http://127.0.0.1:3101/partner/venues
- Local verification email inbox: http://127.0.0.1:8025

All seeded titles/teams/cast/venues are fictional and labeled DEMO. They are not real listings or admission offers. The demo operator is `demo-organizer@bookmyticket.test`; sign in through the actual local email OTP flow to manage its two organizations. No password, OTP or session token is stored in this document. Owner staff administration still requires authenticator MFA. No platform staff grants are seeded.

To book: select a movie or sports fixture, choose the **Free session**, select a seat or stand quantity, sign in, review the quote/policies, create the order and choose **Confirm free booking**. View the QR ticket under My Bookings. Its admission is a demo artifact. Before the configured deadline, review and confirm free cancellation to revoke tickets and restore capacity. Priced demo sessions cannot charge money; no Razorpay success is simulated.

To recreate the local setup using existing secret files:

```sh
node scripts/setup-compose.mjs
APP_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p bookmyticket-verify up -d --build --wait
APP_PORT=3101 docker compose -p bookmyticket-verify exec -T -e ALLOW_DEMO_SEED=1 app node --import tsx scripts/seed-demo.ts
```

The seed refuses non-development configuration, nonlocal hosts and unexpected database names. It preserves existing records. The successful seed was repeated and its summary was identical, with four movies, three fixtures and fourteen sessions. Do not reset holds/bookings to make a demonstration look available; cancellation must use the normal application workflow.

Evidence: `docs/evidence/demo-seed.json`, `demo-seed-repeat.json`, `demo-http-verification.json`, `cinema-sports-tests.txt`, `cinema-sports-full-suite.txt`, `cinema-sports-container-tests.txt`, `local-smoke.json`. The read-only demo verifier expects available demo capacity and verifies responses/images, not browser rendering. All authenticated category booking tests run in the isolated bookmyticket_test database.

External delivery, live payments/refunds, browser/a11y acceptance, season passes, concessions, advanced category operations and production deployment remain pending.

From v0.52.0, publishing newly submitted demo listings requires `DEMO_REVIEWER_ID` to reference an existing active platform moderator. The seed uses the real review authorization adapter and does not create moderation grants. Existing published demo listings need no new review. See [listing review recovery](listing-review-retries.md).
