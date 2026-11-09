# Ticket directions

Open a confirmed booking's ticket wallet. When the occurrence has a scheduled street address, each ticket shows it and offers Directions on Google Maps. The downloaded HTML ticket includes the same address/link. Calendar downloads include the scheduled address in LOCATION.

The link opens an external service and contains only a destination. Use the written address if maps, location access or the file viewer's link handling is unavailable. Check current booking notices before travelling. These links do not verify admission validity, and no location permission is requested by BookMyTicket.

If no address is shown, the occurrence's scheduling snapshot did not provide one. Do not substitute a current public venue address or mutate the protected snapshot as a shortcut. Controlled venue-change/remediation remains a separate workflow. If an encoded destination exceeds the supported URL length, the written address remains available without a link.

No migration or deployment secret is needed. The public Inventory contract and wallet response add nullable address/city/directions fields. Public venue edits do not rewrite scheduled addresses. Existing ticket ownership checks and no-store responses remain unchanged.

Evidence: docs/evidence/ticket-directions-{tests,full-suite,container-tests,build,deploy,smoke}.txt. Automated checks verify encoding, privacy, snapshot protection, HTML/calendar escaping and rendered fallbacks. External navigation, offline-file viewer, browser/print/keyboard/accessibility and venue-relocation acceptance remain unverified.
