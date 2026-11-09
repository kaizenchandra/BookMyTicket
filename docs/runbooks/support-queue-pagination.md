# Support queue navigation

At /operations, use existing state, priority, category and assignment filters, then Next page to inspect older cases. Previous page revisits the preceding boundary; First page or Refresh returns to current newest cases. Each page contains at most 100 records. Filter membership is live and may change as agents work.

API callers retain the items array and should follow nextCursor through the after query parameter until null. Reuse cursors only with the same authenticated account and filters. On INVALID_CURSOR, clear after and restart. Authentication, support permission and fresh MFA apply to every page. Cursors grant no authority.

Apply migration 036 through normal migration-gated startup. No application fixtures or new staff permissions are required. Verify using tests/support-operations.test.ts and the existing full native/container test commands. Interactive browser verification remains pending.
