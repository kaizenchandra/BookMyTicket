# ADR 084: Searchable public help

FE:SUP-C-01 requires searchable FAQs and contextual booking help. Catalog owns published help content under BE:CAT-10. This increment implements public retrieval and search; administrative editing, moderation and content lifecycle are still open.

Catalog exposes a Help application use case through a HelpContent port. Its adapter contains six published version-one articles released with the application. Answers describe implemented booking, payment, preference and accessibility behavior and link to existing routes. Publication changes require code review and release. The domain search combines an optional topic with all whitespace-separated search terms, matching case-insensitive literal substrings of questions/answers. It does not query customer, booking or payment records.

GET /api/v1/help is public and read-only. Its strict query permits a search string of at most 100 characters and a supported topic; malformed, repeated or unknown parameters return 422. Empty search returns all articles in publication order. The finite six-article collection needs no pagination. Article IDs and content versions are stable public fields. Search is not a reservation or payment authority.

/help replaces static guidance with an accessible labeled GET search form, topic selector, result count, empty/error/retry states and contextual action links. URL parameters preserve searches through navigation. Booking history and payment details link to their corresponding topics without including private booking identifiers. Support contact and the existing no-configured-estimate notice remain visible.

Unit, HTTP and server-rendered component tests cover matching, combined filters, validation, public behavior independent of cookies, schema conformance, known internal links and escaped text. Browser navigation, keyboard/accessibility, editorial tooling, localization and load acceptance remain open. No database migration or external provider is needed.
