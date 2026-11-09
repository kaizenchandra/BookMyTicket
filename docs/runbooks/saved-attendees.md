# Saved attendee shortcuts

In /profile, use Saved attendees to add up to ten names with optional email/international phone. Confirm the explicit storage-consent checkbox and save. Editing resets the checkbox. Remove individual entries then save; remove all or choose Withdraw consent and delete all saved details to clear the encrypted collection. Previously accepted booking records remain unchanged.

Checkout registration offers Load saved attendees. Choose a saved name/email/phone for each intended field and review the resulting values. Nothing is filled automatically; declarations, choices and dates require manual entry. The feature does not verify contacts, send messages, subscribe to marketing or grant admission. Provider form previews do not show shortcuts.

GET /api/v1/profile/attendees returns owner data and version. PUT requires expectedVersion, consentVersion=1, explicit consent and the whole list. On 409, copy useful draft changes and explicitly discard/reload before retrying. Identical immediate retries do not duplicate consent history. Do not fabricate versions.

Migration 046 adds two Profiles tables. REGISTRATION_ENCRYPTION_KEY (or existing secret-file configuration) must remain stable; a distinct derived key protects saved shortcuts. Back up this key securely with the existing secret process. Do not replace it casually: old encrypted lists will be unreadable. A missing key fails closed; withdrawal with a known current version can still erase the encrypted list. No rotation tool is implemented. Consent history retains purpose/version/timestamp/grant state, without attendee details; approved retention policy remains outstanding.

Evidence: docs/evidence/saved-attendees-{tests,full-suite,container-tests,build,deploy,smoke}.txt. Automated tests use isolated synthetic data and verify swapped-ciphertext failure, key-unavailable behavior and withdrawal. Browser checkout/consent UX/accessibility, production consent-policy approval and privacy export/deletion integration remain open.
