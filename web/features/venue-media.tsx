import { useState } from "react";
import type { VenueImage } from "../../src/modules/venues/domain/media.ts";
export function VenueImageView({ item }: { item: VenueImage }) {
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  let host = "external host";
  try {
    host = new URL(item.url).hostname;
  } catch {
    /* unsaved draft */
  }
  return (
    <figure>
      <figcaption>
        <strong>{item.kind === "map" ? "Venue map" : "Venue photo"}</strong>
        {item.caption && ` · ${item.caption}`}
      </figcaption>
      <p>{item.alt}</p>
      {!loaded && (
        <button type="button" onClick={() => setLoaded(true)}>
          Load image from {host}
        </button>
      )}
      {loaded && !failed && (
        <img
          src={item.url}
          alt={item.alt}
          referrerPolicy="no-referrer"
          style={{ maxWidth: "100%", maxHeight: 480, objectFit: "contain" }}
          onError={() => setFailed(true)}
        />
      )}
      {failed && (
        <p role="status">
          Image could not be loaded. The description above is still available.{" "}
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setLoaded(false);
            }}
          >
            Retry image
          </button>
        </p>
      )}
      {item.attribution && <p>Credit: {item.attribution}</p>}
    </figure>
  );
}
export function VenueMediaEditor({
  venue,
  onDirty,
  save,
  busy,
}: {
  venue: {
    id: string;
    name: string;
    media_version: number;
    media: VenueImage[];
  };
  onDirty: () => void;
  save: (input: {
    expectedVersion: number;
    items: VenueImage[];
  }) => Promise<boolean>;
  busy: boolean;
}) {
  const [items, setItems] = useState<VenueImage[]>(venue.media),
    [preview, setPreview] = useState(false);
  const update = (next: VenueImage[]) => {
    setItems(next);
    setPreview(false);
    onDirty();
  };
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await save({ expectedVersion: venue.media_version, items });
      }}
    >
      <h3>{venue.name}</h3>
      {items.map((item, index) => (
        <fieldset key={index} disabled={busy}>
          <legend>Image {index + 1}</legend>
          <label>
            Kind
            <select
              value={item.kind}
              onChange={(e) =>
                update(
                  items.map((v, i) =>
                    i === index
                      ? { ...v, kind: e.target.value as VenueImage["kind"] }
                      : v,
                  ),
                )
              }
            >
              <option value="photo">Photo</option>
              <option value="map">Map</option>
            </select>
          </label>
          {(
            [
              ["url", "HTTPS image URL", 2048],
              ["alt", "Alternative text (describe the image)", 500],
              ["caption", "Caption", 500],
              ["attribution", "Attribution / credit", 500],
            ] as const
          ).map(([field, label, max]) => (
            <label key={field}>
              {label}
              <input
                type={field === "url" ? "url" : "text"}
                required={field === "url" || field === "alt"}
                maxLength={max}
                value={item[field]}
                onChange={(e) =>
                  update(
                    items.map((v, i) =>
                      i === index ? { ...v, [field]: e.target.value } : v,
                    ),
                  )
                }
              />
            </label>
          ))}
          <button
            type="button"
            disabled={index === 0}
            onClick={() => {
              const copy = [...items];
              [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
              update(copy);
            }}
          >
            Move image {index + 1} up
          </button>
          <button
            type="button"
            disabled={index === items.length - 1}
            onClick={() => {
              const copy = [...items];
              [copy[index + 1], copy[index]] = [copy[index], copy[index + 1]];
              update(copy);
            }}
          >
            Move image {index + 1} down
          </button>
          <button
            type="button"
            onClick={() => update(items.filter((_, i) => i !== index))}
          >
            Remove image {index + 1}
          </button>
        </fieldset>
      ))}
      {!items.length && <p>No venue images supplied.</p>}
      <button
        type="button"
        disabled={busy || items.length >= 8}
        onClick={() =>
          update([
            ...items,
            { url: "", kind: "photo", alt: "", caption: "", attribution: "" },
          ])
        }
      >
        Add image
      </button>
      <button
        type="button"
        disabled={busy || !items.length}
        onClick={() => setPreview(!preview)}
      >
        Toggle preview
      </button>
      <button disabled={busy}>Save images</button>
      {preview &&
        items.map((item, i) =>
          item.url.startsWith("https://") ? (
            <VenueImageView key={`${i}:${item.url}`} item={item} />
          ) : (
            <p key={i}>Enter an HTTPS URL to preview image {i + 1}.</p>
          ),
        )}
    </form>
  );
}
