# Train management

Open `/admin/trains`. An access administrator must assign trains.read for viewing and trains.manage for changes; fresh MFA is required. Existing roles/accounts gain no privileges automatically.

1. Create stations using stable catalogue codes, uppercase station references, names and cities. Station references are unique and cannot be edited after creation. Create a distinct record for a distinct identity; do not repurpose historical codes.
2. Create routes with ordered station calls. Select active stations through searchable pickers; refine searches beyond the first 25 matches. Offsets are elapsed minutes from origin departure and may span days. The first call starts at zero; each later arrival follows the previous departure. Set boarding/alighting flags appropriately. Saved route snapshots preserve station names/codes.
3. Create a service with train number, selected active route, travel classes and dated ISO timestamps with timezone, e.g. `2027-01-01T09:00:00+05:30`. Final arrival must match the route's final arrival offset. Class codes/names are local references, not asserted provider availability. Provider-reference metadata and operational notes must not contain credentials.
4. Inspect the station-call table and IST timestamps. Availability/fare/PNR/confirmation/waitlist/cancellation/refund fields are unavailable until an authorized provider is integrated. No booking or payment is created.
5. Save edits with a reason/confirmation/current version. Reload after conflicts. Service saves refresh route/station snapshots from active references; later catalogue edits alone do not rewrite a saved schedule.
6. Record, resolve or withdraw a local service incident with a reason. Withdrawn services remain historical and cannot be edited/reopened. Incident actions do not send provider cancellations, refunds or notifications. Immutable before/after history is available to authorized readers.

Search stations by name/catalogue code/station code. Service filters include train number, route UUID and inclusive-from/exclusive-until departure timestamps. First/next page navigation preserves filters. Request fingerprints reject changed payloads under reused creation keys, while unique catalogue/station codes also prevent accidental duplicates after refresh.

Migration 080 adds Trains-owned catalogue/history/replay records and assignable permissions. Existing booking/inventory workflows are unchanged. Full FR-09 remains blocked on the authorized railway provider's official documentation and securely configured sandbox access. Supply the provider name/documentation/configuration location to continue; never paste API secrets into chat or metadata fields.

Verification: `tests/train-administration.test.ts` and `docs/evidence/train-management-*`. Browser acceptance and live-provider booking/refund reconciliation are not claimed.
