# Venue contact details

Open /partner/venues, select the organization, then Edit venue contact details. Enter a phone with international country code and/or an email. Save with the authorization checkbox unchecked to keep these details private. Check it only for contacts you are authorized to display publicly. The public venue must also pass existing approval/publication gates.

Uncheck and save to withdraw public display. Clear both fields and keep the box unchecked to remove stored values. Old pages may still contain previously received contacts; withdrawal applies to subsequent API reads. No contact is copied from account records and no message, verification email or phone call is sent.

On VERSION_CONFLICT (409), copy any draft, reload and compare the latest values before saving again. Do not fabricate a higher version. Failed requests keep the form text; successful requests refresh the workspace. No durable draft storage is provided. Contact details are venue-supplied and have not been independently verified.

Migration 043 initializes existing venues privately with empty values. venue.contact_updated audit metadata includes organization, version and display permission, without phone/email content. Contact write and audit are atomic. Native and Docker evidence: docs/evidence/venue-contact-{tests,full-suite,container-tests,build,deploy,smoke}.txt. Browser/accessibility acceptance remains open.
