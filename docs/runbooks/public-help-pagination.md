# Public Help result pages

Search /help as before. Each page contains at most twenty matching answers, ordered by article ID. Next answers preserves the applied search/topic. First page returns to the start without clearing filters. A new search starts from the first page. Bookmarking a result URL preserves its cursor and filters.

Answers may be published or withdrawn while browsing. Refresh from the first page to see newer matches; withdrawn answers are omitted from subsequent requests. A page count is not a total-result count. Empty pages suggest returning to the first page or changing search terms.

GET /api/v1/help accepts q, topic and optional after (an article slug). Follow nextCursor with the same q/topic until null; clients must no longer assume one response contains every answer. All terms must occur in the combined question/answer, case-insensitively for supported English content. Percent and underscore are literal characters. Search/publication/topic/cursor checks apply before the result limit.

No migration is required. Evidence prefix: docs/evidence/public-help-pages-. Browser/accessibility, indexing, multilingual search and load acceptance remain pending.
