# Booking design reference audit — 2026-11-07

Reference city: Bengaluru. Requested browser page: https://in.bookmyshow.com/explore/home/bengaluru. The in-app browser failed with “The browser access host is unavailable”. No viewport screenshot, pixel measurement, interactive seat selection or checkout inspection was possible. Exact visual fidelity is **not verified**.

Public web text successfully read:
- https://in.bookmyshow.com/explore/home/bengaluru — search/location/account composition, category navigation and recommendation hierarchy.
- https://in.bookmyshow.com/movies/bengaluru/ramayana/ET00451914 — poster, title, format/language, duration/genre/certification, booking action, about/cast/crew hierarchy.

No reference posters, customer reviews, ratings, commercial claims or listings were copied into the product. Existing original demo media and live database records remain the only displayed content. No claim of official BookMyShow affiliation.

Implemented adaptation:
- Compact primary/search and secondary navigation; responsive wrapping.
- Poster-led dark hero, metadata chips, prominent Book tickets anchor, separate about/details section.
- Horizontally scrolling date tiles, venue filter and grouped outlined showtime buttons with actual prices/status.
- Interactive spatial seat selection from persisted x/y coordinates; available/selected/unavailable semantic colors, disabled unavailable controls, accessible list alternative. General-admission quantity steppers remain tied to real inventory.
- Explicit progress stages; persistent selection/price action bar; reservation countdown; highlighted final price and selected-session summary.
- Exactly Light and Dark themes with shared semantic tokens; no new theme option. Existing reduced-motion rule retained.

Inferred, not directly observed: detail pixel sizing, date/showtime styling, seat-map composition, checkout arrangement, mobile breakpoints and all dark-mode adaptations. Authored responsive rules target 360/390/768/1024/1440, but none of those widths has been browser-verified in this environment. Seat maps intentionally scroll horizontally; surrounding controls reflow. Buttons maintain 44px interaction targets. Automated server rendering checks semantics only, not browser accessibility or visual appearance.

Required remaining acceptance: actual browser screenshots at the five widths in both themes, reference comparison/measurements, keyboard/screen-reader interaction, zoom/reflow, seat-map scrolling, theme switching during checkout and hosted Razorpay appearance. Do not describe this work as an exact BookMyShow reproduction until that evidence exists.
