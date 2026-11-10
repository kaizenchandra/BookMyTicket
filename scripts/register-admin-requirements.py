"""Register the supplied admin FRS without rewriting its source or claiming blanket coverage."""
import hashlib,json,re
from pathlib import Path
source=Path('makemyticket-admin-panel.md')
text=source.read_text()
rows=[]
module=side=None
counts={}
covered={
 'FR-FE-004':('/admin/*','Permission-aware navigation for implemented operator modules'),
 'FR-FE-009':('/admin/dashboard','Server-clock IST presets and bounded custom date ranges'),
 'FR-FE-012':('/admin/dashboard','GBV, booking and cancellation drilldowns to matching booking cohorts'),
 'FR-FE-013':('/admin/users','Existing verified accounts: view, suspend, reactivate; initial staff grants through exact account lookup; no invitations'),
 'FR-FE-015':('/admin/users','Allowlisted granular platform grants; tenant/gate grants preserved'),
 'FR-FE-016':('/admin/users','Exact reference/contact and status filters; descending keyset pagination'),
 'FR-FE-017':('/admin/audit','Existing audit search linked by target reference'),
 'FR-FE-018':('/admin/customers','Masked account directory; full customer profile expansion remains open'),
 'FR-FE-019':('/admin/bookings','Customer-filtered bookings and per-booking payment history'),
 'FR-FE-020':('/admin/customers','Status filtering; registration/activity filters remain open'),
 'FR-FE-021':('/admin/customers','Reasoned account status changes with access.manage permission'),
 'FR-FE-045':('/admin/bookings','Unified persisted booking directory with server pagination'),
 'FR-FE-046':('/admin/bookings','Booking/customer/state/creation-time/ever-confirmed filters; supplier/product/occurrence-date filters remain open'),
 'FR-FE-047':('/admin/bookings/:id','Recorded timeline, occurrence summaries, policy reference; passenger/documents not exposed'),
 'FR-FE-050':('/admin/bookings/:id','Separate booking state, payment records and ticket validity counts; supplier confirmation unavailable'),
 'FR-FE-052':('/admin/payments','Latest payment attempts linked to booking detail where permitted'),
 'FR-FE-054':('/admin/bookings/:id','Paginated payment observation history; provider error details redacted'),
 'FR-FE-059':('/admin/refunds','Recovery obligations directory only; refund execution not implemented'),
 'FR-BE-003':('/api/v1/admin/*','MFA and route-specific grants with transaction rechecks'),
 'FR-BE-005':('/api/v1/admin/users/:id','All target sessions revoked atomically on admin status or managed grant changes'),
 'FR-BE-013':('/api/v1/admin/users','Existing identity account/grant storage; custom roles not implemented'),
 'FR-BE-014':('/api/v1/admin/*','Platform-scoped per-operation grants; no tenant-wide data exposed to scoped grants'),
 'FR-BE-015':('/api/v1/admin/users/:id','No self-modification, allowlisted privileges, access.manage required'),
 'FR-BE-016':('/api/v1/admin/users/:id','Suspension/reactivation with version checking and revocation'),
 'FR-BE-017':('/api/v1/admin/users/:id','Atomic before/after grant/status audit without contact data'),
 'FR-BE-018':('/api/v1/admin/customers','Masked account basics plus permission-gated related booking lookup'),
 'FR-BE-019':('/api/v1/admin/users/:id','Serialized reasoned account transitions'),
 'FR-BE-021':('/api/v1/admin/customers','Keyset paginated exact-reference/contact search'),
 'FR-BE-022':('/api/v1/admin/customers','Contact masking, private snapshot/provider identifier exclusion'),
 'FR-BE-023':('/api/v1/admin/users/:id','Atomic audit with rollback on audit failure'),
}
fr02={
 'FR-FE-007':('Booking, GBV/capture, cancellation, booking-active customers and distinct recovery/refunded-attempt metrics','Completed refunds and net earnings require currently absent ledgers.'),
 'FR-FE-008':('Movie/event/sports booking counts, confirmed counts and GBV with mixed/unmapped grouping','Travel products are not supported by the current platform.'),
 'FR-FE-009':('Calendar, Today, Yesterday, 7/30 days and <=366-day custom IST ranges','Browser host unavailable; functional UI automation remains blocked.'),
 'FR-FE-010':('Zero-filled daily/monthly booking and GBV charts with accessible tables','Browser visual/accessibility verification remains blocked.'),
 'FR-FE-011':('Recovery-awaiting-review, failed payment/order exceptions and permission-gated support alerts','Travel supplier synchronization failures are unavailable; alerts use selected-period creation cohorts, not all-time backlog.'),
 'FR-FE-012':('Permission-aware KPI links to actor/filter/date-bound paginated live records','Historical snapshots intentionally do not claim historical record drilldown; detail links show current records.'),
 'FR-BE-007':('Filtered booking/cash/status/product aggregates through owner-module read ports','Sources use documented distinct booking/event/occurrence measurement bases.'),
 'FR-BE-008':('Typed dashboard/record/history APIs with definition version and database capture time','Supplier margins and completed refunds remain unavailable.'),
 'FR-BE-009':('Persist immutable captured reports, filter metadata and definition version; historical retrieval','Snapshots are on-demand captures, not reconstructed scheduled day-end aggregates; retention and load policies remain operational work.'),
 'FR-BE-010':('Intersect city, partner UUID, supported product, booking state and INR filters across metric sources','Current catalog classification; mixed bookings count in full when any component matches. Inventory is independent of booking state.'),
 'FR-BE-011':('Separate booking state, captures, failed/refunded attempts and recovery; GBV requires recorded confirmation','Provider refunded attempt amounts are not actual refund amounts.'),
 'FR-BE-012':('Current finance/MFA checks; additional booking/customer/support drilldown grants; historical support redaction','Only platform grants authorize platform analytics; no new account grants are seeded.'),
}
for key,(implementation,limit) in fr02.items():
 covered[key]=('/admin/dashboard and /api/v1/admin/dashboard/*',implementation)
fr03={
 'FR-FE-013':'Create an email-based admin account; edit display name/access; view masked directory; suspend/reactivate with reason and confirmation. Recipient must verify email and MFA; no invitation is sent.',
 'FR-FE-014':'Persistent named roles with create, edit, deactivate/reactivate, permissions, assignments and search/pagination; five unassigned role definitions provided.',
 'FR-FE-015':'Explicit supported module/action grant catalog; direct grants combine with active role permissions; resource-scoped grants remain unchanged.',
 'FR-FE-016':'Admin name, exact email/reference, status, role and effective permission filters before newest/oldest keyset pagination; first-page links preserve filters and sort.',
 'FR-FE-017':'Paginated activity and privilege history showing reasons and before/after changes, including indirect shared-role changes.',
 'FR-BE-013':'Persist admin metadata, roles, role permissions, assignments and role-derived grant provenance; create retries stored per actor/operation/key.',
 'FR-BE-014':'Materialize effective platform grants so all existing route and transaction authorization checks enforce role permissions without separate bypass paths.',
 'FR-BE-015':'Active access.manage plus fresh MFA required; allowlisted permissions; self account/assigned-role mutation denied; versions and global mutation lock prevent stale/concurrent changes.',
 'FR-BE-016':'Account and role changes revoke affected sessions atomically; inactive roles remove derived grants and retain assignments for explicit reactivation.',
 'FR-BE-017':'Atomic role/account before-after audits; rollback on audit failure; source-module activity reader redacts unrelated payloads and contacts.',
}
for key,implementation in fr03.items():
 covered[key]=('/admin/users, /admin/roles and corresponding /api/v1/admin routes',implementation)
fr04={
 'FR-FE-018':'Profile-name/exact-contact/ID searchable customer directory and masked profile detail workspace.',
 'FR-FE-019':'Independently paginated booking and payment capture/attempt/recovery histories with additional permissions.',
 'FR-FE-020':'Registration dates, account status, booking activity/date windows and newest/oldest keyset pages.',
 'FR-FE-021':'Versioned suspend/reactivate with reason and explicit session-revocation confirmation.',
 'FR-FE-022':'Consent-aware masked saved attendees; wallet and loyalty explicitly unsupported.',
 'FR-FE-023':'Permission-gated support history and reasoned review/contact/payment flags.',
 'FR-BE-018':'Owner-module profile/booking/payment/support adapters composed by application ports.',
 'FR-BE-019':'Serialized status changes with stale-version, self-change and last-manager safeguards.',
 'FR-BE-020':'Persist contact verification time only after successful OTP; distinguish historical verified evidence and absent evidence. Profile version and account state exposed.',
 'FR-BE-021':'25-row keyset customer and history pages; directory filters applied before LIMIT; actor/filter-bound cursors.',
 'FR-BE-022':'Masked contact/attendee data, separate history permissions, no raw booking snapshots or support messages.',
 'FR-BE-023':'Read audits and atomic reason/before/after status/flag audit with session revocation.',
}
for key,implementation in fr04.items():
 covered[key]=('/admin/customers, /admin/customers/:id and /api/v1/admin/customers/*',implementation)
fr05={
 'FR-FE-024':'Persist/search/edit airline coverage and supplier profiles with sandbox/production labels, draft/suspended status and guarded versions. Adapter/credential setup awaits authorized supplier selection.',
 'FR-FE-029':'Persist versioned INR base-fare markup and fixed service-fee rules with reason/confirmation and non-bookable arithmetic preview; no checkout integration yet.',
 'FR-BE-029':'Exact bigint paise computation and versioned rule storage, with half-up base-fare markup. Supplier commissions and booking-time application remain blocked.',
}
for key,implementation in fr05.items():
 covered[key]=('/admin/flights and /api/v1/admin/flights/suppliers/*',implementation)
fr06={
 'FR-FE-031':'Name/code, city, kind, state and bounding-box filters with server keyset pagination.',
 'FR-FE-032':'Create hotel/homestay drafts with actor-scoped idempotency and stable unique property code.',
 'FR-FE-033':'Versioned property description, location and private contact editing.',
 'FR-FE-034':'HTTPS image references and alt metadata, amenities, facilities and house rules.',
 'FR-FE-035':'Check-in/out times and versioned cancellation policy text; no reservation penalty engine implied.',
 'FR-FE-036':'Reasoned review approval/rejection, suspension/delisting/reopen, confirmation and separate review grants.',
 'FR-FE-037':'Listing completeness and missing-field reporting plus server field validation errors.',
 'FR-BE-032':'Hotels-owned master content and operator-entered supplier name/reference association; no verified supplier master integration.',
 'FR-BE-033':'Structural draft validation and mandatory fields checked again on submission and approval.',
 'FR-BE-034':'Image URLs and alt metadata stored in versioned content; no managed upload or external download.',
 'FR-BE-035':'Draft/pending_review/published/suspended/delisted state machine with serialized version checks.',
 'FR-BE-036':'Immutable full-content/policy snapshots with paginated administrative history.',
 'FR-BE-037':'Coordinate index and bounding-box/city filtering; published-only public content projection.',
}
for key,implementation in fr06.items():
 covered[key]=('/admin/hotels, /hotels and corresponding /api/v1 routes',implementation)
fr07={
 'FR-FE-038':'Property-scoped room types with occupancy, active state, versioned edits and live-allocation occupancy safeguards.',
 'FR-FE-039':'Date/weekday availability calendar with configured capacity, active holds/reservations, remaining rooms and restrictions.',
 'FR-FE-040':'Versioned default rate plans and date-level nightly overrides in exact INR paise.',
 'FR-FE-041':'Atomic 1–366 night bulk capacity/rate/restriction replacement with confirmation and stale-version protection.',
 'FR-FE-042':'Minimum stay, global room stop-sell and blackout dates enforced on every stay night.',
 'FR-FE-043':'Paginated operator inventory allocations and immutable adjustment/quote/reconciliation history.',
 'FR-FE-044':'Refundable/non-refundable plan flag and policy captured in immutable allocation price snapshots.',
 'FR-BE-039':'Inventory-owned room/day capacity and plan/day rate records; room capacity shared across all plans.',
 'FR-BE-040':'Atomic multi-night hold and identity-bound release; conditional expiry-safe consumption into an inventory reservation.',
 'FR-BE-041':'Room aggregate serialization and authoritative live held plus reserved counts; no partial hold creation; reductions below commitments rejected.',
 'FR-BE-042':'Ten-minute database-time expiry; expired stock ignored without cleanup; identical retries preserve original expiry; terminal holds cannot revive.',
 'FR-BE-043':'Included/extra guest pricing, default/date seasonal overrides, date discount basis points, exact half-up per-room/night rounding.',
 'FR-BE-045':'Immutable inventory/rate adjustments and manual reconciliation discrepancies with reason and audit; observations do not silently adjust stock.',
}
for key,implementation in fr07.items():
 covered[key]=('/admin/hotels/:id/inventory and /api/v1/admin/hotel-rooms/*',implementation)
for line in text.splitlines():
 if line.startswith('# 3.'):break
 match=re.match(r'## (FR-\d+): (.+)',line)
 if match:module=match.group(1);side=None
 if line.startswith('Frontend'):side='FE'
 if line.startswith('Backend'):side='BE'
 if not module or not side or not line.startswith('- '):continue
 counts[(module,side)]=counts.get((module,side),0)+1
 match=re.match(r'- (FR-(?:FE|BE)-\d+): (.*)',line)
 original=match.group(1) if match else None
 identifier=f'{side}:{original}' if original else f'GAP:ADMIN-{module}-{side}-{counts[(module,side)]:02d}'
 coverage=covered.get(original)
 rows.append({'id':identifier,'sourceId':original,'module':module,'responsibility':side,'requirement':match.group(2) if match else line[2:],
 'status':'partial' if coverage else 'unassessed_in_this_increment','route':coverage[0] if coverage else None,'implementedSubset':coverage[1] if coverage else None,
 'tests':['tests/admin-operations.test.ts'] if coverage else [],'evidence':['docs/evidence/admin-operations-full-suite.txt','docs/architecture/adr-097-admin-operations.md'] if coverage else [],
 'limitations':'Browser verification outstanding. No full clause acceptance claimed.' if coverage else 'Requires detailed assessment against existing modules; travel supplier workflows await product scope and integration contracts.'})
for row in rows:
 if row['sourceId'] in fr02:
  row.update(tests=['tests/dashboard-analytics.test.ts','tests/admin-dashboard.test.ts','tests/admin-operations.test.ts'],evidence=['docs/evidence/dashboard-fr02-full-suite.txt','docs/architecture/adr-098-dashboard-analytics.md'],limitations=fr02[row['sourceId']][1],transactionRules='Repeatable-read report/record transaction; snapshot + audit atomically persisted; current permissions rechecked and locked',dataOwnership='Catalog classifications; Bookings cohorts; Payments events; Inventory allocation; Support alerts; Reporting snapshots')
for row in rows:
 if row['sourceId'] in fr03:
  row.update(tests=['tests/admin-roles.test.ts','tests/admin-operations.test.ts'],evidence=['docs/evidence/admin-fr03-completion-full-suite.txt','docs/architecture/adr-099-admin-roles.md','docs/architecture/adr-100-admin-access-details.md'],limitations='Implemented for existing platform actions and email/OTP identity. Invitations/password/SSO and tenant role administration are outside FR-03 scope. Browser acceptance remains unverified.',transactionRules='Serialized role/account mutations, version checks, effective-grant recomputation, session revocation and audit commit together',dataOwnership='Identity owns accounts, roles, assignments and grant provenance; Reporting owns audit history')
for row in rows:
 if row['sourceId'] in fr04:
  row.update(tests=['tests/customer-administration.test.ts','tests/admin-operations.test.ts','tests/profile.test.ts'],evidence=['docs/evidence/customer-management-full-suite.txt','docs/architecture/adr-101-customer-management.md'],limitations='Implemented for existing movie/event/sports accounts. Wallet and loyalty are unsupported. Browser acceptance remains unverified. Activity aggregation is synchronous; load testing remains operational work.',permissions='customers.read and current MFA; histories additionally bookings.read/finance/support; mutations access.manage',transactionRules='Repeatable-read customer views with audited reads; serialized versioned mutations and session revocation commit with audit',dataOwnership='Identity accounts/contact verification/flags; Profiles preferences and saved attendees; Bookings orders; Payments observations; Support cases; Reporting audit')
for row in rows:
 if row['module']=='FR-05':
  row.update(status='partial' if row['sourceId'] in fr05 else 'blocked_supplier_contract',limitations='Authorized flight supplier, API contract and sandbox configuration not supplied. No live availability/PNR/ticket/ancillary/synchronization/cancellation adapter exists; full FR-05 acceptance not claimed. Browser acceptance unverified.',permissions='flights.read and current MFA; profile writes flights.manage; commercial writes pricing',transactionRules='Version-checked writes and audits atomic; actor-scoped create idempotency; exact integer arithmetic',dataOwnership='Flights owns supplier profiles and commercial rules; Identity owns grants; Reporting owns audit',tests=['tests/flight-administration.test.ts'] if row['sourceId'] in fr05 else [],evidence=['docs/evidence/flight-management-full-suite.txt','docs/architecture/adr-102-flight-management.md'])
for row in rows:
 if row['module']=='FR-06':
  row.update(status='implemented_browser_unverified' if row['sourceId'] in fr06 else 'blocked_supplier_contract',limitations='External authorized supplier synchronization awaits provider contract/configuration. Supplier association is operator-entered metadata; image references only. Browser acceptance unverified. Room inventory/booking is FR-07 and later scope.',permissions='hotels.read and fresh MFA; edits/submit hotels.manage; decisions hotels.review; public published projection excludes private contacts/supplier metadata',transactionRules='Locked expectedVersion; state validation; current content, immutable revision and audit commit together; actor/key create replay fingerprint; published edits return to draft',dataOwnership='Hotels properties/revisions; Identity grants; Reporting audit',tests=['tests/hotel-administration.test.ts'] if row['sourceId'] in fr06 else [],evidence=['docs/evidence/hotel-management-full-suite.txt','docs/architecture/adr-103-hotel-properties.md'])
for row in rows:
 if row['module']=='FR-07':
  row.update(status='implemented_browser_unverified' if row['sourceId'] in fr07 else 'blocked_channel_manager_contract',limitations='Operator-managed inventory only. No hotel checkout/payment/fulfillment or channel-manager synchronization. Date promotions are simple per-plan discounts, without coupon/customer-segment rules. Reconciliation is operator-observed. Browser acceptance/load testing remain unverified.',permissions='hotels.read and fresh MFA; room/hold/allocation/reconciliation hotels.manage; rate plans pricing; bulk both manage/pricing',transactionRules='Property lock then room aggregate lock; all nights atomic; expired holds excluded and consumption rechecks DB-time expiry; UUID-bound release; actor/operation/key replay; immutable changes and audit commit together',dataOwnership='Inventory owns hotel rooms/plans/dates/allocations/history; Hotels public property-lock contract; Identity grants; Reporting audit',tests=['tests/hotel-inventory.test.ts'] if row['sourceId'] in fr07 else [],evidence=['docs/evidence/hotel-inventory-full-suite.txt','docs/architecture/adr-104-hotel-inventory.md'])
fr08={
 'GAP:ADMIN-FR-08-FE-01':'Operator business/supplier metadata, route catalogues and ordered boarding/drop-off stops with permissions, search and versioned edits.',
 'GAP:ADMIN-FR-08-FE-02':'Scheduled timestamps, amenities, indicative paise fares and visual reference seat grids. No live supplier fare/availability claim.',
 'GAP:ADMIN-FR-08-FE-04':'Local disruption/resolve/withdraw workflow and cancellation-policy references with immutable history; no supplier cancellation or refund execution.',
}
for row in rows:
 if row['module']=='FR-08':
  row.update(status='partial' if row['id'] in fr08 else 'blocked_supplier_contract',route='/admin/buses and /api/v1/admin/buses/*',implementedSubset=fr08.get(row['id']),limitations='No authorized bus supplier/API contract/configuration supplied. Live fares/availability/holds/booking/tickets/supplier synchronization/reconciliation remain blocked. Unknown supplier values are null, not simulated zero inventory. Browser acceptance unverified.',permissions='buses.read and fresh MFA; mutations also buses.manage',transactionRules='Actor/operation/key create replay, unique catalogue code, locked versions, validated parent references, immutable history and audit commit together',dataOwnership='Buses catalogue/route snapshots/history; Identity grants; Reporting audit',tests=['tests/bus-administration.test.ts'] if row['id'] in fr08 else [],evidence=['docs/evidence/bus-management-full-suite.txt','docs/architecture/adr-105-bus-management.md'])
fr09={
 'GAP:ADMIN-FR-09-FE-01':'Persistent stations, ordered route calls, dated services and travel classes with readable IST timetable displays, filters and versioned snapshots. Local reference data, not provider-verified schedules.',
 'GAP:ADMIN-FR-09-FE-05':'Reasoned local incident/disrupt/resolve/withdraw workflow with version guards, permissions and immutable before/after history.',
}
for row in rows:
 if row['module']=='FR-09':
  row.update(status='partial' if row['id'] in fr09 else 'blocked_provider_contract',route='/admin/trains and /api/v1/admin/trains/*',implementedSubset=fr09.get(row['id']),limitations='Authorized railway provider/API documentation/sandbox configuration not supplied. Live fares/availability/booking/PNR/waitlist/cancellation/refund/reconciliation and provider restrictions are not implemented; fields are null and bookable=false. Local structural validation is not supplier rule enforcement. Browser acceptance unverified.',permissions='trains.read and fresh MFA; mutations additionally trains.manage',transactionRules='Unique catalogue/station codes; actor/operation/key create replay; locked versions and validated active references; immutable snapshot/history and audit commit together',dataOwnership='Trains catalogue/station-route snapshots/history; Identity grants; Reporting audit',tests=['tests/train-administration.test.ts'] if row['id'] in fr09 else [],evidence=['docs/evidence/train-management-full-suite.txt','docs/architecture/adr-106-train-management.md'])
fr11={
 'GAP:ADMIN-FR-11-FE-01':'Versioned create/edit/customer-content preview, approval/publish/unpublish and published-only informational listings.',
 'GAP:ADMIN-FR-11-FE-02':'Destinations, consecutive itinerary days, inclusions/exclusions and immutable definition snapshots.',
 'GAP:ADMIN-FR-11-FE-03':'HTTPS media references/alt text, inclusive travel dates, occupancy and exact INR component-based price previews.',
 'GAP:ADMIN-FR-11-FE-04':'Child ages/count constraints, optional add-ons and versioned cancellation/child policy references.',
 'GAP:ADMIN-FR-11-FE-05':'Definition-version-bound passenger allotment planning and approval workflows; no live inventory consumption or supplier reservations.',
 'GAP:ADMIN-FR-11-BE-01':'Persisted package definitions with immutable itinerary/policy snapshots and paginated history.',
 'GAP:ADMIN-FR-11-BE-02':'Stored adult/child/fixed component costs plus selected add-ons, half-up basis-point markup and fee using exact paise arithmetic; not supplier quote/tax integration.',
 'GAP:ADMIN-FR-11-BE-03':'Preview date/party/age/add-on constraints and versioned planning caps. Authoritative bookability remains unknown/false.',
}
for row in rows:
 if row['module']=='FR-11':
  row.update(status='partial' if row['id'] in fr11 else 'blocked_supplier_contract',route='/admin/packages, /holidays and corresponding /api/v1 routes',implementedSubset=fr11.get(row['id']),limitations='No authorized component supplier contracts/adapters supplied. Allotments are planning limits only; actual availability/reservations/compensation/fulfillment/confirmations remain blocked. Published content and pricing are informational with bookable=false. Browser acceptance unverified.',permissions='packages.read/current MFA; manage for edits/allotments/submit; review for publish/reject/unpublish',transactionRules='Versioned row locks; actor-key replay and unique code; immutable definition/allotment snapshots and audit commit atomically across owner contracts; exact bigint pricing',dataOwnership='Packages definitions/commercial rules/history; Inventory allotment planning; Identity grants; Reporting audit',tests=['tests/package-administration.test.ts'] if row['id'] in fr11 else [],evidence=['docs/evidence/package-management-full-suite.txt','docs/architecture/adr-107-holiday-packages.md'])
fr10={
 'GAP:ADMIN-FR-10-FE-01':'Supplier contact/contract references, vehicle passenger/luggage categories and directional service areas with filters, cursor pagination, versioned changes and history.',
 'GAP:ADMIN-FR-10-FE-02':'City, airport-transfer and outstation operating-window/coverage configuration; supplier availability remains unknown.',
 'GAP:ADMIN-FR-10-FE-03':'Administrator-entered distance/duration and server-calculated INR fare breakdown; trip status unavailable.',
 'GAP:ADMIN-FR-10-FE-05':'Included distance/waiting, extra kilometre/waiting rates, per-trip driver and airport fees plus policy text.',
 'GAP:ADMIN-FR-10-BE-02':'Exact bigint configured-tariff estimate with aggregate distance rounding up to paise. Taxes/tolls/parking excluded; not a binding supplier quote.',
 'GAP:ADMIN-FR-10-BE-03':'Directional endpoints, full-trip coverage window, distance/party/luggage constraints and active supplier/category checks; real-time vehicle availability unavailable.',
}
for row in rows:
 if row['module']=='FR-10':
  row.update(status='partial' if row['id'] in fr10 else 'blocked_supplier_contract',route='/admin/cabs and /api/v1/admin/cabs/*',implementedSubset=fr10.get(row['id']),limitations='No authorized cab provider/API contract/sandbox supplied. Reservations, trip status, cancellation/rescheduling, provider escalation, actual trip charges and reconciliation are not implemented. Local incidents do not contact suppliers. Browser acceptance unverified.',permissions='cabs.read and fresh MFA; mutations also cabs.manage; no automatic grants',transactionRules='Actor/operation/key fingerprint replay; unique kind/code; locked versions and active references; atomic immutable history/audit; exact paise estimate',dataOwnership='Cabs catalogue/commercial rules/history; Identity access; Reporting audit',tests=['tests/cab-administration.test.ts'] if row['id'] in fr10 else [],evidence=['docs/evidence/cab-management-full-suite.txt','docs/architecture/adr-108-cab-management.md'])
fr12={
 'FR-FE-045':'Unified paginated directory for persisted movie/event/sports bookings.',
 'FR-FE-046':'Booking/customer/state/created/session-date filters, current catalogue product/supplier filters, assignee and exception queues. PNR API filter returns no matches because travel suppliers are not connected.',
 'FR-FE-047':'Masked booking details, accepted policy reference, occurrence details, lifecycle timeline and independently paginated exception history.',
 'FR-FE-048':'Audited confirmed admission-ticket HTML downloads for read/manage staff with MFA, using the existing wallet validity and QR rules; supplier vouchers/invoices unavailable.',
 'FR-FE-049':'Authorized pending-payment cancellation preview/confirmation with reason, idempotency, payment-risk acknowledgement and atomic inventory release. Confirmed cancellation/rescheduling/corrections remain unavailable.',
 'FR-FE-050':'Booking, payment history and ticket fulfillment shown separately; supplier confirmation explicitly not applicable for platform admission bookings.',
 'FR-FE-051':'Open/assign/escalate/resolve/reopen exception workflow, active qualified assignees, reason capture, immutable history and filters.',
 'FR-BE-046':'Common UUID reference for supported admission products; travel booking references await supplier integration.',
 'FR-BE-047':'Existing pending/confirmed/cancelled/refund-required booking lifecycle; exception workflow kept separate.',
 'FR-BE-048':'Existing immutable accepted booking/occurrence/pricing snapshots and ticket/payment references. No travel passenger/supplier references invented.',
 'FR-BE-049':'Existing idempotent placement and cancellation; admin cancellation actor-qualified keys; exception commands actor-scoped with payload fingerprints.',
 'FR-BE-051':'Database-clock pending-payment-over-30-minutes and refund-required queues, plus explicit exception workflow states. No supplier mismatch detector.',
 'FR-BE-052':'Permission/MFA-gated versioned exception actions and pending cancellation using existing inventory/payment validation; no arbitrary booking-state patch.',
 'FR-BE-053':'Existing lifecycle outbox events plus atomic booking.exception_changed events; no external delivery claim.',
}
for row in rows:
 if row['module']=='FR-12':
  row.update(status='partial' if row['sourceId'] in fr12 else 'not_implemented',route='/admin/bookings and /api/v1/admin/bookings/*',implementedSubset=fr12.get(row['sourceId']),limitations='Travel supplier callbacks/PNRs/bookings not connected. Supplier voucher/invoice/confirmation document access, full traveller details, confirmed cancellation, rescheduling and corrections remain outstanding. Exception resolution does not resolve money/inventory. Browser acceptance unavailable.',permissions='bookings.read/current MFA; new bookings.manage additionally required for exception mutations and pending cancellation; no automatic grants',transactionRules='Read repeatable-read snapshot; case row serialization via booking lock; version/key checks; atomic history/audit/outbox; cancellation reuses payment/inventory workflow',dataOwnership='Bookings case state and lifecycle; Catalog product/supplier matching contract; Ticketing fulfillment; Payments history; Identity permissions; Reporting audit/outbox',tests=['tests/booking-exceptions.test.ts','tests/admin-operations.test.ts'],evidence=['docs/evidence/booking-management-full-suite.txt','docs/architecture/adr-109-central-booking-operations.md'])
fr13={
 'FR-FE-052':'Finance transaction directory/detail with booking references and permission-aware booking links.',
 'FR-FE-053':'Exact provider/internal transaction ID, Razorpay provider, normalized method, status, booking and observation-date filters before cursor pagination.',
 'FR-FE-054':'Immutable observation history plus bounded technical failure code/reason metadata; no provider PII/free-text errors exposed.',
 'FR-FE-055':'Separate local capture, observed provider/refund state and unavailable bank settlement; partial/manual capture unsupported.',
 'FR-FE-057':'Provider-order exception queue includes unresolved orders without attempts, worker errors/failures/review flags and freshness.',
 'FR-FE-058':'Explicit requesting-finance-actor approval/reason, audited all-matching CSV export capped at 5000 rows/366 days; exact paise and formula-prefix neutralization.',
 'FR-BE-054':'Existing concrete Razorpay adapter for server orders, checkout and fetched payment states; no live verification or additional gateways claimed.',
 'FR-BE-055':'Existing distinction between authorized/captured with merchant auto-capture; manual and partial capture not implemented.',
 'FR-BE-056':'Existing raw-body signature verification, durable webhook persistence/deduplication, leased processing and retries preserved.',
 'FR-BE-057':'Existing payment request/observation/capture deduplication preserved; refund execution idempotency remains incomplete.',
 'FR-BE-058':'Existing balanced capture ledger plus immutable payment observations, technical metadata history and audited finance views/reports.',
 'FR-BE-059':'Existing provider payment-status reconciliation and finance visibility; provider/bank settlement matching not implemented.',
 'FR-BE-060':'Existing integer paise payment amounts and bigint cumulative refund observations; finance responses/CSV use exact decimal strings.',
 'FR-BE-061':'Existing trusted-amount provider mapping, unique captures, atomic booking/inventory fulfillment and late-capture recovery preserved.',
}
for row in rows:
 if row['module']=='FR-13':
  row.update(status='partial' if row['sourceId'] in fr13 else 'not_implemented',route='/admin/payments, /admin/payment-exceptions and corresponding APIs',implementedSubset=fr13.get(row['sourceId']),limitations='Refund eligibility/action/execution, bank settlement reconciliation, additional gateways and manual/partial capture remain incomplete. Merchant live acceptance and browser verification unavailable. CSV approval is by requesting finance actor, not dual control.',permissions='finance and current MFA; booking links additionally bookings.read',transactionRules='Repeatable-read financial view/export with audit; actor/filter cursor scopes; existing idempotency and monotonic capture state; immutable metadata observations; exact paise arithmetic',dataOwnership='Payments observations/provider mappings/recovery; Finance existing collection ledger; Reporting audit; Identity permissions',tests=['tests/payment-administration.test.ts','tests/admin-operations.test.ts'],evidence=['docs/evidence/payment-management-full-suite.txt','docs/architecture/adr-110-payment-administration.md'])
Path('docs/requirements/admin-traceability.json').write_text(json.dumps({'source':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'requirements':rows},indent=2)+'\n')
print(f'Registered {len(rows)} detailed admin clauses; {sum(bool(r["implementedSubset"]) for r in rows)} partial mappings')
