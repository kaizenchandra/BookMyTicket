import { useEffect, useState } from "react";
import { api } from "../api.ts";
export function OnlineAccessEditor({ occurrenceId }: { occurrenceId: string }) {
  const [configuration, setConfiguration] = useState<any>(undefined),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api(`/occurrences/${occurrenceId}/online-access`)
      .then((r) => {
        if (active) setConfiguration(r.configuration);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [occurrenceId, revision]);
  return (
    <details>
      <summary>Online joining access</summary>
      <p>
        Joining information is restricted to customers with confirmed, active
        unused tickets during this access window. A shared external link can
        still be copied; use your meeting provider's own attendee controls.
      </p>
      <form
        key={`${occurrenceId}:${configuration?.version ?? 0}:${revision}`}
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          try {
            const result = await api(
              `/occurrences/${occurrenceId}/online-access`,
              {
                method: "PUT",
                body: JSON.stringify({
                  expectedVersion: configuration?.version ?? 0,
                  ...(form.get("url") ? { url: String(form.get("url")) } : {}),
                  opensAt: String(form.get("opensAt")),
                  closesAt: String(form.get("closesAt")),
                  enabled: form.get("enabled") === "on",
                }),
              },
            );
            setConfiguration(result.configuration);
            setMessage(
              "Online access settings saved. The joining URL is never displayed in public listings.",
            );
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || configuration === undefined}>
          <label>
            HTTPS joining URL{" "}
            {configuration ? "(leave blank to keep existing)" : ""}
            <input
              name="url"
              type="url"
              required={!configuration}
              autoComplete="off"
              placeholder="https://your-meeting-provider.example/join"
            />
          </label>
          <p>The saved link is encrypted and is not returned to this editor.</p>
          <label>
            Access opens (ISO timestamp with UTC offset)
            <input
              name="opensAt"
              required
              defaultValue={configuration?.opens_at ?? ""}
              placeholder="2027-01-15T18:00:00+05:30"
            />
          </label>
          <label>
            Access closes (ISO timestamp with UTC offset)
            <input
              name="closesAt"
              required
              defaultValue={configuration?.closes_at ?? ""}
              placeholder="2027-01-15T21:00:00+05:30"
            />
          </label>
          <label>
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={configuration?.enabled ?? false}
            />{" "}
            Enable ticket-holder access
          </label>
          <p>
            Maximum window: seven days. Access closes at the exact closing time.
          </p>
          <button className="primary">Save online access</button>
        </fieldset>
      </form>
      <button disabled={busy} onClick={() => setRevision((r) => r + 1)}>
        Reload saved settings
      </button>
      <p role="status">{message}</p>
    </details>
  );
}
export function OnlineEventAccess({
  orderId,
  occurrenceId,
}: {
  orderId: string;
  occurrenceId: string;
}) {
  const [status, setStatus] = useState<any>(null),
    [url, setUrl] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const path = `/bookings/${orderId}/online-access/${occurrenceId}`;
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const result = await api(path);
        if (active) {
          setStatus(result);
          setUrl("");
          setMessage("");
        }
      } catch (error) {
        if (active) {
          setStatus(null);
          setUrl("");
          setMessage((error as Error).message);
        }
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [path]);
  if (status?.configured === false) return null;
  return (
    <section aria-label="Online event access">
      <h3>Online event access</h3>
      {status?.configured && (
        <>
          <p>
            {status.allowed
              ? "Your joining link is available."
              : status.reason === "not_open"
                ? `Access opens ${new Date(status.opensAt).toLocaleString("en-IN")}.`
                : status.reason === "expired"
                  ? "This access window has ended."
                  : "Online access is disabled by the organizer."}
          </p>
          <button
            disabled={!status.allowed || busy}
            onClick={async () => {
              setBusy(true);
              setUrl("");
              try {
                const result = await api(path, { method: "POST", body: "{}" });
                setStatus(result);
                if (result.url) setUrl(result.url);
              } catch (error) {
                setMessage((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Get joining link
          </button>
          {url && (
            <p>
              <a
                className="primary"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Join at {new URL(url).hostname} ↗
              </a>
            </p>
          )}
          <p className="muted">
            Joining opens the organizer's external service. This does not record
            admission or guarantee the external service is available.
          </p>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
