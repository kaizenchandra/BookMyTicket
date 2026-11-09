CREATE INDEX listing_review_queue_order ON catalog.listings(created_at,id) WHERE state='submitted';
CREATE INDEX listing_review_queue_kind_order ON catalog.listings(kind,created_at,id) WHERE state='submitted';
