# Customer support escalation

Sign in and open /cases. For an open or in-progress unresolved case, expand Request escalation, explain why further review is needed, and submit. Never include OTPs, card data or payment secrets. The reason becomes part of the customer-visible conversation.

The case moves to the unassigned escalated support queue. Staff can find it in /operations with state=escalated and assignment=unassigned. No response estimate is promised. Resolved cases must first be reopened with a customer reply; already escalated cases show their status.

If another action changes the case, refresh its status before submitting again. An identical retry with the same command key returns the original result without overriding a later staff assignment. A changed request requires a new key and current version. Only the case owner can request escalation.

Migration 032 is additive. Retain command records when rolling back; do not delete them to retry an uncertain operation. Evidence is under docs/evidence/customer-escalation-*. Browser acceptance and external delivery are not verified.
