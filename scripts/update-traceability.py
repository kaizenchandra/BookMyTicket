from pathlib import Path
import json,re
fields=dict(role='pending mapping',journey='pending mapping',frontendRoute='pending mapping',backendModule='pending mapping',apiUseCase='pending mapping',dataOwnership='pending mapping',permissions='pending mapping',transactionRules='pending mapping',acceptanceTests=[],implementationStatus='not_started',verificationStatus='not_verified',evidence=[],dependencies=[],decompositionStatus='pending compound review')
rows=[]
for ns,file in [('FE','frontend-functional-requirement.md'),('BE','backend-functional-requirement.md')]:
 for n,line in enumerate(Path(file).read_text().splitlines(),1):
  m=re.match(r'- \*\*([A-Z][A-Z0-9-]+)(?=[: —*])',line)
  if m:
   rows.append(dict(id=f'{ns}:{m[1]}',requirement=line[2:].replace('**',''),source=f'{file}:{n}',**fields))
section='0';counter=0
for n,line in enumerate(Path('prompt.md').read_text().splitlines(),1):
 heading=re.match(r'(\d+)\. ([A-Z][A-Z ,/()-]+)$',line)
 if heading:section=heading[1];counter=0
 if line.startswith('- '):
  counter+=1;rows.append(dict(id=f'BASE:{section}.{counter}',requirement=line[2:],source=f'prompt.md:{n}',**fields))
# Selected implemented subsets; partial does not imply acceptance completion.
groups={
 'pricing':('BE:PRC-01 BE:PRC-02 BE:PRC-04 BE:PRC-05 BE:PRC-06 BE:PRC-07 BE:PRC-08 BE:PRC-09 BE:PRC-10 BE:PRC-11 BE:PRC-12 FE:CHK-UI-04 FE:CHK-UI-05 FE:CHK-UI-08 FE:CHK-UI-09 FE:CHK-UI-10 FE:ADM-UI-08','/checkout/:id, /bookings/:id, /admin/pricing','Approve/assign policy, quote, accept immutable order','Customer owner; staff pricing grant + fresh MFA','Occurrence/reservation/assignment locks; immutable policy/quote/order snapshots'),
 'inventory':('BE:INV-01 BE:INV-02 BE:INV-03 BE:INV-04 BE:INV-05 BE:INV-06 BE:INV-07 BE:INV-09 BE:INV-10 BE:INV-11 BE:INV-15 BE:INV-19 BE:RSV-01 BE:RSV-02 BE:RSV-04 BE:RSV-08 BE:RSV-11 BE:API-10 BE:API-11','/occurrence/:id, /checkout/:id','Reserve/retrieve/release','Customer ownership; authenticated','Occurrence and resource locks; DB clock; atomic rollback'),
 'identity':('BE:IAM-03 BE:IAM-04 BE:IAM-06 BE:IAM-07 BE:IAM-10 BE:IAM-12 BE:IAM-13 BE:IAM-14 FE:AUTH-09 BE:ACL-01 BE:ACL-02 FE:AUTH-02','Sign-in dialog, /profile','Request/verify OTP; authenticator enrollment, verification, recovery','Current account/session','Challenge row lock; persisted failed attempts'),
 'bookings':('BE:BKG-03 BE:BKG-04 BE:BKG-05 BE:BKG-07 BE:BKG-09 BE:BKG-12','/bookings','Captured payment confirmation','Trusted provider reconciliation only','One local transaction across public contracts'),
 'payments':('BE:PAY-01 BE:PAY-07 BE:PAY-12 BE:PAY-14 BE:PAY-15 BE:WHK-01 BE:WHK-03 BE:WHK-04','backend adapter / worker','Provider order, verification, inbox, capture recovery','Server credentials / webhook HMAC','Durable inbox; order lock; no network within DB transaction'),
 'ticketing':('BE:TKT-01 BE:TKT-03 BE:TKT-05 BE:ADM-IN-03 BE:ADM-IN-04 BE:ADM-IN-07','/scanner','Issue / admit / replay scan','Staff MFA + occurrence:gate grant at HTTP entry','Occurrence + entitlement locks; operation uniqueness'),
 'finance':('BE:FIN-01 BE:FIN-04','/operations','Balanced collection journal','Finance grant + MFA','Deferred balanced-journal constraint'),
 'support':('BE:SUP-01 BE:SUP-03 FE:SUP-C-02 FE:SUP-C-04','/cases, /operations','Create / reply / retrieve case','Owner or authorized staff','Atomic case + initial message'),
 'catalog':('BE:CAT-12 BE:DSC-01 BE:DSC-03 FE:DIS-11 FE:SRC-09','/movies, /events, /sports','Published search / occurrences','Public approved content only','Read projection; reservation rechecks publication'),
 'profiles':('BE:CUS-02 FE:THM-01 FE:THM-02 FE:THM-03 FE:THM-04 FE:THM-08 FE:THM-11','All implemented screens','Theme persistence / profile settings','Own profile','Local explicit preference; account loaded after sign-in')
}
for module,(ids,route,usecase,permission,tx) in groups.items():
 for row in rows:
  if row['id'] in ids.split():row.update(backendModule=module,dataOwnership=module,frontendRoute=route,apiUseCase=usecase,permissions=permission,transactionRules=tx,implementationStatus='partial',verificationStatus='database_subset_verified' if row['id'].startswith('BE:') and module not in ['profiles'] else 'browser_verification_blocked',acceptanceTests=['tests/inventory.test.ts (see named subset; not full requirement coverage)'],evidence=['docs/evidence/integration-tests.txt'],dependencies=['Complete detailed acceptance coverage; see docs/progress.md'])
for row in rows:
 if row['backendModule']=='pricing':
  row.update(role='Customer; pricing administrator',journey='Review commercial terms and accept an order',acceptanceTests=['tests/pricing-domain.test.ts','tests/pricing-integration.test.ts'],evidence=['docs/evidence/integration-tests.txt','docs/architecture/adr-002-quotes.md'],dependencies=['Browser verification; approved production policy values; payment initiation remains pending'])
 if row['id'] in ['BE:IAM-12','BE:IAM-13','FE:AUTH-09']:
  row.update(role='Authenticated customer or staff',journey='Enroll, verify or recover an authenticator',acceptanceTests=['tests/mfa.test.ts'],evidence=['docs/evidence/integration-tests.txt','docs/architecture/adr-003-staff-mfa.md'],dependencies=['MFA_ENCRYPTION_KEY; live authenticator/browser verification; administrative lost-factor recovery remains pending'])
# Testable decomposition retains parent IDs. This is not complete decomposition of all sources.
subrequirements={
 'BE:PRC-04':[('a','Require an explicitly approved policy before issuing a quote.'),('b','Apply configured inclusive/exclusive ticket tax.'),('c','Apply configured inclusive/exclusive fee tax.')],
 'BE:PRC-05':[('a','Round fractional paise half up with integer intermediates.'),('b','Allocate order fees by stable largest-remainder allocation.')],
 'BE:PRC-07':[('a','Persist an immutable owner/reservation/policy-bound quote.'),('b','Repeated quote requests preserve the original hold deadline.')],
 'BE:PRC-10':[('a','Record the accepted policy version and exact displayed terms.'),('b','Preserve exact per-admission price allocations in the order.')],
 'BE:IAM-12':[('a','Encrypt authenticator secrets with account-bound associated data.'),('b','Confirm enrollment with a valid code in the initiating session.'),('c','Prevent reuse of an accepted authenticator counter across sessions.'),('d','Consume each recovery code at most once.'),('e','Persist failures and enforce the account verification window.')]
}
for parent,children in subrequirements.items():
 original=next(row for row in rows if row['id']==parent)
 for suffix,requirement in children:
  rows.append({**original,'id':parent+'.'+suffix,'parentId':parent,'requirement':requirement,'decompositionStatus':'atomic subrequirement','implementationStatus':'implemented','verificationStatus':'domain_database_http_verified_not_browser'})
for row in rows:
 if row['id']=='BE:JOB-08':
  row.update(role='Platform operator',journey='Expire abandoned reservations',frontendRoute='Not applicable: worker',backendModule='inventory',apiUseCase='ReservationExpiry.sweep',dataOwnership='inventory',permissions='Internal worker database access',transactionRules='Bounded locked batches; conditional current-ownership release',implementationStatus='partial',verificationStatus='container_database_subset_verified',acceptanceTests=['tests/inventory.test.ts: Expiry workers preserve replacement holds'],evidence=['docs/evidence/container-tests.txt'],dependencies=['Remaining reconciliation, reminder, projection and settlement jobs'])
rows.append(dict(id='GAP:OPS-001',requirement='Verify local migration-gated containers, schema readiness, restart persistence and isolated fixture restore.',source='Final user prompt sections 17–19; operational decomposition',**{**fields,'role':'Platform operator','journey':'Deploy and recover local application','frontendRoute':'/health, /ready','backendModule':'composition and infrastructure','apiUseCase':'Compose startup, migration runner, worker heartbeat','dataOwnership':'Module schemas; public.schema_migrations','permissions':'Authorized local Docker operator; isolated fixture data only','transactionRules':'Advisory-locked migrations; no destructive restore to existing database','implementationStatus':'implemented','verificationStatus':'local_container_verified_not_production','acceptanceTests':['tests/runtime.test.ts','scripts/verify-compose-recovery.mjs','scripts/smoke.ts'],'evidence':['docs/evidence/container-build.txt','docs/evidence/container-tests.txt','docs/evidence/compose-recovery.json','docs/evidence/local-smoke.json'],'dependencies':['Production environment and managed secrets; full restore integrity and rollback verification'],'decompositionStatus':'Operational subset; production acceptance separate'}))

continuation_groups=[
 ('identity','BE:IAM-11 BE:IAM-14 FE:AUTH-10 FE:AUTH-12','Customer and staff','Inspect and revoke other sessions','/profile','Sessions.list/revoke; auth/sessions endpoints','identity.sessions','Authenticated active account; own sessions only','Account advisory lock shared with MFA; current session preserved; audit committed with deletion','tests/sessions.test.ts','Browser verification; device metadata and broader account lifecycle remain outstanding'),
 ('profiles','BE:CUS-04 BE:ENG-07 FE:ENG-01 FE:ENG-02 FE:NAV-03','Customer','Save and remove listing favorites','/favorites, /listing/:id','Favorites.save/remove/list/status','profiles.favorites; catalog owns public listing details','Authenticated owner only','Unique account/listing; idempotent writes; published-only summaries; stable cursor','tests/favorites.test.ts','Browser verification; artist/team/venue types remain outstanding'),
 ('payments','BE:PAY-04 BE:PAY-05 BE:PAY-07 BE:PAY-08 BE:PAY-09 BE:PAY-10 BE:PAY-11 BE:PAY-13 BE:PAY-16 BE:PAY-17 BE:PAY-18 BE:PRC-08 BE:BKG-10 BE:BKG-11 FE:PAY-01 FE:PAY-02 FE:PAY-03 FE:PAY-04 FE:PAY-05 FE:PAY-06 FE:PAY-07 FE:PAY-08 FE:PAY-09 FE:PAY-10 FE:PAY-11 FE:PAY-12 FE:THM-12','Customer; reconciliation worker','Initiate accepted order payment and recover status','/bookings/:id','Collection.initiate/callback/status/reconcileOrder','Payments provider_orders/attempts; Bookings/Inventory/Pricing public transaction contracts','Order owner; trusted provider-query evidence for fulfillment','Order lock and quote/hold revalidation; durable unique intent before network; lease tokens; failed-attempt retry watermark','tests/payment.test.ts','Live provider/hosted checkout verification blocked; refunds/disputes and operational review UI remain outstanding')
]
for module,ids,role,journey,route,usecase,ownership,permissions,rules,test,dependency in continuation_groups:
 for row in rows:
  if row['id'] in ids.split():
   row.update(role=role,journey=journey,frontendRoute=route,backendModule=module,apiUseCase=usecase,dataOwnership=ownership,permissions=permissions,transactionRules=rules,implementationStatus='partial',verificationStatus='local_database_http_subset_verified_browser_and_provider_unverified',acceptanceTests=[test],evidence=['docs/evidence/integration-tests.txt','docs/evidence/container-tests.txt','docs/evidence/local-smoke.json'],dependencies=[dependency])
for parent,suffix,requirement,test in [
 ('BE:IAM-11','a','List only the current account sessions without tokens or verifier hashes.','tests/sessions.test.ts'),
 ('BE:IAM-11','b','Revoke another session immediately and idempotently while protecting the current session.','tests/sessions.test.ts'),
 ('BE:CUS-04','a','Save and remove published listing favorites idempotently within the authenticated account.','tests/favorites.test.ts'),
 ('BE:CUS-04','b','Paginate listing favorites without revealing unpublished content.','tests/favorites.test.ts'),
 ('BE:PAY-04','a','Stage exactly one payment intent with the immutable server order amount under concurrent requests.','tests/payment.test.ts'),
 ('BE:PRC-08','a','Revalidate the accepted quote and active inventory hold before committing a payment intent.','tests/payment.test.ts'),
 ('BE:PAY-13','a','Serialize a retry claim and require failed observations; identical observations cannot grant a second retry.','tests/payment.test.ts')]:
  original=next(row for row in rows if row['id']==parent)
  rows.append({**original,'id':parent+'.'+suffix,'parentId':parent,'requirement':requirement,'decompositionStatus':'atomic tested subrequirement','implementationStatus':'implemented','verificationStatus':'local_database_http_verified_not_live_provider_or_browser','acceptanceTests':[test]})

venue_ids='BE:VEN-02 BE:VEN-03 BE:VEN-04 BE:VEN-05 BE:VEN-06 BE:VEN-07 BE:VEN-08 BE:VEN-09 BE:VEN-11 BE:VEN-12 BE:CIN-04 BE:CIN-06 BE:SCH-01 BE:SCH-02 BE:SCH-03 BE:SCH-08 FE:CAT-09 FE:CAT-10 FE:CAT-11 FE:CAT-12 FE:CAT-13 FE:CAT-14 FE:SEA-01 FE:SEA-02 FE:SEA-05 FE:OPS-C-01 FE:OPS-C-02 FE:PRV-07 FE:PRV-08'
for row in rows:
 if row['id'] in venue_ids.split():
  row.update(role='Cinema/event/sports provider; customer',journey='Create physical venue and immutable plan; schedule and inspect exact occurrence seating',frontendRoute='/partner/venues; /occurrence/:id',backendModule='venues; inventory',apiUseCase='Venues create/space/plan/list; Scheduling.create; inventory availability',dataOwnership='Venues owns spaces/plans; Inventory owns occurrences/resources',permissions='Organization membership; write role; approved provider and owned published listing for scheduling',transactionRules='Space row lock; immutable plan/snapshot guards; actor-key fingerprint; exact plan-derived resources; schedule overlap including turnaround',implementationStatus='partial',verificationStatus='local_domain_database_http_verified_browser_unverified',acceptanceTests=['tests/venues.test.ts'],evidence=['docs/evidence/integration-tests.txt','docs/evidence/container-tests.txt','docs/architecture/adr-005-venues.md'],dependencies=['Browser acceptance; bulk imports/large-map editing; controlled plan migration; full category scheduling fields; provider pagination'])
 for_catalog='BE:CAT-07 BE:CAT-08 FE:CAT-01 FE:CAT-03 FE:CAT-05 FE:CAT-08 FE:NAV-11'.split()
 if row['id'] in for_catalog:
  row.update(role='Provider editor',journey='Save, inspect, edit and submit a private catalog draft',frontendRoute='/partner/venues',backendModule='catalog',apiUseCase='CatalogManagement.create/update/submit/list',dataOwnership='catalog.listings/revisions',permissions='Verified organization writer; approved provider for submission',transactionRules='Listing row lock; expected version; edit only draft/changes_requested; immutable historical revision snapshots',implementationStatus='partial',verificationStatus='local_database_http_verified_browser_unverified',acceptanceTests=['tests/venues.test.ts: Draft edits preserve revisions'],evidence=['docs/evidence/integration-tests.txt','docs/evidence/container-tests.txt'],dependencies=['Browser preview verification; complete category metadata and approved-revision editing'])
for parent,suffix,requirement in [
 ('BE:VEN-05','a','Persist immutable numbered seating plans under optimistic space-version control.'),
 ('BE:VEN-06','a','Reject duplicate identities, positions, labels, invalid companion references and excess physical capacity.'),
 ('BE:VEN-08','a','Derive occurrence inventory from one owned plan and persist its exact snapshot.'),
 ('BE:VEN-09','a','Prevent direct replacement of a scheduled plan snapshot and mutation of saved plan versions.'),
 ('BE:CIN-04','a','Serialize scheduling by physical space and reject overlaps including configured turnaround.'),
 ('BE:SCH-03','a','Validate explicit timestamp offsets against venue-local time; reject inconsistent daylight-saving intent.'),
 ('BE:CAT-07','a','Serialize draft edits using expected versions and retain prior revision content.')]:
 original=next(row for row in rows if row['id']==parent)
 rows.append({**original,'id':parent+'.'+suffix,'parentId':parent,'requirement':requirement,'decompositionStatus':'atomic tested subrequirement','implementationStatus':'implemented','verificationStatus':'local_domain_database_http_verified_not_browser'})
for row in rows:
 if row['id'] in 'BE:EVT-08 BE:EVT-09 BE:EVT-10 BE:SPT-08 BE:BKG-01 BE:CUS-11 FE:EVT-UI-07 FE:EVT-UI-09 FE:SPT-UI-09 FE:OPS-E-03 FE:OPS-E-04 FE:OPS-E-05'.split():
  row.update(role='Organizer and customer',journey='Publish immutable attendee form, review and accept per-admission answers',frontendRoute='/partner/venues; reservation checkout; /bookings/:id',backendModule='events; bookings',apiUseCase='Forms.publish/validate; OrderPlacement.accept; registrations.get',dataOwnership='events form versions; bookings encrypted answers; inventory capacity',permissions='Organization writer and approval for publication; reservation/order owner for answers',transactionRules='Occurrence lock; optimistic form version; atomic order/registration; keyed input digest and AES-GCM order/owner binding',implementationStatus='partial',verificationStatus='local_domain_database_verified_browser_unverified',acceptanceTests=['tests/registration.test.ts'],evidence=['docs/evidence/registration-test-run.txt','docs/architecture/adr-006-registration.md'],dependencies=['Browser acceptance; attendee corrections; retention deletion; authorized provider export; credential uploads and eligibility rules'])

for row in rows:
 if row['id'] in 'BE:ACL-09 BE:CUS-11 BE:DAT-05 BE:DAT-06 BE:DAT-10 BE:API-17 FE:RPT-07 FE:RPT-08'.split():
  row.update(role='Organization owner',journey='Select attendee fields, request an encrypted export, track status and download before expiry',frontendRoute='/partner/venues',backendModule='reporting; identity; providers; inventory; events; bookings',apiUseCase='AttendeeExports.request/list/download/once',dataOwnership='reporting export jobs/artifacts; bookings registrations; events form versions',permissions='Requester only; active account; approved organization owner; recent MFA on request/download; fresh worker/download authorization',transactionRules='Actor-scoped idempotency; SKIP LOCKED job transaction; shared authorization locks; bounded retries; encrypted artifact; database-time expiry',implementationStatus='partial',verificationStatus='local_database_http_verified_browser_unverified',acceptanceTests=['tests/exports.test.ts'],evidence=['docs/evidence/export-full-suite.txt','docs/architecture/adr-007-attendee-exports.md'],dependencies=['Browser acceptance; large export streaming; configurable production retention; sensitivity classes; administrator replay; managed key rotation'])
for parent,suffix,requirement in [
 ('BE:DAT-06','attendee','Recheck current account and organization-owner access during attendee-export generation and download, including concurrent revocation.'),
 ('BE:DAT-10','attendee','Quote selected attendee CSV fields and neutralize executable formula/control prefixes.'),
 ('BE:DAT-05','attendee','Persist bounded attendee export jobs and encrypted artifacts with status, requester authorization, retry bounds and database-time expiry.')]:
 original=next(row for row in rows if row['id']==parent)
 rows.append({**original,'id':parent+'.'+suffix,'parentId':parent,'requirement':requirement,'decompositionStatus':'atomic tested subrequirement','implementationStatus':'implemented','verificationStatus':'local_database_http_verified_not_browser'})

for row in rows:
 if row['id'] in 'FE:TKT-01 FE:TKT-02 FE:TKT-03 FE:TKT-04 FE:TKT-05 FE:TKT-06 FE:TKT-07 FE:TKT-08 FE:TKT-10 FE:TKT-11 FE:TKT-12 FE:TKT-13 BE:TKT-06 BE:TKT-07 BE:TKT-08 BE:TKT-14'.split():
  row.update(role='Customer',journey='Retrieve confirmed tickets, display QR/status, save printable tickets and import calendar',frontendRoute='/bookings/:id',backendModule='bookings; inventory; ticketing',apiUseCase='TicketWallet.view/document/calendar; TicketReader.list',dataOwnership='bookings order; inventory occurrence; ticketing entitlement',permissions='Authenticated current order owner; private no-store downloads',transactionRules='Order then sorted occurrence then ticket read locks; rendering outside transaction; no issuance on retrieval; no credentials for non-admissible status',implementationStatus='partial',verificationStatus='local_database_http_qr_calendar_verified_browser_unverified',acceptanceTests=['tests/tickets.test.ts'],evidence=['docs/evidence/ticket-full-suite.txt','docs/architecture/adr-008-ticket-access.md'],dependencies=['Browser/print/a11y acceptance; PDF; resend; configured admission windows; directions/address; complete attendee mapping; transfer/cancellation orchestration'])
for parent,suffix,requirement in [
 ('BE:TKT-07','wallet','Authenticate order ownership before ticket wallet or portable HTML document retrieval.'),
 ('BE:TKT-14','calendar','Generate owner-authorized RFC 5545 data with escaped folded text and UTC event instants without ticket credentials.'),
 ('BE:TKT-08','document','Render repeated ticket documents without issuing new entitlements or rotating existing credentials.')]:
 original=next(row for row in rows if row['id']==parent)
 rows.append({**original,'id':parent+'.'+suffix,'parentId':parent,'requirement':requirement,'decompositionStatus':'atomic tested subrequirement','implementationStatus':'implemented','verificationStatus':'local_database_http_qr_calendar_verified_not_browser'})

for row in rows:
 if row['id'] in 'BE:REF-02 BE:REF-03 BE:REF-05 BE:REF-07 BE:REF-08 BE:BKG-06 BE:PAY-14 FE:BKG-04 FE:BKG-05 FE:BKG-07 FE:BKG-09 FE:BKG-10 FE:BKG-12'.split():
  row.update(role='Customer',journey='Review and cancel an order still awaiting booking confirmation',frontendRoute='/bookings/:id',backendModule='bookings; inventory; payments; reporting',apiUseCase='PendingCancellation.preview/cancel',dataOwnership='bookings preview/command/cancellation; inventory holds; payments recovery',permissions='Current order owner; explicit payment-risk acknowledgment',transactionRules='Actor command serialization; order and occurrence/reservation locks; preview expiry/payment-activity recheck; atomic release and durable cancellation; late capture cannot resurrect booking',implementationStatus='partial',verificationStatus='local_database_http_verified_browser_unverified',acceptanceTests=['tests/pending-cancellation.test.ts'],evidence=['docs/evidence/pending-cancellation-full-suite.txt','docs/architecture/adr-009-pending-order-cancellation.md'],dependencies=['Structured purchased refund policy; confirmed-ticket full/partial cancellation; actual refund execution/reconciliation; browser acceptance'])
rows.append({'id':'GAP:PENDING-CANCEL-01','requirement':'Allow owner-authorized cancellation of unconfirmed orders with atomic hold release and late-capture recovery, without promising a completed refund.','source':'docs/architecture/adr-009-pending-order-cancellation.md','role':'Customer','journey':'Cancel pending order','frontendRoute':'/bookings/:id','backendModule':'bookings; inventory; payments; reporting','apiUseCase':'PendingCancellation.preview/cancel','dataOwnership':'bookings cancellation records; inventory holds; payments recovery','permissions':'Order owner and explicit payment-risk acknowledgment','transactionRules':'Order serialization; preview expiry and payment activity checks; atomic inventory release, command, audit and outbox','acceptanceTests':['tests/pending-cancellation.test.ts'],'implementationStatus':'implemented','verificationStatus':'local_database_http_verified_not_browser','evidence':['docs/evidence/pending-cancellation-full-suite.txt'],'dependencies':['Browser acceptance; live payment verification'],'decompositionStatus':'atomic pending-order subset; not confirmed-ticket refund acceptance'})

for row in rows:
 if row['id'] in 'FE:AUTH-02 FE:AUTH-03 FE:AUTH-04 FE:AUTH-05 FE:AUTH-08 BE:IAM-01 BE:IAM-02 BE:IAM-06 BE:IAM-07 BE:IAM-08 BE:IAM-10 BE:IAM-11'.split():
  row.update(role='Customer',journey='Request local verification email, create verified account or log in, recover session and log out',frontendRoute='Sign-in dialog',backendModule='identity',apiUseCase='Authentication.request/verify; MailpitOtp; session authentication/logout',dataOwnership='identity challenges/accounts/sessions',permissions='Verified single-use email challenge; private HTTP-only session',transactionRules='OTP attempt/expiry/cooldown limits and atomic verification/session creation; SMTP outside transaction; account created only after verification',implementationStatus='partial',verificationStatus='local_real_http_smtp_verified_browser_and_external_delivery_unverified',acceptanceTests=['tests/email-login.test.ts'],evidence=['docs/evidence/mailpit-full-suite.txt','docs/evidence/mailpit-container-tests.txt'],dependencies=['Browser acceptance; real external sender verification; phone OTP and remaining identity scope'])

for row in rows:
 if row['id'] in 'BE:SUP-02 BE:SUP-03 BE:SUP-04 BE:SUP-06 FE:SUP-A-01 FE:SUP-A-03 FE:SUP-A-04 FE:SUP-A-06 FE:SUP-A-07 FE:SUP-A-08'.split():
  row.update(role='Support agent',journey='Filter, claim, prioritize, escalate, reply and resolve cases',frontendRoute='/operations',backendModule='support',apiUseCase='SupportOperations.queue/detail/change/reply',dataOwnership='support cases/messages; reporting audit',permissions='Active authenticated account; fresh staff MFA; platform support grant; assigned agent for writes',transactionRules='Case row lock, expected version, atomic action/message/audit; stale retry conflicts without duplicating replies',implementationStatus='partial',verificationStatus='local_database_http_verified_not_browser',acceptanceTests=['tests/support-operations.test.ts'],evidence=['docs/evidence/support-full-suite.txt','docs/architecture/adr-011-support-workflow.md'],dependencies=['Browser acceptance; paging beyond latest 100; attachments; booking/payment links; financial actions; supervisor reassignment; retry outcome lookup'])
for row in rows:
 if row['id'] in 'BE:PRV-08 BE:PRV-09 FE:PRV-09'.split():
  row.update(role='Organization owner; invited staff',journey='Invite verified email, accept editor/viewer membership, change or revoke access',frontendRoute='/partner',backendModule='providers',apiUseCase='ProviderStaff.inbox/list/invite/accept/revoke/member',dataOwnership='providers invitations and memberships',permissions='Owner membership plus fresh MFA for management; verified matching contact for acceptance',transactionRules='Organization locks; scoped create idempotency; database expiry; accepted replay never restores revoked membership; non-reused membership versions',implementationStatus='partial',verificationStatus='local_database_http_verified_not_browser',acceptanceTests=['tests/provider-staff.test.ts'],evidence=['docs/evidence/provider-staff-full-suite.txt','docs/architecture/adr-012-provider-staff.md'],dependencies=['Browser acceptance; actual invitation email delivery/resend; production-configurable expiry; pagination; ownership transfer; granular venue/occurrence roles'])
for row in rows:
 if row['id'] in 'BE:NTF-01 BE:NTF-03 BE:NTF-04 BE:NTF-05 BE:NTF-06 BE:NTF-07 BE:NTF-11 BE:NTF-12 FE:ENG-04 BE:JOB-02 BE:JOB-03'.split():
  row.update(role='Customer; support agent',journey='Receive persisted booking updates; read inbox; inspect and replay failed inbox delivery',frontendRoute='/notifications; /operations',backendModule='notifications; reporting',apiUseCase='Notifications.once/list/read; durable consumer; failures/replay',dataOwnership='notifications messages/read state; reporting source events and consumer deliveries',permissions='Owner-only inbox; support grant and fresh MFA for delivery recovery',transactionRules='Row-locked database consumer; message and acknowledgment atomic; unique event deduplication; five-attempt backoff; audited replay',implementationStatus='partial',verificationStatus='local_database_http_verified_not_browser',acceptanceTests=['tests/notifications.test.ts'],evidence=['docs/evidence/notification-full-suite.txt','docs/architecture/adr-013-in-app-notifications.md'],dependencies=['Browser acceptance; localized templates; email/SMS/push; reminders; retention/account deletion; full event families; production observability'])
for row in rows:
 if row['id'] in 'BE:PRC-13 BE:BKG-08 FE:CHK-UI-13 BE:INV-14'.split():
  row.update(role='Customer; pricing administrator',journey='Authorize zero-total booking in approved policy, accept terms and confirm free order',frontendRoute='/admin/pricing; /checkout/:id; /bookings/:id',backendModule='pricing; bookings; inventory; ticketing; reporting',apiUseCase='FreeConfirmation.confirm; policy approval; quote/placement',dataOwnership='pricing policy; bookings free confirmations/commands; inventory allocation; ticketing tickets',permissions='Pricing grant plus MFA for policy; owner-only accepted eligible order for confirmation',transactionRules='Owner key serialization and order lock; active hold/database-time recheck; atomic inventory, order, tickets, audit and outbox; no fabricated payment',implementationStatus='partial',verificationStatus='local_database_http_verified_not_browser',acceptanceTests=['tests/free-booking.test.ts'],evidence=['docs/evidence/free-booking-full-suite.txt','docs/architecture/adr-014-free-bookings.md'],dependencies=['Browser acceptance; restricted complimentary allocation eligibility; free confirmed-ticket cancellation; production policy approval'])
for row in rows:
 if row['id'] in 'BE:REF-01 BE:REF-02 BE:REF-03 BE:REF-04 BE:REF-05 BE:REF-06 BE:REF-07 FE:BKG-05 FE:BKG-06 FE:BKG-07 FE:BKG-09 FE:BKG-10'.split():
  row.update(role='Customer; pricing administrator',journey='Preview and fully cancel an explicitly eligible confirmed free booking',frontendRoute='/admin/pricing; /bookings/:id',backendModule='bookings; inventory; ticketing; pricing; reporting; notifications',apiUseCase='FreeCancellation.preview/cancel',dataOwnership='bookings preview/cancellation/command; inventory sold capacity; ticketing validity',permissions='Owner-only booking; accepted immutable policy cutoff; all tickets valid and unused',transactionRules='Order/occurrence/resource/ticket locks; capped preview expiry; atomic revoke, capacity release, cancellation, audit and outbox; scoped idempotency',implementationStatus='partial',verificationStatus='local_database_http_verified_not_browser',acceptanceTests=['tests/free-cancellation.test.ts','tests/pending-cancellation.test.ts'],evidence=['docs/evidence/free-cancellation-full-suite.txt','docs/architecture/adr-015-free-cancellation.md'],dependencies=['Browser/physical scanner acceptance; paid cancellation/refunds; partial cancellation; retention; disruption handling'])
for row in rows:
 if row['id'] in 'FE:SRC-02 FE:SRC-03 FE:SRC-04 FE:SRC-05 FE:SRC-06 FE:SRC-07 FE:SRC-09 FE:SRC-10 FE:SRC-11 FE:SRC-12 FE:SRC-13 FE:SRC-15 BE:DSC-01 BE:DSC-03 BE:DSC-04 BE:DSC-05 BE:DSC-12'.split():
  row.update(role='Customer',journey='Search published listings, apply metadata filters and navigate pages',frontendRoute='/movies; /events; /sports; /explore',backendModule='catalog',apiUseCase='Discovery.search/suggestions',dataOwnership='catalog published listings',permissions='Published public content only',transactionRules='Read-only keyset query; filter-scoped cursor; booking authority stays in Inventory',implementationStatus='partial',verificationStatus='local_database_http_verified_not_browser',acceptanceTests=['tests/discovery.test.ts'],evidence=['docs/evidence/cinema-sports-full-suite.txt','docs/architecture/adr-016-discovery.md'],dependencies=['Browser/a11y; additional entities and filters; mobile drawer; load verification'])
 if row['id'] in 'BE:CIN-01 BE:CIN-03 BE:CIN-04 BE:CIN-06 BE:CIN-07 BE:CIN-10 BE:SPT-01 BE:SPT-02 BE:SPT-03 BE:SPT-04 FE:MOV-UI-01 FE:MOV-UI-06 FE:MOV-UI-07 FE:MOV-UI-10 FE:MOV-UI-11 FE:SPT-UI-01 FE:SPT-UI-03 FE:SPT-UI-04 FE:SPT-UI-05'.split():
  row.update(role='Cinema partner; sports organizer; customer',journey='Create category draft, publish, schedule venue inventory, reserve, confirm free booking and cancel',frontendRoute='/partner/venues; /movies; /sports; /listing/:id; /occurrence/:id; /bookings/:id',backendModule='cinema; sports; catalog; venues; inventory; pricing; bookings; ticketing',apiUseCase='Movies/Fixtures.save/list/detail; Scheduling; reservation and free lifecycle',dataOwnership='Cinema movie details; Sports fixture details; Catalog publication; Inventory allocation',permissions='Organization write membership; staff moderation/pricing MFA; customer owner',transactionRules='Atomic category/catalog draft write through public port; scoped full-input idempotency; existing inventory/order locks',implementationStatus='partial',verificationStatus='local_database_http_verified_not_browser',acceptanceTests=['tests/cinema-sports.test.ts'],evidence=['docs/evidence/cinema-sports-full-suite.txt','docs/evidence/demo-http-verification.json','docs/architecture/adr-017-cinema-sports.md'],dependencies=['Browser/a11y; per-show variants; bulk schedules; concessions; passes; hospitality fulfillment; disruptions; live payments/refunds'])
rows.append(dict(id='GAP:DEMO-001',requirement='Provide user-authorized clearly fictional local cinema/sports data and block real payment collection for demo inventory.',source='Latest explicit user request for mock cinema movies and sports events',**{**fields,'role':'Local developer; demo customer','journey':'Browse and book a labeled free demo session','frontendRoute':'/movies; /sports','backendModule':'cinema; sports; inventory; bookings','apiUseCase':'seed-demo.ts; PaymentOrders.prepare demo guard','dataOwnership':'Module-owned persisted local demo records','permissions':'Opt-in development-only seed with local host/database guards','transactionRules':'Normal module workflows; demo flag persists; no fake capture; repeat seed preserves bookings','implementationStatus':'implemented','verificationStatus':'local_http_database_verified_not_browser','acceptanceTests':['tests/cinema-sports.test.ts','scripts/verify-demo.ts'],'evidence':['docs/evidence/demo-seed.json','docs/evidence/demo-seed-repeat.json','docs/evidence/demo-http-verification.json'],'dependencies':['Browser acceptance; no production authorization']}))
for row in rows:
 if row['id'] in 'FE:PRO-03 FE:PRO-07 FE:PRO-08 BE:CUS-03 BE:CUS-06 BE:CUS-07'.split():
  row.update(role='Customer',journey='Save language and optional marketing email consent; withdraw consent',frontendRoute='/profile',backendModule='profiles',apiUseCase='GET/PUT /api/v1/profile/communications',dataOwnership='profiles.communication_preferences; profiles.marketing_consent_history',permissions='Authenticated account only; no submitted owner identity',transactionRules='Row lock; version conflict; identical immediate retry; atomic consent history',implementationStatus='partial',verificationStatus='database_http_verified_not_browser',acceptanceTests=['tests/communication-preferences.test.ts'],evidence=['docs/evidence/communication-full-suite.txt','docs/architecture/adr-018-communication-preferences.md'],dependencies=['Browser/a11y acceptance; localized templates; campaign delivery; broader consent purposes and privacy workflows'])
for row in rows:
 if row['id'] in 'FE:EVT-UI-01 FE:EVT-UI-02 FE:EVT-UI-03 FE:EVT-UI-04 FE:EVT-UI-06 FE:EVT-UI-07 FE:EVT-UI-09 FE:OPS-E-01 FE:OPS-E-03 FE:OPS-E-04 FE:OPS-E-05 BE:EVT-01 BE:EVT-02 BE:EVT-04 BE:EVT-08 BE:EVT-09 BE:EVT-10'.split():
  row.update(role='Event organizer; customer',journey='Draft, publish, schedule and book an event with versioned attendee registration',frontendRoute='/partner/venues; /events; /listing/:id; /occurrence/:id; /checkout/:id; /bookings/:id',backendModule='events; catalog; inventory; pricing; bookings; ticketing',apiUseCase='EventCatalog.save/list/detail; Forms.publish/validate; reservation, quote, order and confirmation',dataOwnership='events catalog_details and immutable form definitions; catalog publication; inventory allocation; bookings encrypted answers',permissions='Organization writer; moderator; customer-owned reservation/order',transactionRules='Atomic category/catalog writes; scoped idempotency/version checks; inventory locks; attendee schema validation at order acceptance; immutable accepted form',implementationStatus='partial',verificationStatus='database_http_verified_not_browser',acceptanceTests=['tests/cinema-sports.test.ts: events and events-seated','tests/registration.test.ts'],evidence=['docs/evidence/event-workflow-full-suite.txt','docs/architecture/adr-019-event-booking.md'],dependencies=['Browser/accessibility acceptance; recurrence rules; categories/phases/packages/passes; online access; disruptions; live paid-event verification'])
for row in rows:
 if row['id'] in 'BE:PAY-10 BE:PAY-12 BE:PAY-13 BE:WHK-01 BE:WHK-03 BE:WHK-04'.split():
  row.update(role='Customer; payment worker',journey='Razorpay checkout and uncertain-payment recovery',frontendRoute='/bookings/:id',backendModule='payments; bookings',apiUseCase='Collection.initiate/callback/requestRecovery; webhook ingestion; PaymentReconciliation',dataOwnership='payments provider orders, attempts and webhook inbox; bookings confirmation',permissions='Owner-only commands; signed provider webhook',transactionRules='Trusted amount/mapping; raw-body HMAC; durable deduplicated recovery; preserve lease/backoff; atomic capture fulfillment',implementationStatus='partial',verificationStatus='database_http_verified_not_live_provider',acceptanceTests=['tests/payment.test.ts','tests/inventory.test.ts'],evidence=['docs/evidence/razorpay-full-suite.txt','docs/architecture/adr-020-payment-recovery.md'],dependencies=['Reference repository inaccessible; merchant credentials; public HTTPS webhooks; authorized live charge; browser acceptance; paid refunds/disputes'])
for row in rows:
 if row['id'] in 'FE:VIS-01 FE:VIS-02 FE:VIS-03 FE:VIS-04 FE:VIS-05 FE:THM-08 FE:EVT-UI-03 FE:EVT-UI-04 FE:EVT-UI-06'.split():
  row.update(role='Customer',journey='Browse detail, select showtime and tickets, review checkout',frontendRoute='/listing/:id; /occurrence/:id; /checkout/:id; /bookings/:id',backendModule='existing catalog/inventory/pricing/bookings APIs',apiUseCase='Existing published detail, session inventory, reservation and quote contracts',dataOwnership='Backend modules remain authoritative; frontend selection only',permissions='Public discovery; authenticated owner checkout',transactionRules='No change to allocation/payment invariants; no optimistic confirmation',implementationStatus='partial',verificationStatus='component_render_checked_visual_unverified',acceptanceTests=['tests/booking-design.test.ts'],evidence=['docs/evidence/booking-design-reference-audit.md','docs/evidence/booking-design-full-suite.txt'],dependencies=['Browser/reference screenshot access; five-width Light/Dark visual and accessibility acceptance'])
for row in rows:
 if row['id'] in 'FE:DIS-04 FE:DIS-05 FE:EVT-UI-01 FE:EVT-UI-03 FE:EVT-UI-06 FE:EVT-UI-07 BE:EVT-01 BE:EVT-04 BE:EVT-09 BE:DSC-01'.split():
  row.update(role='Customer; event organizer',journey='Find upcoming events and book a configured single session',frontendRoute='/events; /listing/:id; /occurrence/:id; /checkout/:id; /bookings/:id',backendModule='catalog; events; inventory; pricing; bookings; ticketing',apiUseCase='CatalogSessions.recordSession; upcoming catalog query; real reservation/order/registration/ticket APIs',dataOwnership='catalog rebuildable schedule projection; inventory allocation; events details/forms; bookings accepted registrations',permissions='Published discovery; organizer writes; customer-owned checkout',transactionRules='Atomic scheduling/projection; DB-time upcoming predicate; scoped cursors; protected capacity and confirmation',implementationStatus='partial',verificationStatus='local_demo_http_journey_verified_not_browser_or_paid',acceptanceTests=['tests/discovery.test.ts','tests/cinema-sports.test.ts','scripts/verify-event-booking.ts'],evidence=['docs/evidence/upcoming-events-tests.txt','docs/evidence/events-deployed-booking.json','docs/architecture/adr-021-upcoming-events.md'],dependencies=['Browser acceptance; recurrence/packages/passes; online access/disruptions; projection rebuild tooling; live merchant setup and paid refunds'])
for row in rows:
 if row['id'] in 'FE:OPS-E-01 BE:EVT-02 BE:EVT-03 BE:SCH-01 BE:SCH-03 BE:SCH-09'.split():
  row.update(role='Event organizer; venue operator',journey='Preview and atomically publish daily/weekly concrete sessions with excluded dates',frontendRoute='/partner/venues',backendModule='inventory; venues; catalog; reporting',apiUseCase='Scheduling.previewSeries/createSeries',dataOwnership='inventory series command and occurrences; catalog schedule projection',permissions='Organization writer; approved organization; owned published listing and venue plan',transactionRules='One local transaction; deterministic child keys; actor advisory lock; all-or-nothing conflicts; permission recheck on replay; venue-offset validation',implementationStatus='partial',verificationStatus='postgres_http_verified_not_browser',acceptanceTests=['tests/venues.test.ts: recurring series tests'],evidence=['docs/evidence/recurring-schedule-full-suite.txt','docs/architecture/adr-022-recurring-schedules.md'],dependencies=['Browser acceptance; existing-series edits and individual rescheduling; bulk form/policy assignment; DST-aware rule engine; packages/passes'])
for row in rows:
 if row['id'] in ['FE:EVT-UI-10','BE:EVT-11']:
  row.update(role='Organizer; confirmed ticket holder',journey='Configure and reveal protected online joining information',frontendRoute='/partner/venues; /bookings/:id',backendModule='events; bookings; inventory; ticketing; reporting',apiUseCase='OnlineAccess.configure/configuration/access',dataOwnership='events encrypted settings; bookings eligibility through injected port',permissions='Approved organization writer to configure; owned confirmed booking and valid unused ticket to reveal',transactionRules='Optimistic configuration version; booking/occurrence/ticket/config locks; database time after locks; encrypted URL; audit without secret',implementationStatus='partial',verificationStatus='postgres_http_verified_not_browser',acceptanceTests=['tests/cinema-sports.test.ts: events and events-seated online access checks'],evidence=['docs/evidence/online-access-full-suite.txt','docs/evidence/online-access-container-tests.txt','docs/architecture/adr-023-online-event-access.md'],dependencies=['Browser acceptance; approved production window policy; external meeting-provider attendee controls; master-key rotation procedure'])
for row in rows:
 if row['id'] in ['FE:ADM-UI-15','BE:DAT-11','BE:DAT-12','BE:DAT-13']:
  row.update(role='Platform auditor with fresh MFA',journey='Search immutable audit metadata and traverse older records',frontendRoute='/admin/audit',backendModule='reporting',apiUseCase='AuditHistory.search',dataOwnership='reporting.audit',permissions='Platform audit grant and current MFA on every page',transactionRules='Read-only parameterized query; bigint keyset pagination; account/filter-bound cursor; immutable-row triggers; no arbitrary details JSON disclosure',implementationStatus='partial',verificationStatus='postgres_http_verified_not_browser',acceptanceTests=['tests/audit-history.test.ts'],evidence=['docs/evidence/audit-history-full-suite.txt','docs/evidence/audit-history-container-tests.txt','docs/architecture/adr-024-audit-history.md'],dependencies=['Browser/accessibility acceptance; complete tenant/correlation/reason/outcome capture across writers; approved retention/archive workflow'])
for row in rows:
 if row['id'] in ['FE:BKG-01','FE:BKG-02','FE:BKG-17','BE:BKG-03','BE:BKG-13']:
  row.update(role='Customer',journey='Search owned booking history and open saved booking details',frontendRoute='/bookings',backendModule='bookings; inventory; catalog',apiUseCase='BookingHistory.search; Catalog.bookingTitle at quote snapshot creation',dataOwnership='bookings immutable order snapshots; catalog published title source',permissions='Authenticated owner on every request; cursor bound to account and filters',transactionRules='Owner-scoped read; exact microsecond timestamp/UUID keyset; immutable title accepted from locked published catalog; no historical backfill',implementationStatus='partial',verificationStatus='postgres_http_verified_not_browser',acceptanceTests=['tests/booking-history.test.ts','tests/cinema-sports.test.ts: saved title after rename'],evidence=['docs/evidence/booking-history-full-suite.txt','docs/evidence/booking-history-container-tests.txt','docs/architecture/adr-025-booking-history.md'],dependencies=['Browser/accessibility acceptance; partial cancellation and complete independent payment/refund/disruption timelines; historical titles absent for prior bookings'])
for row in rows:
 if row['id'] in ['BE:SUP-02','BE:SUP-06','BE:SUP-08','FE:SUP-A-07','FE:SUP-A-08']:
  row.update(role='Authorized support supervisor',journey='Assign or reassign an unresolved support case to an eligible agent',frontendRoute='/operations',backendModule='support; identity; reporting',apiUseCase='SupportAssignment.assign',dataOwnership='support case and assignment commands; identity account/grants',permissions='Active support and support_assign operator grants; recent MFA; active support target',transactionRules='Actor retry serialization; case row lock; identity/grant shared locks; version check; request fingerprint; atomic assignment/outcome/audit',implementationStatus='partial',verificationStatus='postgres_http_verified_not_browser',acceptanceTests=['tests/support-assignment.test.ts'],evidence=['docs/evidence/support-assignment-full-suite.txt','docs/evidence/support-assignment-container-tests.txt','docs/architecture/adr-026-support-assignment.md'],dependencies=['Browser acceptance; target directory search; broader controlled operational actions and notification workflows'])
for row in rows:
 if row['id'] in ['FE:SUP-C-07','FE:SUP-C-04','FE:SUP-C-05']:
  row.update(role='Customer',journey='Request further review of an unresolved owned support case',frontendRoute='/cases',backendModule='support; reporting',apiUseCase='CustomerEscalation.request',dataOwnership='support cases/messages/escalation commands; reporting audit',permissions='Authenticated case owner only',transactionRules='Owner command serialization; case lock/version; fingerprinted retry outcome; atomic escalation/message/audit',implementationStatus='partial',verificationStatus='postgres_http_verified_not_browser',acceptanceTests=['tests/support-operations.test.ts: customer escalation tests'],evidence=['docs/evidence/customer-escalation-full-suite.txt','docs/evidence/customer-escalation-container-tests.txt','docs/architecture/adr-027-customer-escalation.md'],dependencies=['Browser/accessibility acceptance; broader case requirements and operational policies'])
for row in rows:
 if row['id'] in ['FE:SUP-C-02','FE:SUP-A-05','BE:SUP-01','BE:SUP-05']:
  row.update(role='Customer; authorized support agent',journey='Create a case linked to an owned booking and inspect restricted context',frontendRoute='/cases; /operations',backendModule='support; bookings',apiUseCase='Cases.create; SupportOperations.detail; SupportBookingReader.readOwned',dataOwnership='support case reference; bookings order truth',permissions='Customer owns linked booking; staff support grant with fresh MFA at detail access',transactionRules='Owned booking shared lock within case creation; failure rolls back case/message; restricted current summary through public contract',implementationStatus='partial',verificationStatus='postgres_http_verified_not_browser',acceptanceTests=['tests/booking-history.test.ts: linked support context'],evidence=['docs/evidence/support-booking-full-suite.txt','docs/evidence/support-booking-container-tests.txt','docs/architecture/adr-028-support-booking-context.md'],dependencies=['Browser/accessibility acceptance; attachments; payment/refund/settlement links; complete timelines; durable case-creation idempotency'])
for row in rows:
 if row['id']=='FE:SUP-C-02':
  row.update(apiUseCase='Cases.create with optional owned booking link and actor-scoped idempotency key',transactionRules='Owner advisory lock; fingerprinted durable outcome; atomic case/message/audit; owned booking validation; no mutation on replay',acceptanceTests=['tests/booking-history.test.ts: linked support context','tests/support-operations.test.ts: case creation retries'],evidence=['docs/evidence/support-booking-full-suite.txt','docs/evidence/case-retries-full-suite.txt','docs/evidence/case-retries-container-tests.txt','docs/architecture/adr-029-case-creation-retries.md'],dependencies=['Attachments; browser acceptance; legacy clients must adopt request keys; page-reload draft recovery'])
for row in rows:
 if row['id'] in ['FE:SUP-C-04','FE:SUP-A-03','FE:SUP-A-04']:
  row.update(apiUseCase='Customer/staff replies with actor/channel-scoped durable keys and audience protection',transactionRules='Actor serialization; owned/authorized case lock; fingerprinted outcome; atomic message/case/audit; replay cannot reopen later resolution',implementationStatus='partial',verificationStatus='postgres_http_verified_not_browser',acceptanceTests=['tests/support-operations.test.ts: reply retry concurrency and privacy'],evidence=['docs/evidence/reply-retries-full-suite.txt','docs/evidence/reply-retries-container-tests.txt','docs/architecture/adr-030-support-reply-retries.md'],dependencies=['Browser acceptance; durable draft recovery after remount; headerless legacy clients need keys; wider support acceptance scope'])
for row in rows:
 if row['id'] in ['FE:SUP-A-01','BE:API-05']:
  row.update(role='Authorized support agent',journey='Filter case queues and navigate older cases',frontendRoute='/operations',backendModule='support',apiUseCase='SupportOperations.queue',dataOwnership='support.cases',permissions='Current platform support permission and fresh MFA for every page',transactionRules='Read-only parameterized query; exact microsecond timestamp/UUID keyset; actor/filter-scoped cursor; live filter membership',implementationStatus='partial',verificationStatus='postgres_http_verified_not_browser',acceptanceTests=['tests/support-operations.test.ts: support queue pages'],evidence=['docs/evidence/queue-pagination-full-suite.txt','docs/architecture/adr-031-support-queue-pagination.md'],dependencies=['Browser/accessibility acceptance; browser history restoration; broader API pagination coverage'])
for row in rows:
 if row['id'] in ['FE:SUP-A-07','BE:SUP-02']:
  row['apiUseCase'] += '; SupportDirectory.search for controlled agent selection'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/support-assignment.test.ts: Support directory restricts disclosure']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/agent-directory-full-suite.txt','docs/architecture/adr-032-support-agent-directory.md']))
  row['dependencies'] = ['Browser/accessibility acceptance; assignment notifications; broader support lifecycle and directory-read auditing']
for row in rows:
 if row['id'] in ['FE:SUP-A-07','FE:SUP-A-08','BE:SUP-02','BE:SUP-06','BE:SUP-08']:
  row['apiUseCase'] += '; SupportOperations.change with durable actor-scoped action retries'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/support-operations.test.ts: Keyed workflow actions']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/action-retries-full-suite.txt','docs/architecture/adr-033-support-action-retries.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Legacy action callers must adopt keys; view-remount recovery and approved command retention remain outstanding']))
for row in rows:
 if row['id'] in ['FE:SUP-C-04','BE:NTF-05','BE:NTF-11','BE:NTF-12']:
  row['apiUseCase'] += '; support.staff_replied outbox and customer inbox; owner-scoped exact case selection'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/support-operations.test.ts: Customer-visible staff replies']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/support-notices-full-suite.txt','docs/architecture/adr-034-support-reply-notifications.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Support notification browser acceptance; external reply delivery and assignment notices remain open']))
for row in rows:
 if row['id'] in ['FE:SUP-C-04','BE:API-05']:
  row['apiUseCase'] += '; owner-scoped customer case keyset pagination and exact conversation navigation'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/support-operations.test.ts: Customer case history traverses timestamp ties']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/case-history-full-suite.txt','docs/architecture/adr-035-customer-case-history.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Customer history browser/accessibility acceptance; conversation-message pagination; durable draft/scroll restoration']))
for row in rows:
 if row['id'] in ['FE:SUP-C-04','BE:SUP-03','BE:API-05']:
  row['apiUseCase'] += '; bounded customer-visible conversation pages with owner/case-scoped cursors'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/support-operations.test.ts: Customer conversations page visible messages']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/conversation-pages-full-suite.txt','docs/architecture/adr-036-customer-conversation-pages.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Staff-thread pagination; API clients must follow message cursors; browser acceptance and durable drafts remain open']))
for row in rows:
 if row['id'] in ['FE:SUP-C-04','BE:API-05']:
  row['dependencies'] = [dependency.replace('conversation-message pagination', 'staff conversation-message pagination') for dependency in row['dependencies']]
for row in rows:
 if row['id'] in ['FE:SUP-A-03','FE:SUP-A-04','BE:SUP-03','BE:API-05']:
  row['apiUseCase'] += '; audited bounded staff detail message pages with actor/case-scoped cursors'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/support-operations.test.ts: Staff thread pages retain audience labels']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/staff-thread-full-suite.txt','docs/architecture/adr-037-staff-conversation-pages.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Staff message pagination browser acceptance; durable drafts and full detail response schemas remain open']))
for row in rows:
 if row['id'] in ['FE:SUP-C-04','FE:SUP-A-03','FE:SUP-A-04','BE:SUP-03','BE:API-05']:
  row['dependencies'] = [dependency.replace('Staff-thread pagination;', 'Staff-thread browser acceptance;').replace('staff conversation-message pagination;', 'staff conversation-message browser acceptance;') for dependency in row['dependencies']]
for row in rows:
 if row['id'] in ['BE:SUP-02','FE:SUP-A-07','BE:NTF-05','BE:NTF-11','BE:NTF-12']:
  row['apiUseCase'] += '; atomic support.case_assigned outbox and recipient inbox with protected case link'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/support-assignment.test.ts: Supervisor assignment notices']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/assignment-notices-full-suite.txt','docs/architecture/adr-038-assignment-notifications.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Assignment notice browser acceptance; external delivery and self-claim/reminder policy remain open']))
for row in rows:
 row['dependencies'] = [dependency.replace('assignment notifications;', 'assignment notification browser acceptance;').replace('assignment notices remain open', 'assignment notice browser acceptance remains open') for dependency in row['dependencies']]
for row in rows:
 if row['id'] in ['BE:NTF-11','BE:API-05']:
  row['apiUseCase'] += '; exact PostgreSQL microsecond boundaries for owner-scoped notification UUID cursors'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/notifications.test.ts: Notification paging preserves microsecond boundaries']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/inbox-precision-regression-before.txt','docs/evidence/inbox-precision-full-suite.txt','docs/architecture/adr-039-inbox-cursor-precision.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Inbox browser/error-state/accessibility acceptance; approved retention policy']))
for row in rows:
 if row['id'] in ['BE:DAT-11','BE:DAT-12','FE:ADM-UI-15','BE:SUP-02']:
  row['apiUseCase'] += '; atomic identity.support_directory.read access audit with bounded identifiers and no contact/search content'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/support-assignment.test.ts: Directory access audit']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/directory-audit-full-suite.txt','docs/architecture/adr-040-support-directory-audit.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Approved audit retention; denied-access logging; controlled detail export and browser acceptance']))
for row in rows:
 row['dependencies'] = [dependency.replace('directory-read auditing','directory-read audit browser acceptance') for dependency in row['dependencies']]
for row in rows:
 if row['id'] in ['FE:VEN-01','FE:VEN-02','FE:VEN-03','FE:VEN-05','FE:VEN-06','BE:VEN-02','BE:VEN-03','BE:VEN-04']:
  row['apiUseCase'] += '; public venue details and scoped upcoming-session pages via GET /api/v1/venues/:id and /venue/:id'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/venues.test.ts: Public venues require published discovery and approved providers']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/public-venues-full-suite.txt','docs/architecture/adr-041-public-venues.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Venue contact permissions, media, transport/parking, entry policies, publication lifecycle and browser/accessibility acceptance remain open; discovery is not sale authority']))
for row in rows:
 if row['id'] in ['FE:VEN-02','FE:VEN-05','BE:VEN-03','BE:VEN-04']:
  row['apiUseCase'] += '; provider venue guidance editor and version-checked POST /api/v1/organizations/:id/venues/:venueId/guidance with public transport/parking/entry-policy display'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/venues.test.ts: Venue guidance is tenant protected, versioned, audited and public only through discovery']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/venue-guidance-full-suite.txt','docs/architecture/adr-042-venue-guidance.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Guidance API/UI implemented; browser/accessibility acceptance, contact permissions, media and separate venue publication remain open']))
for row in rows:
 row['dependencies'] = [d.replace('Venue contact permissions, media, transport/parking, entry policies, publication lifecycle and browser/accessibility acceptance remain open; discovery is not sale authority', 'Venue contact permissions, media, publication lifecycle and browser/accessibility acceptance remain open; transport/parking/entry guidance is implemented; discovery is not sale authority') for d in row['dependencies']]
for row in rows:
 if row['id'] == 'FE:VEN-01':
  row['apiUseCase'] += '; provider contact editor and POST /api/v1/organizations/:id/venues/:venueId/contact with explicit publication permission, withdrawal and private response omission'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/venues.test.ts: Venue contacts require explicit publication permission and support withdrawal without leaking private values']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/venue-contact-full-suite.txt','docs/architecture/adr-043-venue-contact.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Contact display permission implemented; browser/accessibility acceptance and contact verification remain open']))
for row in rows:
 if row['id'].startswith('FE:VEN-') or row['id'] in ['BE:VEN-02','BE:VEN-03','BE:VEN-04']:
  row['dependencies'] = [d.replace('contact permissions,', 'contact browser acceptance,').replace('Contact permissions,', 'Contact browser acceptance,') for d in row['dependencies']]
for row in rows:
 if row['id'] in ['FE:VEN-04','FE:CAT-02','BE:CAT-03']:
  row['apiUseCase'] += '; venue-only ordered HTTPS photo/map references with alt text, attribution, preview/removal and POST /api/v1/organizations/:id/venues/:venueId/media'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/venues.test.ts: Venue media validates references and preserves ordered metadata','tests/venue-media-ui.test.ts: initial render privacy and escaped text']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/venue-media-full-suite.txt','docs/architecture/adr-044-venue-media.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Hosted venue image references implemented; uploads/crop, controlled storage, moderation, catalog-wide media and browser/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:ENG-01','FE:ENG-02','FE:NAV-03','BE:CUS-04','BE:ENG-07']:
  row['apiUseCase'] += '; account-owned venue favorites GET/PUT/DELETE /api/v1/venue-favorites with public-summary contract, /favorites/venues pagination and save from public venue page'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/venues.test.ts: Venue favorites are retry safe, owner scoped, paginated and redact withdrawn venues']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/venue-favorites-full-suite.txt','docs/architecture/adr-045-venue-favorites.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Venue favorites implemented; artist/team favorites, alert subscriptions, sign-in continuation/browser/accessibility and load acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRO-01','FE:PRO-07','BE:CUS-01','BE:CUS-03','FE:THM-05']:
  row['apiUseCase'] += '; versioned GET/PUT /api/v1/profile, editable preferred city, explicit stale-draft recovery and URL/device/account city precedence'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/profile.test.ts: Profile edits serialize first saves, preserve identical retries and reject stale overwrite']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/profile-city-full-suite.txt','docs/architecture/adr-046-profile-city.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Profile city/name editing and conflict recovery implemented; verified contact changes, full theme initialization and browser/account-switch/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRO-04','FE:PRO-07','BE:CUS-05','BE:CUS-06']:
  row['apiUseCase'] += '; encrypted owner-only GET/PUT /api/v1/profile/attendees, explicit version-1 consent/history/withdrawal and manual checkout field reuse'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/profile.test.ts: Saved attendees require consent, encrypt private data, isolate accounts and withdraw without retaining details','tests/saved-attendees-ui.test.ts: explicit reuse excludes declarations']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/saved-attendees-full-suite.txt','docs/architecture/adr-047-saved-attendees.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Saved attendee shortcuts implemented; browser/checkout/accessibility, production consent policy, retention/export/deletion integration and key rotation remain open']))
for row in rows:
 if row['id'] in ['FE:TKT-08','FE:TKT-02','FE:TKT-04','FE:BKG-17']:
  row['apiUseCase'] += '; ticket wallet/download directions from scheduled occurrence venue snapshots and address-aware calendar LOCATION'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/tickets.test.ts: Ticket directions use scheduled venue addresses','tests/ticket-directions.test.ts: encoding and rendered fallback']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/ticket-directions-full-suite.txt','docs/architecture/adr-048-ticket-directions.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Ticket directions implemented; live maps, offline viewers, browser/print/accessibility and controlled venue relocation acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:ENG-04','BE:NTF-11']:
  row['apiUseCase'] += '; owner-wide unread counts, bounded atomic POST /api/v1/notifications/read and DELETE /api/v1/notifications/:id/read with customer read/unread controls'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/notifications.test.ts: Inbox bulk read is atomic, bounded and owner scoped while new arrivals remain unread']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/inbox-actions-full-suite.txt','docs/architecture/adr-049-inbox-actions.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Inbox read-state actions implemented; browser/accessibility/load acceptance, live badges, retention and external channels remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-03','FE:PRV-05','FE:PRV-06','BE:PRV-02','BE:PRV-05','BE:PRV-06']:
  row['apiUseCase'] += '; owner-only versioned organization name draft edits, latest review feedback and changes-requested resubmission with retry-safe submit'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-drafts.test.ts: correction/resubmission and owner-only rendered controls']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/provider-drafts-full-suite.txt','docs/architecture/adr-050-provider-corrections.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Name correction/resubmission implemented; full contact/business/documents/payout onboarding and browser/multi-organization/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-02','FE:PRV-03','FE:PRV-06','FE:PRV-12','BE:PRV-02','BE:PRV-03','BE:PRV-06']:
  row['apiUseCase'] += '; private owner onboarding GET/PUT and protected reviewer GET, bounded business/contact drafts, audited access, versioned saves and completeness gates on submit/approve'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-drafts.test.ts: Private onboarding supports incomplete drafts and gates submission with owner-only audited details']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/provider-onboarding-full-suite.txt','docs/architecture/adr-051-private-provider-onboarding.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Business/contact draft and review implemented; documents, payout verification, retention/security and browser/multi-form/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-05','FE:PRV-06','BE:PRV-05','BE:PRV-06']:
  row['apiUseCase'] += '; immutable provider decision history with atomic review persistence, business-version replay, owner/reviewer history pages and reviewer rejection control'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-drafts.test.ts: Provider review history is durable, paginated and private; retries never repeat a transition']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/provider-review-history-full-suite.txt','docs/architecture/adr-052-provider-review-history.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Durable review history implemented; full application snapshots, under-review workflow, approved retention and browser/reviewer/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:ADM-UI-05','FE:INT-09','BE:API-05']:
  row['apiUseCase'] += '; GET /admin/providers stable creation-time/UUID pagination and kind filters with URL-based admin navigation'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-drafts.test.ts: Provider queue pagination and navigation']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/provider-queue-full-suite.txt','docs/architecture/adr-053-provider-review-queue.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Provider queue pagination implemented; listing queue pagination, load testing and browser/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:ADM-UI-05','FE:INT-09','BE:API-05']:
  row['apiUseCase'] += '; GET /admin/listings paginated review queue with listing-type filters, dedicated /admin/listings UI and inline versioned review decisions'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/listing-review-queue.test.ts']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/listing-queue-full-suite.txt','docs/architecture/adr-054-listing-review-queue.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Listing queue pagination implemented; browser/navigation/accessibility, unsaved-reason protection and load acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:ADM-UI-05','FE:CAT-08','BE:CAT-07','BE:API-03']:
  row['apiUseCase'] += '; immutable listing decisions with reviewer attribution, atomic state/revision/result writes, same-reviewer business-version replay and original-payload retry control'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/listing-review-queue.test.ts: Listing review decisions are atomic, immutable and retry safe across later transitions']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/listing-review-retries-full-suite.txt','docs/architecture/adr-055-listing-review-retries.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Durable listing decision replay implemented; full history UI, retention approval and browser/retry/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:CAT-06','FE:ADM-UI-05','BE:CAT-07']:
  row['apiUseCase'] += '; audited member/moderator listing decision history APIs and paginated lookup pages, with member-safe reviewer identity projection'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/listing-review-queue.test.ts: Listing review history paginates and protects reasons, identities and snapshots']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/listing-review-history-full-suite.txt','docs/architecture/adr-056-listing-review-history.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Durable listing decision history implemented; pre-migration moderation records, draft revisions, approved retention and browser/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:CAT-06','FE:ADM-UI-05','BE:CAT-07']:
  row['apiUseCase'] += '; audited retained listing revisions with selected pre-change content, legacy reasons, bigint pagination and member/moderator history panels'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/listing-review-queue.test.ts: Listing revisions retain exact bigint cursors and protect legacy snapshots and identities']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/listing-revisions-full-suite.txt','docs/architecture/adr-057-listing-revisions.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Retained core-content revisions implemented; category metadata history, structured comparison/restore, approved retention and browser/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:CAT-06','FE:CAT-08','BE:CAT-07']:
  row['apiUseCase'] += '; protected same-listing revision comparison with stable domain field differences, audited reads and cross-page From/To selections'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/listing-review-queue.test.ts: revision comparison authorization and null/empty/escaped rendering']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/revision-comparison-full-suite.txt','docs/architecture/adr-058-revision-comparison.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Core revision comparison implemented; category metadata comparison, restore policy and browser/paging/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:CAT-06','FE:CAT-08','BE:CAT-07']:
  row['apiUseCase'] += '; per-kind allowlisted category metadata in saved revision history/comparison with labeled frontend values and malformed/private-field omission'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/listing-review-queue.test.ts: Category revision history and comparisons expose only saved fields for their listing kind']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/category-revision-history-full-suite.txt','docs/architecture/adr-059-category-revision-history.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Supported saved category metadata history implemented; fields not retained in listing snapshots, restore policy, retention and browser/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:CAT-06','FE:CAT-08','BE:CAT-07']:
  row['apiUseCase'] += '; future category content retention through public Catalog contracts, including crew/event inclusion details/sports season and hospitality, with pre-upgrade idempotency compatibility'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/cinema-sports.test.ts: retained category fields, original command fingerprints, history comparisons and full booking workflows','tests/listing-review-queue.test.ts: Expanded category history labels']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/category-history-capture-full-suite.txt','docs/architecture/adr-060-category-history-capture.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Additional future category content retention implemented; missing historical values, media history, retention/restore policy and browser/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:CAT-05','FE:CAT-08','BE:CAT-04','BE:CAT-07','BE:API-03']:
  row['apiUseCase'] += '; durable listing submission business-version replay, original-actor/current-membership protection and frontend original-submission recovery'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/listing-review-queue.test.ts: Listing submission retries preserve one transition and never resurrect later review states']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/listing-submit-retries-full-suite.txt','docs/architecture/adr-061-listing-submission-retries.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Listing submission replay implemented; legacy submissions, generic draft-save replay, retention and browser/retry/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:CAT-01','FE:CAT-08','BE:CAT-07','BE:API-03']:
  row['apiUseCase'] += '; durable normalized generic draft edits with original-actor business-version replay and original-payload frontend recovery retaining current form edits'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/listing-review-queue.test.ts: Generic draft edit replay is payload scoped and cannot overwrite later edits or publication','tests/venues.test.ts: Draft edits preserve revisions, reject stale versions and stay private until moderation']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/draft-edit-retries-full-suite.txt','docs/architecture/adr-062-generic-draft-retries.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Generic draft edit replay implemented; legacy edits, generic creation retries, retention and browser/form/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:CAT-01','FE:CAT-08','BE:API-08','BE:API-09','BE:API-12']:
  row['apiUseCase'] += '; required actor/organization-scoped generic creation keys, atomic immutable result mappings, normalized payload replay and frontend original-creation recovery'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/listing-review-queue.test.ts: Generic creation keys prevent duplicates and are isolated by actor and organization']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/catalog-create-retries-full-suite.txt','docs/architecture/adr-063-generic-creation-retries.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Keyed generic creation implemented; old unkeyed commands, browser-close persistence, retention and browser/recovery/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-01','FE:PRV-03','BE:PRV-01','BE:PRV-02','BE:API-08','BE:API-09','BE:API-12']:
  row['apiUseCase'] += '; actor-scoped organization creation keys with atomic organization/owner/result persistence, active-account/current-owner replay and frontend original-request recovery'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-drafts.test.ts: Organization creation retries are atomic, actor scoped and require active current ownership']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/provider-create-retries-full-suite.txt','docs/architecture/adr-064-provider-creation-retries.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Organization creation recovery implemented; old unkeyed commands, reload persistence, retention and browser/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-03','FE:PRV-06','BE:PRV-02','BE:API-03','BE:API-12']:
  row['apiUseCase'] += '; immutable provider submission business-version results with original-actor/current-owner replay and frontend original-submission recovery'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-drafts.test.ts: Provider submission recovery preserves later review state and original actor with atomic persistence']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/provider-submission-retries-full-suite.txt','docs/architecture/adr-065-provider-submission-retries.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Provider submission recovery implemented; legacy submission reconstruction, reload persistence, retention and browser/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-03','FE:PRV-06','BE:PRV-02','BE:API-03','BE:API-12']:
  row['apiUseCase'] += '; durable normalized organization-name edit results with original-actor/current-owner replay and frontend recovery preserving unsaved text'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-drafts.test.ts: Provider draft edits recover original results without overwriting later changes']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/provider-draft-retries-full-suite.txt','docs/architecture/adr-066-provider-draft-retries.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Organization name edit recovery implemented; private onboarding save recovery, legacy edits, retention and browser/form/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-02','FE:PRV-03','FE:PRV-06','BE:PRV-02','BE:PRV-03','BE:API-03','BE:API-12']:
  row['apiUseCase'] += '; durable private onboarding save fingerprints with atomic details/version/audit writes, audited original-actor/current-owner replay and frontend recovery preserving different entries'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-drafts.test.ts: Private onboarding save recovery is atomic, audited and preserves later details']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/onboarding-save-retries-full-suite.txt','docs/architecture/adr-067-onboarding-save-retries.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Private onboarding save recovery implemented; legacy reconstruction, reload persistence, retention and browser/session/form/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-09','FE:INT-09','BE:PRV-08','BE:API-05']:
  row['apiUseCase'] += '; owner invitation history with exact timestamp/UUID cursor pagination, current MFA/ownership checks and First/Previous/Next frontend controls'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-staff.test.ts: Owner invitation history pages preserve exact boundaries and current authorization']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/invitation-pages-full-suite.txt','docs/architecture/adr-068-provider-invitation-pages.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Owner invitation pagination implemented; recipient inbox/member pagination, resend delivery, load and browser/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-09','FE:INT-09','BE:PRV-08','BE:API-05']:
  row['apiUseCase'] += '; authenticated-contact recipient invitation pages with exact cursors, pending/unexpired filtering and frontend First/Previous/Next navigation'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-staff.test.ts: Recipient invitation pages reach older invitations without exposing other contacts or unavailable records']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/recipient-pages-full-suite.txt','docs/architecture/adr-069-recipient-invitation-pages.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Recipient invitation pagination implemented; member pagination, resend delivery, load and browser/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-09','BE:API-02','BE:API-06']:
  row['apiUseCase'] += '; exact bigint membership versions across frontend, transport and application/persistence with bounded string validation and safe-number compatibility'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-staff.test.ts: Staff membership commands preserve bigint versions and reject unsafe numeric inputs']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/membership-versions-full-suite.txt','docs/architecture/adr-070-exact-membership-versions.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Exact membership versions implemented; member pagination, resend delivery and browser staff-management acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-09','FE:INT-09','BE:API-05']:
  row['apiUseCase'] += '; independent staff member UUID cursor pagination with bounded lists, current owner/MFA checks and separate frontend member/invitation navigation'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-staff.test.ts: Member pages preserve independent invitation cursors and authorized role actions']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/member-pages-full-suite.txt','docs/architecture/adr-071-member-pages.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Member pagination implemented; invitation delivery/resend, load and browser/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-09','BE:PRV-08','BE:API-03','BE:API-12']:
  row['apiUseCase'] += '; immutable invitation revocation actor/version replay with atomic state/result/audit persistence and frontend original-request recovery'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-staff.test.ts: Invitation revocation recovery is atomic, actor scoped and cannot revoke a replacement']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/invitation-revocation-full-suite.txt','docs/architecture/adr-072-invitation-revocation-retries.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Invitation revocation recovery implemented; legacy reconstruction, membership action replay, retention and browser/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-09','BE:API-03','BE:API-12']:
  row['apiUseCase'] += '; immutable staff membership command replay with atomic role/deletion/audit persistence, current owner/MFA protection and original-action frontend recovery'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-staff.test.ts: Membership action recovery is atomic and preserves later roles and replacement membership']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/membership-recovery-full-suite.txt','docs/architecture/adr-073-membership-action-recovery.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Membership action recovery implemented; legacy reconstruction, retention, reload persistence and browser/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-09','FE:INT-09','BE:API-05']:
  row['apiUseCase'] += '; owner invitation effective-status filters before pagination with authoritative expiry classification and frontend status selection preserving member position'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-staff.test.ts: Owner invitation filters paginate effective status without filtering members or leaking recipients']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/invitation-filters-full-suite.txt','docs/architecture/adr-074-invitation-status-filters.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Invitation status filtering implemented; delivery/resend, load and browser/filter/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRV-09','FE:INT-09','BE:API-05']:
  row['apiUseCase'] += '; owner member-role filters applied before pagination with independent invitation filtering and frontend member-role selection'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/provider-staff.test.ts: Member role filters paginate independently and reflect authorized role changes']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/member-filters-full-suite.txt','docs/architecture/adr-075-member-role-filters.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Member role filtering implemented; delivery/resend, load and browser/filter/accessibility acceptance remain open']))
for row in rows:
 if row['id'] in ['FE:PRO-03','FE:PRO-08','BE:CUS-06','BE:CUS-07']:
  row['apiUseCase'] += '; owner-scoped paginated marketing consent history with purpose/policy/time/withdrawal projection, immutable records and explicit-load customer history panel'
  row['acceptanceTests'] = list(dict.fromkeys(row['acceptanceTests'] + ['tests/communication-preferences.test.ts: Customer consent history paginates real changes and excludes other accounts']))
  row['evidence'] = list(dict.fromkeys(row['evidence'] + ['docs/evidence/consent-history-full-suite.txt','docs/architecture/adr-076-marketing-consent-history.md']))
  row['dependencies'] = list(dict.fromkeys(row['dependencies'] + ['Customer consent history implemented; historical policy text, approved retention/deletion, external delivery and browser/session/accessibility acceptance remain open']))
Path('docs/requirements/traceability.json').write_text(json.dumps(rows,indent=2)+'\n')
Path('docs/requirements/traceability.md').write_text(f'''# Traceability register

[Machine-readable register](traceability.json): {sum(r['id'].startswith('FE:') for r in rows)} FE IDs, {sum(r['id'].startswith('BE:') for r in rows)} BE IDs, {sum(r['id'].startswith('BASE:') for r in rows)} BASE bullet clauses. BASE IDs use source section + bullet index because the prompt has no individual IDs. Source files are unchanged.

Statuses distinguish implementation from verification. `partial` is never accepted/completed. Evidence references apply only to named test subsets. Untested API adapters and browser behavior are not inferred to pass from adjacent tests. Role/journey mappings and compound decomposition remain pending where marked.

Unnumbered normative paragraphs, tables and compound clauses still need complete decomposition and mapping; the source documents remain mandatory. Missing earlier BE/BR originals are recorded in the architecture assessment. No full attachment/requirement coverage is claimed.
''')
print(len(rows),'registered clauses')
