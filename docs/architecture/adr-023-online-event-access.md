# ADR 023 — Protected online-event joining information

Status: implemented locally; browser and external meeting-provider acceptance pending.

FE:EVT-UI-10 and BE:EVT-11 require access limited to ticket holders and time windows. Events owns one versioned encrypted joining URL per occurrence. Organizers with write membership in the approved owning organization configure it from /partner/venues; public catalog and configuration responses never reveal it. An explicit customer POST on /bookings/:id reveals it only after authoritative checks.

Bookings supplies an injected OnlineEligibility port to Events, avoiding a reverse module dependency. The transaction locks the owned booking, occurrence, tickets and online configuration in that order. It requires a confirmed booking, open occurrence, and a valid unused owned ticket for that occurrence. Database time is read after acquiring locks; the window includes opening and excludes closing. Cancellation and ticket revocation invalidate subsequent reveals. Revealing does not consume an admission entitlement.

AES-256-GCM binds ciphertext to occurrence ID. A purpose-specific HMAC-derived key separates this use from ticket-token encryption while using the existing TICKET_ENCRYPTION_KEY master secret. This avoids another deployment secret but couples master-key rotation: retain or re-encrypt all online links along with ticket credentials before rotating. No raw link is stored in audit records. Missing encryption configuration rejects a new link rather than storing plaintext.

Reversible development policy: explicit windows up to seven days, independently selected by the organizer; no automatic default activation or requirement that the window equal the physical occurrence interval. Production approval of this policy remains outstanding. Updates use optimistic versions, preserving the encrypted URL when omitted. Lost-response retries with a stale version return conflict; reload exposes the committed metadata without the URL.

A disclosed shared third-party URL can be copied. Revocation here prevents future platform disclosure; it cannot retract already disclosed links or enforce attendee identity at an external meeting service. Use the meeting provider's own controls. This feature neither provisions meetings nor verifies external provider connectivity or admission.

Verification: existing real PostgreSQL/HTTP event and seated-event journeys now test encryption, strict HTTPS, owner isolation, version conflicts, metadata privacy, pending/cancelled booking denial, disabled/future/expired windows and preserving existing encrypted links. See online-access-full-suite.txt and online-access-container-tests.txt. Browser access host was unavailable.
