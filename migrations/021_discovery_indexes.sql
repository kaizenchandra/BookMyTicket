CREATE INDEX catalog_city_recent ON catalog.listings(lower(btrim(city)),kind,created_at DESC,id DESC) WHERE state='published';
CREATE INDEX catalog_title_order ON catalog.listings(lower(title),id) WHERE state='published';
