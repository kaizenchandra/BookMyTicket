# Customer support reply notifications

When an authorized agent sends a customer-visible reply, a durable in-app notification is queued for the case owner. Internal notes do not create customer notices. Open /notifications, choose View support case, and read the current conversation. The link is account-scoped and works for cases older than the newest-100 case list.

A notice records that a reply occurred; a later resolution or reassignment may already have changed the case. No external email or SMS delivery is implied. Historical replies are not backfilled. Only new successful customer-visible staff replies publish support.staff_replied.

If a notice is delayed, check the worker health and existing notification delivery recovery interface in /operations. Use the authorized audited replay flow for exhausted deliveries; do not resubmit a reply just to trigger a notice. Replayed delivery is deduplicated by event ID and never changes case state. Reply operation keys also prevent duplicating the underlying message/event.

No new migration or environment variable is required. Use existing native/container suites and smoke commands; tests/support-operations.test.ts covers concurrent reply retries, internal-note privacy, delayed delivery after resolution, notification deduplication, owner isolation, read-state access and exact older-case selection. Browser acceptance is still unverified.
