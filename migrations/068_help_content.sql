CREATE TABLE catalog.help_articles (
 id text PRIMARY KEY, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 topic text NOT NULL CHECK(topic IN ('booking','payment','account','accessibility')),
 question text NOT NULL CHECK(char_length(question) BETWEEN 1 AND 200),
 answer text NOT NULL CHECK(char_length(answer) BETWEEN 1 AND 4000),
 href text NOT NULL, action text NOT NULL, published boolean NOT NULL DEFAULT true
);
CREATE TABLE catalog.help_saves (
 article_id text NOT NULL REFERENCES catalog.help_articles(id), input_version integer NOT NULL,
 actor_id uuid NOT NULL REFERENCES identity.accounts(id), fingerprint text NOT NULL,
 version integer NOT NULL, snapshot jsonb NOT NULL, reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(article_id,input_version)
);
CREATE FUNCTION catalog.immutable_help_save() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Help save history is immutable'; END $$;
CREATE TRIGGER immutable_help_save BEFORE UPDATE OR DELETE ON catalog.help_saves FOR EACH ROW EXECUTE FUNCTION catalog.immutable_help_save();
INSERT INTO catalog.help_articles(id,topic,question,answer,href,action) VALUES('reservation-expiry','booking','Does refreshing extend my seat reservation?','Seats are held only after the server confirms a reservation. The countdown uses server time. Refreshing does not extend the hold. If it expires, check availability and select seats again; availability is not guaranteed.','/explore','Browse available listings');
INSERT INTO catalog.help_articles(id,topic,question,answer,href,action) VALUES('find-booking','booking','Where can I find my booking and ticket?','Sign in to the account used for the booking and open My bookings. Search by booking reference or title, or filter by status and dates. Open the booking for its current status and available ticket actions.','/bookings','Open My bookings');
INSERT INTO catalog.help_articles(id,topic,question,answer,href,action) VALUES('cancel-booking','booking','Can I cancel a booking?','Open the booking to check its available actions and accepted policy. Cancellation depends on eligibility and cutoff times. Review any cancellation preview before confirming. A cancelled booking and a completed refund are separate states; contact support if recovery is required.','/bookings','Check booking actions');
INSERT INTO catalog.help_articles(id,topic,question,answer,href,action) VALUES('payment-pending','payment','My payment is pending. Should I pay again?','A payment callback is not a booking confirmation. Open your booking and retrieve its payment status before making another payment. Follow the actions shown for that booking. If payment or refund recovery is required, contact support with your booking reference. Do not share card details, OTPs or payment secrets.','/bookings','Check booking and payment status');
INSERT INTO catalog.help_articles(id,topic,question,answer,href,action) VALUES('communication-preferences','account','How do I change communication preferences?','Sign in and open your account to manage your preferred language and optional marketing email consent. Transactional booking, payment and account security messages remain required. The interface currently uses English. Saving marketing consent does not subscribe you to an external campaign service.','/profile','Open account preferences');
INSERT INTO catalog.help_articles(id,topic,question,answer,href,action) VALUES('accessible-booking','accessibility','Can I use a keyboard or change the theme?','Use keyboard navigation and the seat list to select places. Light and Dark themes are available from the header. Contact support if you encounter an accessibility barrier; do not include OTPs or payment secrets in your message.','/cases','Contact support');
