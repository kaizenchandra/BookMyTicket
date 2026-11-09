# Supervisor assignment inbox notices

After a supervisor assigns a case, the recipient receives an in-app notice at /notifications. Choose View assigned case to open its current detail in /operations. Current support permission and recent MFA are required. This is not external email/SMS delivery.

The notice records an assignment that occurred; it may arrive after reassignment, resolution or access changes. Always inspect current case ownership/status before acting. Delivery never reclaims a case or grants access. The notice contains no case subject, assignment reason or conversation text and can remain in an active recipient's personal inbox after their support role is removed.

Existing assignments are not backfilled. Self-claim workflow actions do not generate this supervisor-assignment event. Retrying the same assignment key does not send another notice. Use existing notification delivery recovery for exhausted work; do not reassign merely to produce another notice. Audited replay is deduplicated and does not affect case state.

Deploy app and worker together using existing commands; no migration, credentials or staff grants are added. tests/support-assignment.test.ts verifies the behavior with isolated PostgreSQL/HTTP and durable consumers. Browser/keyboard/accessibility acceptance remains outstanding.
