# Deployment and recovery — local verified; production proposed

Release gate: close outstanding implementation and acceptance gaps in progress.md. Current containers must not be presented as a production release. No cloud spending was initiated.

Local Compose deployment is verified: digest-pinned images, migration gating, schema-aware readiness, worker heartbeat, 40 container tests and 12 HTTP checks. Restart persistence and isolated fixture backup restoration passed; see development.md and docs/evidence/compose-recovery.json. Hosted CI remains unexecuted, and action revisions require production hardening. Local backup restoration does not establish production RPO/RTO or complete disaster recovery.

For staging: provision isolated PostgreSQL, immutable app/worker image, managed secrets, TLS ingress and webhook endpoint. Separate merchant mode, database and encryption keys per environment. No test-mode exception currently exists. Run migration job once under its advisory lock; start app; verify /health and /ready plus schema compatibility; start worker; check queue age and signature failure alerts.

Production rollout: approve policies and merchant capabilities; back up database; apply forward-compatible migrations; canary; execute authorized smoke checks; expand only after passing. Proposed targets are availability 99.9%, read p95 300ms, reserve p95 750ms, RPO 5min and RTO 60min, all unverified.

Recovery: stop new sales when inventory/payment invariants are uncertain. Preserve webhook inbox/capture evidence. Reconcile provider state before resubmitting any unknown financial operation. Roll application back only while schema compatible; never automatically drop financial tables. Restore backup into an isolated database, verify seat ownership/capacity, capture mappings, ledger balance and ticket entitlements before switching traffic. Replaying events must preserve deduplication and cancelled-order protections.

Cost/sustainability proposals: small app+worker footprint, bounded polling/backoff, PostgreSQL indexes, no separate search/queue cluster initially. Set budgets and lifecycle policies only after authorized infrastructure choices and legal retention policies. Production backup/restore, application rollback, cost and SLO measurements remain pending.
