# Category details in saved revisions

Open a listing-history page and load saved revisions. Saved category details now shows the allowlisted metadata retained at that revision. Choose From/To revisions to compare changes with readable labels.

Movies: language, genre, format, certification, duration, cast/performers, release date and crew. Events: language, genre, duration, performers, minimum age, organizer, inclusions, exclusions and entry instructions. Sports: sport, competition, teams, entry instructions, season, individual home/away teams and hospitality.

Not recorded means absent or invalid historical text; Empty text means an explicitly stored empty string. Data comes from the saved listing kind and snapshot, not current movie/event/sports records. Additional fields are retained on future explicit saves from v0.57.0; missing earlier values cannot be reconstructed. See [capture behavior](category-history-capture.md). Unknown kinds have no category detail projection.

Member/moderator endpoints and authorization remain the same. The safe snapshot adds categoryDetails; comparison fields use categoryDetails.FIELD. Unknown metadata, internal markers, URLs and fields for other kinds are omitted. No migration or backfill is needed. Evidence prefix: docs/evidence/category-revision-history-. Browser/accessibility and complete category history acceptance remain open.
