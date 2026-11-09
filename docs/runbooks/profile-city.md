# Profile editing and preferred city

Open /profile to edit your name and optional preferred city. Clear the city and save to remove it. Browse city now opens discovery using that saved city explicitly. City selection precedence: URL, device selection, account preference, then all cities. The account fallback is never copied into device storage.

The API now requires expectedVersion on PUT /api/v1/profile. Obtain it with GET /api/v1/profile; do not infer or increment it on the client. Successful saves return the current version. An identical immediately repeated request returns the original saved state without another increment. A changed or older request receives VERSION_CONFLICT (409).

On conflict, the editor preserves entered values and disables saving until reloaded. Copy any draft you want to retain, then choose Discard draft and load latest profile, review the current data and reapply the desired edits. A background theme change may cause this conflict; it protects the newer theme. Transport errors retain the form for retry.

No migration is needed. Existing preferences retain their versions; accounts without a row start at version 0. Old API clients without expectedVersion now receive 422 and must refresh/update. No contact-verification status changes are made by this workflow.

Evidence: docs/evidence/profile-city-{tests,full-suite,container-tests,build,deploy,smoke}.txt. Tests cover races/retries/isolation/validation/suspension. Browser preference precedence, multiple-tab interaction, accessibility and visual acceptance remain unverified.
