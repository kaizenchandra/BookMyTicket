# Favorites recovery

Open /favorites while signed in. A failed fetch shows an error and Retry favorites; it does not display an empty-state message or a stale Next page link. Refresh reloads the current page. Unpublished saved listings remain removable without revealing private listing content.

Save to Favorites before sign-in applies only to the listing/venue selected when sign-in began. If the resource changes, the pending intent is discarded. Delayed responses from an earlier account or resource are ignored; a server operation already accepted can still complete for its original authenticated account. Refresh that account's favorites to inspect its current state.

GET /api/v1/favorites accepts only an optional UUID after cursor and returns at most twenty-four items plus nextCursor. GET/PUT/DELETE /api/v1/favorites/:id return {saved:boolean}. PUT uses an empty JSON body. Owner checks, publication checks and retry-safe setters remain in force. Generated OpenAPI documents these contracts.

Evidence uses docs/evidence/favorites-recovery-*.txt. No migration is required. Browser sign-in/switch/navigation, accessibility and load acceptance remain pending.
