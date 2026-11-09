import { SaveListing } from "./favorites.tsx";
import { VenueImageView } from "./venue-media.tsx";
import type { VenueImage } from "../../src/modules/venues/domain/media.ts";
import { useEffect, useState } from "react";
import { api } from "../api.ts";
export function VenuePage({
  id,
  accountId,
  signIn,
}: {
  id: string;
  accountId?: string;
  signIn: () => void;
}) {
  const after = new URLSearchParams(window.location.search).get("after");
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    setLoading(true);
    api(
      `/venues/${encodeURIComponent(id)}${after ? `?after=${encodeURIComponent(after)}` : ""}`,
    )
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, after, revision]);
  if (loading) return <p role="status">Loading venue…</p>;
  if (error)
    return (
      <section className="reading">
        <h1>Venue unavailable</h1>
        <p role="alert">{error}</p>
        <button onClick={() => setRevision((r) => r + 1)}>Retry</button>
        <p>
          <a href={`/venue/${id}`}>First venue page</a>
        </p>
        <a href="/explore">Browse listings</a>
      </section>
    );
  const venue = data.venue;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${venue.name}, ${venue.address}, ${venue.city}`)}`;
  return (
    <section className="reading">
      <p className="eyebrow">VENUE</p>
      <h1>{venue.name}</h1>
      <SaveListing
        key={id}
        id={id}
        accountId={accountId}
        signIn={signIn}
        collection="venue-favorites"
      />
      <p>
        <a href="/favorites/venues">Saved venues</a>
      </p>
      <p>
        {venue.city} · {venue.timeZone}
      </p>
      <h2>Address and directions</h2>
      <address style={{ whiteSpace: "pre-wrap" }}>{venue.address}</address>
      {directions.length <= 2048 && (
        <p>
          <a href={directions} target="_blank" rel="noopener noreferrer">
            Get directions on Google Maps (opens a new tab)
          </a>
        </p>
      )}
      <p>
        Maps opens an external service. You can enter a starting address there
        without sharing your location. If maps or location access is
        unavailable, use the address above.
      </p>
      <h2>Venue photos and maps</h2>
      {data.venue.media.length ? (
        <>
          <p>
            Images supplied by the venue. Loading an image contacts its external
            host, which receives your network address. Descriptions are
            available without loading images.
          </p>
          {data.venue.media.map((item: VenueImage) => (
            <VenueImageView key={item.url} item={item} />
          ))}
        </>
      ) : (
        <p>No venue photos or maps have been supplied.</p>
      )}
      <h2>Venue contact</h2>
      {venue.contact ? (
        <div>
          <p>Contact details supplied by the venue.</p>
          {venue.contact.phone && (
            <p>
              <a href={`tel:${venue.contact.phone}`}>{venue.contact.phone}</a>
            </p>
          )}
          {venue.contact.email && (
            <p>
              <a href={`mailto:${encodeURIComponent(venue.contact.email)}`}>
                {venue.contact.email}
              </a>
            </p>
          )}
        </div>
      ) : (
        <p>No public contact details have been provided.</p>
      )}
      <h2>Venue-wide information</h2>
      <h3>Amenities</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>
        {venue.amenities || "Amenities have not been provided."}
      </p>
      <h3>Accessibility</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>
        {venue.accessibility ||
          "Accessibility information has not been provided. Check with the organizer before booking."}
      </p>
      {[
        ["Transport guidance", venue.transportGuidance],
        ["Parking guidance", venue.parkingGuidance],
        ["Venue entry policies", venue.entryPolicies],
      ].map(([label, value]) => (
        <div key={label}>
          <h3>{label}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {value ||
              "Information has not been provided. Check with the organizer before travelling."}
          </p>
        </div>
      ))}
      <p>
        Entry conditions, age restrictions and ticket policies may differ by
        session. Review the listing and checkout terms for your selection.
      </p>
      <h2>Upcoming sessions</h2>
      <p>
        Times are shown in each session’s local time zone. Ticket availability
        and sales eligibility are checked when you select a session.
      </p>
      {!data.items.length && (
        <p>No upcoming sessions are listed on this page.</p>
      )}
      {data.items.map((session: any) => (
        <article className="organization" key={session.id}>
          <h3>
            <a href={`/listing/${session.listingId}`}>{session.title}</a>
          </h3>
          <p>
            {session.kind} · {session.spaceName}
          </p>
          <p>
            <time dateTime={session.startsAt}>
              {new Date(session.startsAt).toLocaleString("en-IN", {
                timeZone: session.timeZone,
              })}
            </time>{" "}
            · {session.timeZone}
          </p>
          <a href={`/occurrence/${session.id}`}>View tickets</a>
        </article>
      ))}
      <nav className="chips" aria-label="Venue session pages">
        {after && <a href={`/venue/${id}`}>First sessions</a>}
        {data.nextCursor && (
          <a href={`/venue/${id}?after=${encodeURIComponent(data.nextCursor)}`}>
            More sessions
          </a>
        )}
      </nav>
    </section>
  );
}
