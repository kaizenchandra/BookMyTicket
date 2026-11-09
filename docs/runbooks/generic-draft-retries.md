# Generic draft edit recovery

After an existing generic draft save fails or its response is lost, Retry original draft save resends the captured listing ID and JSON body. Later form edits do not alter the retry. Your current form remains visible after successful recovery; check the refreshed listing status before saving further changes. Dismiss draft retry removes the recovery attempt without changing server data.

The original actor with current writable membership can replay the same normalized input version. Changed content, another actor or newer noneditable state on a new command produces a conflict. Original successful results can be historical: replay never overwrites later changes or publication. Read-only or revoked members cannot recover through this API.

PUT /api/v1/listings/:id accepts the usual listing fields and expected version (1–2147483646). Metadata object key order does not affect equality. Migration 055 persists input/result atomically with the pre-change revision and edit. Do not modify/delete command records to resolve a conflict.

Pre-migration edits are not reconstructed. This feature covers existing generic listing edits; category editor command keys remain separate, and generic listing creation retries are still open. Recovery attempts are in memory and do not survive browser closure.

Evidence prefix: docs/evidence/draft-edit-retries-. Browser/form-preservation/accessibility and retention acceptance remain open.
