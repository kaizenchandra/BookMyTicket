# Support for a booking

Open booking details and choose Support for this booking. The support page lists only your cases linked to that reference and prefills the optional booking field for a new case. Enter the subject/category/message and submit normally. The backend validates that the linked booking belongs to your account.

Opening a conversation and returning to its list preserves the booking filter, as do Newest cases and Older cases. Clear booking filter removes that reference while retaining any [status/category filters](customer-case-filters.md). A prefilled reference is context, not proof of access. Unknown/foreign references yield no matching owned cases and cannot be linked through case creation.

The list filter and editable new-case reference are separate: if you change the new-case reference, the existing list stays filtered by its displayed booking. After a successful submission, the original contextual reference remains prefilled. Normal unsent-draft warnings apply to text/reference edits; untouched prefilled context alone does not trigger them.

GET /api/v1/cases accepts bookingId as a UUID, normalized to lowercase. Combine it with caseId for one matching case or after for an older filtered page. Preserve bookingId with the cursor. Changing account/booking rejects the cursor; restart from newest cases. Requests without bookingId remain backward compatible.

No migration is required. Evidence prefix: docs/evidence/case-booking-filter-. Browser/sign-in/navigation/accessibility/load and attachment acceptance remain open.
