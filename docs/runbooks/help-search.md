# Help search

Open /help, enter words and optionally select a topic. All words must appear somewhere in the question or answer; matching ignores case. Search URLs can be bookmarked. Clear filters returns the first page of published answers. Use [result pagination](public-help-pagination.md) to browse more. No results suggests fewer words or another topic. Retry help repeats a failed fetch without erasing the URL search.

Booking history links to /help?topic=booking; payment details link to /help?topic=payment. Answers direct customers to current booking actions or account preferences. Support remains available from Help, with no invented response estimate. Never enter OTPs, card details or payment secrets in searches or support messages. Searches are URL query parameters and may appear in browser history or request logs.

GET /api/v1/help accepts optional q (maximum 100 characters), topic (booking, payment, account, accessibility) and after (article slug). It returns at most twenty answers and nextCursor. It returns items containing id, version, topic, question, answer, href and action. It is public and does not return user-specific data. Invalid queries return 422.

Runtime content is maintained in PostgreSQL through /admin/help by authorized moderation staff. See [Help administration](help-administration.md). The TypeScript content adapter is only a bootstrap/test fixture. Public FAQ search shipped in 0.81.0; migration 068 adds editable content in 0.82.0. Browser/accessibility/localization/load acceptance remains pending.
