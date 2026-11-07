These requirements define the intended product; they do not claim that every feature exists on the reference website.

**1. Scope and requirement conventions**

The frontend shall provide six role-specific experiences:

| Experience | Users |
|---|---|
| Customer application | Visitors and registered customers |
| Cinema partner portal | Cinema owners, managers, and authorized staff |
| Organizer portal | Event and sports organizers |
| Administration console | Platform administrators and moderators |
| Support and finance console | Support agents, finance staff, and authorized reviewers |
| Admission application | Gate staff and supervisors |

Requirements below are mandatory unless explicitly described as conditional or optional. Conditional features must be fully functional when enabled and absent or clearly unavailable when disabled.

The frontend shall communicate with the modular monolith through documented APIs. It shall never directly access databases or independently determine authoritative availability, payment success, refund eligibility, or permissions.

Use these frontend IDs alongside the original requirements in the traceability matrix.

**2. Application structure and navigation**

- **NAV-01 — Global header:** Provide platform identity, global search, selected city, account access, theme toggle, and primary category navigation.
- **NAV-02 — Category navigation:** Provide Movies, Events, and Sports. Display Offers and other supported destinations only when implemented.
- **NAV-03 — Account navigation:** Provide My Bookings, Favorites, Notifications, Profile, Preferences, and Help.
- **NAV-04 — Responsive navigation:** Adapt desktop navigation to a usable mobile header, drawer, or bottom navigation without removing essential actions.
- **NAV-05 — Active location:** Clearly indicate the current page, category, and selected city.
- **NAV-06 — Deep links:** Support direct links to listings, occurrences, venue pages, bookings, support cases, and authorized operational records.
- **NAV-07 — Browser history:** Back and Forward shall restore appropriate filters, pagination, scroll position, and valid selections.
- **NAV-08 — Protected routes:** Redirect unauthenticated users to sign-in while preserving a safe return destination.
- **NAV-09 — Unauthorized routes:** Show an access-denied screen without exposing protected information.
- **NAV-10 — Missing content:** Show useful not-found, unpublished, expired-link, and removed-listing states.
- **NAV-11 — Unsaved changes:** Warn before discarding meaningful unsaved provider/admin form changes.
- **NAV-12 — Footer:** Provide working links to support, policies, accessibility information, partner onboarding, and platform contact information.

**3. Visual design and reference fidelity**

- **VIS-01 — Reference audit:** Record the reference city, viewport, page, and observation date when collecting design evidence.
- **VIS-02 — Layout fidelity:** Match observed header composition, navigation hierarchy, content widths, poster ratios, card density, spacing, filters, and booking flows.
- **VIS-03 — Evidence limits:** Label unobserved screens as inferred designs; do not describe them as pixel-perfect reproductions.
- **VIS-04 — Design system:** Define reusable tokens for spacing, typography, colors, radii, shadows, borders, motion, and stacking order.
- **VIS-05 — Consistent components:** Reuse buttons, cards, form controls, chips, alerts, dialogs, drawers, tables, and status badges.
- **VIS-06 — Primary action:** Make the next meaningful action visually obvious on each screen.
- **VIS-07 — Content hierarchy:** Prioritize title, date, venue, availability, price, and booking action over secondary content.
- **VIS-08 — Media:** Preserve image aspect ratios; provide useful fallbacks for missing or failed images.
- **VIS-09 — Motion:** Use restrained transitions; respect reduced-motion preferences.
- **VIS-10 — Honest presentation:** Never display fabricated sales counts, ratings, scarcity messages, testimonials, or countdowns.
- **VIS-11 — Operational interfaces:** Extend the customer design language into provider/admin interfaces while prioritizing task efficiency.
- **VIS-12 — Branding:** Use configured platform branding and available licensed media without implying the application is the official BookMyShow service.

**4. Light and Dark themes**

- **THM-01:** Provide exactly two themes: **Light** and **Dark**.
- **THM-02:** Do not provide an Auto/System option.
- **THM-03:** Default new visitors to Light unless product configuration explicitly specifies Dark.
- **THM-04:** Persist the selected theme across navigation, refresh, and return visits.
- **THM-05:** If profile synchronization exists, define deterministic precedence between saved account preference and local preference.
- **THM-06:** Apply themes to all customer, partner, admin, finance, support, and scanner screens.
- **THM-07:** Theme dialogs, tooltips, charts, tables, seat maps, notifications, loading states, and error screens.
- **THM-08:** Prevent an incorrect-theme flash during initial rendering.
- **THM-09:** Preserve readable contrast, visible focus, and distinguishable status indicators.
- **THM-10:** Give the toggle an accessible label and expose its current state.
- **THM-11:** Theme changes shall not reset forms, filters, selections, or reservations.
- **THM-12:** Use supported customization for third-party checkout; document external styling limitations.

**5. Location and city selection**

- **LOC-01:** Allow searching cities by name and selecting from configured popular cities.
- **LOC-02:** Request geolocation only after a clear user action or explanation.
- **LOC-03:** Provide manual selection when permission is denied, location fails, or the city is unsupported.
- **LOC-04:** Remember the selected city.
- **LOC-05:** Refresh city-dependent discovery and availability after selection.
- **LOC-06:** Display an explicit unsupported-city state with available alternatives.
- **LOC-07:** When changing city during booking, explain the effect on the current selection before discarding it.
- **LOC-08:** For a shared listing outside the selected city, display the actual location and offer an explicit city switch.
- **LOC-09:** Do not silently mix results from different cities; label nearby or out-of-city recommendations.
- **LOC-10:** Display dates and times in the occurrence’s local time zone, including a zone label where ambiguity is possible.

**6. Authentication, account security, and profile**

- **AUTH-01:** Allow anonymous browsing; require identity verification before booking completion.
- **AUTH-02:** Support configured phone/email OTP authentication.
- **AUTH-03:** Validate contact format and display a masked delivery destination.
- **AUTH-04:** Support OTP paste, appropriate autofill, resend cooldown, expiry, and contact correction.
- **AUTH-05:** Display invalid-code, expired-code, delivery-failure, rate-limit, and attempt-limit states.
- **AUTH-06:** Preserve safe booking context through authentication without extending the server reservation.
- **AUTH-07:** Explain when a reservation expires during sign-in.
- **AUTH-08:** Support logout and session-expiry recovery.
- **AUTH-09:** Require supported MFA and recovery flows for privileged staff.
- **AUTH-10:** Provide session/device management if supported, including revoking other sessions.
- **AUTH-11:** Require reauthentication for sensitive changes when instructed by the backend.
- **AUTH-12:** Clear user-specific cached data when logging out or switching accounts.

Profile functions:

- **PRO-01:** View and update permitted name and contact fields.
- **PRO-02:** Verify changed phone/email details before treating them as confirmed.
- **PRO-03:** Manage language and notification preferences.
- **PRO-04:** Manage optional saved attendee details with explicit consent.
- **PRO-05:** Request personal-data export and track its status.
- **PRO-06:** Request account deletion and show retention-related limitations.
- **PRO-07:** Display validation errors without unnecessarily erasing entered information.
- **PRO-08:** Distinguish required transactional communication from optional marketing preferences.

**7. Homepage and discovery**

- **DIS-01:** Display city-specific movie, event, and sports collections.
- **DIS-02:** Support editorial banners linked to actual destinations.
- **DIS-03:** Separate Now Showing and Coming Soon movies.
- **DIS-04:** Display upcoming events, sports fixtures, and relevant category collections.
- **DIS-05:** Show cards with title, image, location, date where appropriate, category, and price information.
- **DIS-06:** Use “from” pricing only when the backend supplies a valid available starting price.
- **DIS-07:** Label sponsored or promoted placements where applicable.
- **DIS-08:** Provide “View all” links for truncated collections.
- **DIS-09:** Support keyboard and touch navigation for carousels.
- **DIS-10:** Pause automatic carousel motion through an accessible control if autoplay is used.
- **DIS-11:** Show useful empty states for cities without listings.
- **DIS-12:** Recommendations must reflect actual catalog data; provide a non-personalized fallback.
- **DIS-13:** Preserve a stable layout while images and collections load.

**8. Search, filtering, and sorting**

- **SRC-01:** Search movies, events, sports fixtures, artists, teams, competitions, venues, and cinemas.
- **SRC-02:** Provide grouped suggestions with distinguishing metadata.
- **SRC-03:** Support keyboard selection and dismissal of suggestions.
- **SRC-04:** Cancel or disregard stale responses so older searches cannot overwrite newer results.
- **SRC-05:** Provide full results pages with result counts where available.
- **SRC-06:** Support category-specific filters, including date, language, genre, sport, team, venue, format, price, and accessibility.
- **SRC-07:** Display active filters and allow individual removal or Clear All.
- **SRC-08:** Support explicit Apply/Reset behavior for mobile filter drawers.
- **SRC-09:** Preserve filters and sorting in shareable URLs.
- **SRC-10:** Support meaningful sort options using actual backend-supported criteria.
- **SRC-11:** Distinguish no matching results from failed requests.
- **SRC-12:** Suggest clearing restrictive filters when appropriate.
- **SRC-13:** Support pagination or progressive loading with accessible controls and restored navigation state.
- **SRC-14:** Retain typed input after recoverable errors.
- **SRC-15:** Do not display unpublished records or inaccessible provider content.

**9. Movie details and showtime selection**

- **MOV-UI-01:** Display poster, title, synopsis, trailer, release date, duration, certification, genres, languages, and formats.
- **MOV-UI-02:** Display cast and crew where supplied.
- **MOV-UI-03:** Show ratings and review counts only from real data.
- **MOV-UI-04:** Provide Save, Share, and Book actions.
- **MOV-UI-05:** For Coming Soon titles, provide an available notification option instead of a nonfunctional booking button.
- **MOV-UI-06:** Allow date, language, and format selection.
- **MOV-UI-07:** Group showtimes by cinema.
- **MOV-UI-08:** Display cinema address, amenities, accessibility, and relevant policies.
- **MOV-UI-09:** Filter cinemas/showtimes by area, time, price, and supported facilities.
- **MOV-UI-10:** Distinguish available, limited, sold-out, closed, and cancelled showtimes.
- **MOV-UI-11:** Display the actual calendar date for after-midnight shows.
- **MOV-UI-12:** Present age/certification and venue conditions before purchase.
- **MOV-UI-13:** If a show disappears or closes, explain why the user cannot proceed and offer alternatives.
- **MOV-UI-14:** Preserve movie and filter context when returning from seat selection.

**10. Event details and registration**

- **EVT-UI-01:** Display description, performers, organizer, venue, schedule, duration, age restrictions, inclusions, exclusions, and entry instructions.
- **EVT-UI-02:** Support single sessions, recurring sessions, multiple dates, and multi-day passes.
- **EVT-UI-03:** Clearly identify the selected session and covered dates.
- **EVT-UI-04:** Show ticket categories, prices, quantities, availability, and category-specific benefits.
- **EVT-UI-05:** Explain whether a package admits one person, a couple, a group, or multiple visits.
- **EVT-UI-06:** Display assigned seating, standing areas, or general admission as configured.
- **EVT-UI-07:** Render backend-defined attendee forms with required fields and validation.
- **EVT-UI-08:** Allow copying buyer details where appropriate without unintentionally duplicating every attendee.
- **EVT-UI-09:** Display applicable declarations and policy acknowledgments.
- **EVT-UI-10:** Show online-event joining information only to authorized ticket holders.
- **EVT-UI-11:** Display cancellation, postponement, or venue-change notices prominently.
- **EVT-UI-12:** Prevent booking closed sessions while retaining their informational pages where appropriate.

**11. Sports discovery and booking**

- **SPT-UI-01:** Display sport, tournament, participants, fixture date/time, venue, and entry time.
- **SPT-UI-02:** Support sport, team, competition, city, date, venue, and price filters.
- **SPT-UI-03:** Support stadium stand, level, block, gate, and seating category selection.
- **SPT-UI-04:** Explain restricted views, hospitality benefits, and accessible seating where supplied.
- **SPT-UI-05:** Support reserved seating and unreserved stands.
- **SPT-UI-06:** Clearly identify fixtures covered by multi-match or season passes.
- **SPT-UI-07:** Explain whether seating is fixed or varies across covered fixtures.
- **SPT-UI-08:** Collect identification details only when required and explain the entry requirement.
- **SPT-UI-09:** Support participant registration for races and similar sports, including category, emergency contact, and configured declarations.
- **SPT-UI-10:** Display collection instructions for physical credentials or race kits when relevant.
- **SPT-UI-11:** Show postponement, abandonment, and cancellation decisions with current ticket-validity information.

**12. Venue pages**

- **VEN-01:** Display venue name, address, map/directions link, and contact information where permitted.
- **VEN-02:** Show amenities, accessibility, transport/parking guidance, and entry policies.
- **VEN-03:** List upcoming available occurrences.
- **VEN-04:** Show venue photographs or maps when supplied.
- **VEN-05:** Distinguish venue-wide information from occurrence-specific restrictions.
- **VEN-06:** Explain external map navigation and handle blocked location access gracefully.

**13. Seat maps and ticket quantities**

- **SEA-01:** Display the correct occurrence-specific seating-plan version.
- **SEA-02:** Show screen/stage/field orientation, sections, rows, seats, and price categories.
- **SEA-03:** Distinguish available, selected, held/unavailable, sold, blocked, accessible, and companion seats using labels or shapes as well as color.
- **SEA-04:** Provide zoom, pan, reset, and a readable legend.
- **SEA-05:** Provide an accessible list or equivalent selection mechanism.
- **SEA-06:** Display selected seats, quantity, category, and price summary.
- **SEA-07:** Allow deselection and modification before checkout.
- **SEA-08:** Enforce server-provided minimum/maximum quantities and configured selection rules.
- **SEA-09:** Explain companion-seat and accessible-seat conditions without inventing restrictions.
- **SEA-10:** Do not label a locally selected seat as reserved until the backend confirms the hold.
- **SEA-11:** If another customer obtains a selected seat, identify the conflict and offer reselection.
- **SEA-12:** Never silently replace seats or increase price.
- **SEA-13:** For all-or-nothing group reservations, show failure for the full selection when the server rejects it.
- **SEA-14:** General-admission controls shall show category availability and valid quantity limits.
- **SEA-15:** Refresh availability after reconnect, tab focus, and relevant conflicts.
- **SEA-16:** If real-time updates fail, use supported refresh behavior and display connection status when it affects booking.

**14. Reservations and double-booking-related UX**

The backend prevents double booking; the frontend must accurately represent reservation status.

- **RSV-01:** Display a countdown derived from server-provided expiry.
- **RSV-02:** Recalculate time after backgrounding, device sleep, refresh, or clock changes.
- **RSV-03:** Refreshing the page must not extend the reservation.
- **RSV-04:** Show meaningful expiry warnings without announcing every second to screen readers.
- **RSV-05:** On expiry, stop new payment initiation until the backend revalidates the order.
- **RSV-06:** Preserve non-sensitive form data when safe, but require new inventory confirmation.
- **RSV-07:** Treat release actions as best effort; do not rely on closing the browser to free inventory.
- **RSV-08:** Synchronize booking status across tabs and prevent contradictory “Pay now” states where possible.
- **RSV-09:** Prevent duplicate clicks while requests are processing.
- **RSV-10:** Reuse the relevant operation identifier when retrying uncertain requests.
- **RSV-11:** Never optimistically mark payment, booking, cancellation, refund, or admission as successful.
- **RSV-12:** Clearly distinguish “selected,” “reserved,” “payment processing,” and “booking confirmed.”

**15. Add-ons and packages**

- **ADD-01:** Display supported food, beverages, parking, or other authorized extras with price and availability.
- **ADD-02:** Allow explicit addition, quantity changes, and removal.
- **ADD-03:** Do not preselect chargeable extras.
- **ADD-04:** Display relevant collection, fulfillment, dietary, or eligibility information.
- **ADD-05:** Revalidate stock before checkout.
- **ADD-06:** Explain when unavailable extras are removed or require replacement.
- **ADD-07:** Separate add-on charges in the summary.
- **ADD-08:** Display cancellation/refund treatment for extras separately where it differs from tickets.

**16. Checkout and pricing**

- **CHK-UI-01:** Display listing, occurrence, venue, seats/categories, quantity, attendees, and extras.
- **CHK-UI-02:** Provide an obvious path to edit selections.
- **CHK-UI-03:** Validate buyer contact details and required attendee information.
- **CHK-UI-04:** Show ticket subtotal, extras, discounts, fees, taxes, and final total.
- **CHK-UI-05:** Use currency formatting consistently and display server-calculated totals.
- **CHK-UI-06:** Allow coupon application/removal and display eligibility failures.
- **CHK-UI-07:** Explain discount allocation where needed for cancellation understanding.
- **CHK-UI-08:** Require fresh review if the server changes the quote.
- **CHK-UI-09:** Display relevant cancellation, admission, age, and identification conditions before payment.
- **CHK-UI-10:** Keep marketing consent separate from required booking acknowledgments.
- **CHK-UI-11:** Label the final action with the payable amount where practical.
- **CHK-UI-12:** Do not silently create a multi-provider cart; explain supported booking combinations.
- **CHK-UI-13:** For free or authorized complimentary bookings, use an appropriate confirmation action without inventing a payment.
- **CHK-UI-14:** Collect optional invoice information only when supported and explain whether it can be changed later.

**17. Razorpay payment experience**

- **PAY-01:** Initialize checkout from backend-created payment/order data.
- **PAY-02:** Offer UPI, credit cards, and debit cards only where enabled and supported.
- **PAY-03:** Never collect raw card details in platform-owned custom fields.
- **PAY-04:** Explain redirection or switching to a payment application when applicable.
- **PAY-05:** Handle checkout-script load failure, popup restrictions, dismissal, and connectivity failure.
- **PAY-06:** After a provider callback, retrieve authoritative platform status.
- **PAY-07:** Distinguish payment processing, verification pending, payment failed, booking confirming, and booking confirmed.
- **PAY-08:** Closing checkout must not automatically imply payment failure.
- **PAY-09:** Provide “Check status” when the result is uncertain.
- **PAY-10:** Do not encourage another payment while an earlier attempt remains unresolved.
- **PAY-11:** Allow retry only when the backend indicates it is safe.
- **PAY-12:** Recover status after browser closure or redirect failure through My Bookings.
- **PAY-13:** If payment succeeds but inventory cannot be secured, show the actual refund/recovery status.
- **PAY-14:** Surface duplicate-charge investigations without creating a duplicate booking.
- **PAY-15:** Show payment references and support options without exposing secrets.
- **PAY-16:** Clearly identify test environments; never describe test payments as live transactions.

**18. Confirmation and digital tickets**

- **TKT-01:** Show confirmation only after authoritative booking confirmation.
- **TKT-02:** Display booking reference, occurrence, venue, seats/categories, attendees, and payment summary.
- **TKT-03:** Show ticket issuance as pending if booking is confirmed but ticket generation is incomplete.
- **TKT-04:** Provide ticket display, download, and print where supported.
- **TKT-05:** Show secure QR/barcodes with readable ticket identifiers.
- **TKT-06:** Display gate, admission window, identification rules, and entry instructions.
- **TKT-07:** Support multiple tickets and partial status differences within one booking.
- **TKT-08:** Provide Add to Calendar and directions actions.
- **TKT-09:** Allow resend to verified contact details with rate-limit feedback.
- **TKT-10:** Do not expose ticket tokens in analytics, public share links, or unnecessary URL parameters.
- **TKT-11:** Distinguish downloadable ticket access from live validity verification.
- **TKT-12:** Mark revoked, cancelled, transferred, redeemed, and expired tickets appropriately.
- **TKT-13:** If offline ticket display is supported, show last synchronization time and avoid promising current validity.

**19. My Bookings, cancellations, refunds, and transfers**

- **BKG-01:** Provide upcoming, past, pending, cancelled, and partially cancelled bookings.
- **BKG-02:** Support search by reference/title and useful date/status filters.
- **BKG-03:** Show a timeline of relevant booking, payment, refund, and disruption events.
- **BKG-04:** Display eligible actions supplied by the backend.
- **BKG-05:** Explain why cancellation or modification is unavailable.
- **BKG-06:** Before cancellation, show selected tickets, deductions, expected refund, and affected extras.
- **BKG-07:** Require explicit confirmation for cancellation.
- **BKG-08:** Support partial cancellation only when permitted.
- **BKG-09:** Handle stale cancellation quotes by refreshing them before confirmation.
- **BKG-10:** Show cancellation and refund as separate statuses.
- **BKG-11:** Display refund reference, amount, method, and provider-supplied estimate.
- **BKG-12:** Provide recovery/support paths for failed or delayed refunds.
- **BKG-13:** Support attendee edits and rescheduling only when configured.
- **BKG-14:** For transfers, show recipient verification, pending acceptance, expiry, and final ticket replacement.
- **BKG-15:** Explain the status of the sender’s original ticket after transfer.
- **BKG-16:** Display postponement and venue-change notices with available choices.
- **BKG-17:** Preserve historical booking information after listing changes.

**20. Favorites, alerts, reviews, and support**

- **ENG-01:** Save/remove supported listings, artists, teams, and venues.
- **ENG-02:** Preserve a requested Save action through sign-in where safe.
- **ENG-03:** Allow explicit subscription/unsubscription to availability alerts.
- **ENG-04:** Display notification read/unread status and deep links.
- **ENG-05:** Clearly distinguish waitlist membership from a ticket reservation.
- **ENG-06:** Show availability-offer expiry where applicable.
- **ENG-07:** Allow eligible customers to submit/edit reviews.
- **ENG-08:** Show moderation, rejection, reporting, and deletion outcomes where supported.
- **ENG-09:** Do not invent reviews or alter submitted ratings in presentation.

Support:

- **SUP-C-01:** Provide searchable FAQs and contextual booking help.
- **SUP-C-02:** Allow case creation with booking reference, category, description, and supported attachments.
- **SUP-C-03:** Show upload progress, file restrictions, and failures.
- **SUP-C-04:** Provide case status, conversation history, and follow-up replies.
- **SUP-C-05:** Warn users not to submit payment secrets or OTPs.
- **SUP-C-06:** Show actual support availability and response estimates only when configured.
- **SUP-C-07:** Provide an accessible escalation path for unresolved cases.

**21. Provider onboarding and organization management**

- **PRV-01:** Support cinema, event, and sports provider onboarding.
- **PRV-02:** Collect organization, contact, business, and payout-reference information required by the configured workflow.
- **PRV-03:** Allow save-and-resume onboarding.
- **PRV-04:** Show document upload state and validation.
- **PRV-05:** Display submitted, under review, changes requested, approved, rejected, and suspended statuses.
- **PRV-06:** Explain requested corrections and allow resubmission.
- **PRV-07:** Support organization switching for authorized multi-organization users.
- **PRV-08:** Clear organization-specific cached data on switching.
- **PRV-09:** Invite staff, manage role assignments, revoke access, and resend valid invitations.
- **PRV-10:** Explain role permissions before assigning them.
- **PRV-11:** Protect sensitive payout changes with the required reauthentication/approval workflow.
- **PRV-12:** Mask sensitive information and expose it only when authorized.

**22. Provider catalog, venue, and seating management**

- **CAT-01:** Create/edit listings with category-specific fields.
- **CAT-02:** Support media upload, crop/preview where appropriate, ordering, alternative text, and removal.
- **CAT-03:** Provide customer-facing preview without publishing.
- **CAT-04:** Show required-field completeness and validation.
- **CAT-05:** Support draft, submitted, changes requested, approved, published, suspended, and archived states.
- **CAT-06:** Show moderation reasons and revision history.
- **CAT-07:** Warn when editing content that affects active bookings.
- **CAT-08:** Display concurrent-edit conflicts and provide refresh/review recovery.

Venue/seating management:

- **CAT-09:** Manage venues, screens, sections, rows, seats, gates, and accessibility.
- **CAT-10:** Provide seat-plan creation/import and an accurate customer preview.
- **CAT-11:** Detect duplicate labels, invalid sections, and invalid capacity configuration.
- **CAT-12:** Support accessible and companion-seat designation.
- **CAT-13:** Version seating plans and display affected occurrences.
- **CAT-14:** Prevent destructive changes to sold seating without an authorized migration workflow.
- **CAT-15:** Show customer-impact previews before publishing significant changes.

**23. Cinema, event, and sports operations**

Cinema:

- **OPS-C-01:** Schedule movies by screen, date, time, language, and format.
- **OPS-C-02:** Display schedule conflicts and configured turnaround requirements.
- **OPS-C-03:** Manage show pricing, sales windows, allocations, and policies.
- **OPS-C-04:** Support bulk scheduling with preview and per-row validation.
- **OPS-C-05:** Manage food/add-on availability and fulfillment information.

Events:

- **OPS-E-01:** Create sessions, recurring schedules, and multi-day offerings.
- **OPS-E-02:** Configure ticket categories, sales phases, quantities, and package inclusions.
- **OPS-E-03:** Build attendee forms with field types, required status, options, and validation.
- **OPS-E-04:** Preview forms as a customer.
- **OPS-E-05:** Explain the effect of form changes on existing registrations.

Sports:

- **OPS-S-01:** Manage teams, competitions, fixtures, and stadium assignments.
- **OPS-S-02:** Configure stands, blocks, gates, hospitality, and ticket limits.
- **OPS-S-03:** Define passes and explicitly list covered fixtures.
- **OPS-S-04:** Configure participation categories and registration requirements.
- **OPS-S-05:** Manage credential or kit-collection information.

Shared operations:

- **OPS-X-01:** Block/release unsold inventory with a reason.
- **OPS-X-02:** Display server-confirmed availability and update time.
- **OPS-X-03:** Manage authorized complimentary allocations with audit information.
- **OPS-X-04:** Preview affected holds/bookings before cancellation or postponement.
- **OPS-X-05:** Track bulk-operation progress and individual failures.
- **OPS-X-06:** Do not show a whole batch as successful if some records failed.

**24. Provider reports and settlements**

- **RPT-01:** Display real bookings, tickets sold, occupancy, attendance, refunds, and revenue.
- **RPT-02:** Label metrics clearly, distinguishing gross sales, net revenue, liabilities, and paid settlements.
- **RPT-03:** Filter by period, venue, listing, occurrence, and category.
- **RPT-04:** Show report time zone and freshness.
- **RPT-05:** Provide drill-down from totals to permitted underlying records.
- **RPT-06:** Provide accessible table alternatives to charts.
- **RPT-07:** Support authorized exports with scope confirmation and generation status.
- **RPT-08:** Protect attendee exports through role checks and explicit field selection where appropriate.
- **RPT-09:** Display settlement statements, commissions, deductions, adjustments, and actual payout status.
- **RPT-10:** Support settlement dispute submission and tracking where configured.
- **RPT-11:** Never substitute sample metrics when no real data exists.

**25. Platform administration**

- **ADM-UI-01:** Provide operational dashboards for approvals, bookings, payments, refunds, and incidents.
- **ADM-UI-02:** Search and inspect users and organizations within permissions.
- **ADM-UI-03:** Suspend/reactivate accounts with reason and impact confirmation.
- **ADM-UI-04:** Manage roles and permissions without allowing unauthorized escalation.
- **ADM-UI-05:** Review provider verification and listing submissions.
- **ADM-UI-06:** Approve, reject, request changes, publish, or suspend with recorded reasons.
- **ADM-UI-07:** Manage cities, languages, genres, formats, sports, teams, categories, and amenities.
- **ADM-UI-08:** Manage banners, collections, FAQs, and versioned policy content.
- **ADM-UI-09:** Configure coupons, campaign dates, eligibility, limits, and budgets.
- **ADM-UI-10:** Preview changes before activating them.
- **ADM-UI-11:** Inspect bookings with separate inventory, payment, ticket, and refund timelines.
- **ADM-UI-12:** Execute permitted overrides with reason, confirmation, and visible audit result.
- **ADM-UI-13:** Manage occurrence disruptions and track notification/refund progress.
- **ADM-UI-14:** View failed jobs and permitted retry actions without exposing infrastructure secrets.
- **ADM-UI-15:** Provide searchable audit history with actor, action, target, time, and outcome.
- **ADM-UI-16:** Require stronger confirmation for destructive or large-scale actions.

**26. Support-agent and finance interfaces**

Support agents:

- **SUP-A-01:** Provide case queues with assignment, priority, category, and status filters.
- **SUP-A-02:** Display customer context after appropriate authorization.
- **SUP-A-03:** Separate internal notes from customer-visible messages.
- **SUP-A-04:** Show an explicit audience label before sending replies.
- **SUP-A-05:** Link cases to bookings, payments, and refunds.
- **SUP-A-06:** Allow permitted resend, cancellation, refund-request, and escalation actions.
- **SUP-A-07:** Display whether an action succeeded, is pending, or requires another role.
- **SUP-A-08:** Record action reasons and prevent unrestricted impersonation.

Finance:

- **FIN-01:** Display payments, refund attempts, reconciliation exceptions, disputes, and settlement batches.
- **FIN-02:** Distinguish captured funds, authorized payments, refunds, liabilities, and payouts.
- **FIN-03:** Show provider/internal references and transaction timelines.
- **FIN-04:** Preview refund amount and allocation before submission.
- **FIN-05:** Prevent UI submission beyond server-provided refundable amounts.
- **FIN-06:** Support configured reviewer/approver separation.
- **FIN-07:** Handle unknown outcomes through status checking rather than repeated initiation.
- **FIN-08:** Display balanced-ledger entries and adjustments without allowing direct historical editing.
- **FIN-09:** Provide authorized exports and settlement statements.
- **FIN-10:** Mask financial and personal data according to role.

**27. Admission scanner application**

- **SCN-01:** Authenticate gate staff and display assigned occurrences.
- **SCN-02:** Require selection/confirmation of occurrence and gate.
- **SCN-03:** Request camera permission with a clear explanation.
- **SCN-04:** Support available camera selection and torch controls where the device supports them.
- **SCN-05:** Provide authorized manual lookup when camera access fails.
- **SCN-06:** Submit scans to the backend for authoritative validation.
- **SCN-07:** Show success only after server-confirmed admission.
- **SCN-08:** Distinguish invalid, wrong occurrence, wrong time, cancelled, transferred, expired, and previously used tickets.
- **SCN-09:** Display minimal information required to admit the attendee.
- **SCN-10:** Prevent repeated camera frames from issuing uncontrolled duplicate requests.
- **SCN-11:** Provide configurable sound/haptic feedback plus visible text.
- **SCN-12:** Show network failure as “Unable to verify,” never as admitted.
- **SCN-13:** Support configured re-entry and pass entitlements.
- **SCN-14:** Require supervisor permission and a reason for available overrides.
- **SCN-15:** Show recent scan outcomes within the staff member’s permissions.
- **SCN-16:** Do not promise cross-device duplicate prevention during fully offline operation.

**28. Shared forms, tables, and interaction behavior**

- **INT-01:** Use persistent labels rather than placeholders as the sole field description.
- **INT-02:** Explain required fields and input constraints before submission.
- **INT-03:** Validate locally for usability and display authoritative server errors.
- **INT-04:** Focus the first invalid field or a linked error summary after failed submission.
- **INT-05:** Preserve safe input on recoverable failures.
- **INT-06:** Use appropriate input modes, autocomplete attributes, and date controls.
- **INT-07:** Provide explicit Save, Cancel, Apply, and Reset semantics.
- **INT-08:** Distinguish unsaved, saving, saved, and failed draft states.
- **INT-09:** Tables shall support relevant sorting, filtering, pagination, and empty states.
- **INT-10:** Explain whether bulk selection applies to the current page or all matching results.
- **INT-11:** Confirm bulk-action scope and show partial outcomes.
- **INT-12:** Dialogs shall have clear titles, meaningful actions, focus management, and safe dismissal.
- **INT-13:** Toasts shall supplement durable status displays for important actions.
- **INT-14:** Destructive confirmations shall name the affected record and consequence.

**29. Universal loading, error, and recovery states**

Every applicable screen shall define:

| State | Required behavior |
|---|---|
| Initial loading | Stable skeleton or progress indicator |
| Background refresh | Preserve useful content while indicating refresh |
| Empty | Explain absence and offer a relevant next action |
| Validation failure | Identify the field/problem and correction |
| Unauthorized | Request authentication without exposing data |
| Forbidden | Explain lack of access |
| Not found | Provide safe navigation |
| Stale/conflict | Refresh authoritative data and explain the conflict |
| Rate limited | Show server-provided retry guidance |
| Offline | Explain unavailable actions and preserve safe work |
| Server error | Provide retry and support/reference information |
| Partial success | Identify successful and failed items |
| Pending outcome | Offer status retrieval without duplicate mutation |
| Maintenance | Explain service availability and recovery options |
| Success | Show durable evidence and next steps |

Additional rules:

- Do not automatically retry unsafe mutations as new operations.
- Preserve booking references during uncertain outcomes.
- Do not expose stack traces or internal secrets.
- Do not show stale availability as guaranteed inventory.
- Display cancellation and payment recovery information in persistent screens, not only temporary notifications.

**30. Accessibility, responsive behavior, and localization**

Use WCAG 2.2 AA as the accessibility acceptance target. The following are selected product checks, not a substitute for the complete standard:

- **ACC-01:** Support keyboard operation throughout.
- **ACC-02:** Provide meaningful headings, landmarks, labels, and alternative text.
- **ACC-03:** Maintain visible focus and logical focus order.
- **ACC-04:** Restore focus appropriately after dialogs close.
- **ACC-05:** Announce important asynchronous outcomes without overwhelming users.
- **ACC-06:** Provide sufficient contrast in both themes.
- **ACC-07:** Do not rely solely on color, sound, motion, or hover.
- **ACC-08:** Support text resizing and page reflow.
- **ACC-09:** Provide non-drag alternatives for interactions requiring dragging.
- **ACC-10:** Use comfortably sized touch targets.
- **ACC-11:** Provide accessible alternatives to graphical seat selection.
- **ACC-12:** Explain reservation timing and evaluate applicable timing requirements and exceptions.
- **ACC-13:** Ensure sticky headers/actions do not obscure focused content.

Responsive/localization requirements:

- Support representative widths of 360, 390, 768, 1024, and 1440 pixels.
- Avoid unintended horizontal scrolling outside intentional seat-map/table regions.
- Keep primary checkout actions reachable on mobile.
- Do not depend on hover.
- Support portrait and landscape where practical.
- Localize dates, numbers, currency, validation text, and navigation.
- Preserve venue-local occurrence times.
- Avoid concatenated translatable sentences.
- Accommodate longer translated labels without truncating essential information.

**31. Frontend architecture, security, and data behavior**

- **ARC-FE-01:** Organize code by feature/domain, with shared presentation primitives.
- **ARC-FE-02:** Isolate API clients and transport mapping from presentation components.
- **ARC-FE-03:** Separate server state, navigation state, form state, and temporary interaction state.
- **ARC-FE-04:** Use documented API contracts and consistent error mapping.
- **ARC-FE-05:** Keep server-side business decisions authoritative.
- **ARC-FE-06:** Partition and invalidate cached data by user, organization, city, and occurrence where relevant.
- **ARC-FE-07:** Do not cache authenticated pages or ticket data publicly.
- **ARC-FE-08:** Do not store credentials, raw payment data, or sensitive attendee information in unsafe browser storage.
- **ARC-FE-09:** Sanitize or safely render provider-authored content.
- **ARC-FE-10:** Validate redirect destinations.
- **ARC-FE-11:** Avoid sending personal data, ticket tokens, OTPs, or payment secrets to analytics.
- **ARC-FE-12:** Route guards improve navigation but do not replace backend authorization.
- **ARC-FE-13:** Handle incompatible application updates without silently losing an active checkout.
- **ARC-FE-14:** PWA caches shall distinguish public assets from private and time-sensitive data.

**32. Enhancements and scope boundaries**

Include these modern features when enabled:

- Real-time availability with reconnect recovery.
- Consent-based availability alerts.
- Waitlists with explicit non-guarantee of allocation.
- Fair waiting-room screens with server-supplied admission state.
- Queue persistence after refresh where supported.
- Multilingual interfaces.
- Installable PWA behavior.
- Calendar integration.
- Policy-controlled ticket transfer.
- Provider bulk imports.
- Recommendations based on actual data.

For waiting rooms, do not fabricate a position or estimated wait. Queue admission is not a seat reservation.

Wallets, resale marketplaces, loyalty currencies, memberships, and dynamic pricing require separate product requirements. They are not implicitly included.

**33. Frontend acceptance and completion criteria**

A frontend feature is complete only when:

1. Its route and navigation are implemented.
2. Its actual backend integration works.
3. Required permissions are respected.
4. Loading, empty, error, pending, conflict, and success states are handled.
5. Forms validate correctly and recover safely.
6. Both Light and Dark themes are complete.
7. Mobile and desktop layouts are verified.
8. Keyboard and assistive-technology behavior are checked.
9. Meaningful end-to-end tests cover the primary journey.
10. Screenshots and test evidence support the claimed result.

Minimum end-to-end scenarios:

| Scenario | Expected frontend behavior |
|---|---|
| Two customers request the same seat | Only the successful reservation is shown as held; the other customer receives reselection guidance |
| Reservation expires during authentication | The selection is revalidated before payment |
| Availability changes during seat selection | Conflicting seats are identified without silently substituting others |
| Payment succeeds after browser closure | My Bookings retrieves the confirmed or recovery state |
| Payment outcome is unknown | Show pending status and status checking; do not invite immediate repayment |
| Payment succeeds after inventory is lost | Show the actual recovery/refund workflow |
| One ticket in a group is cancelled | Remaining tickets stay visibly valid |
| A ticket is transferred | The sender’s replaced ticket is no longer shown as valid |
| Another gate already admitted the ticket | Scanner displays duplicate admission |
| Organization changes | No previous organization’s private data remains visible |
| Theme changes during checkout | Selections, entered details, and reservation status remain intact |
| Notification delivery fails | The confirmed booking remains accessible |
| A bulk provider import partly fails | Successful and failed rows are reported separately |
| A user loses permission mid-session | Protected actions stop and the UI refreshes access state |

Maintain a final coverage matrix linking every requirement to its screen, role, API dependency, acceptance test, and verification status. This makes omissions visible and prevents visual completion from being mistaken for functional completion.