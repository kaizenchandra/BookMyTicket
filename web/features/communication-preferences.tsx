import { consentPolicies } from "../../src/modules/profiles/domain/consent-policies.ts";
import { MarketingConsentHistory } from "./marketing-consent-history.tsx";
import { useEffect, useState } from "react";
import { api } from "../api.ts";
type Preferences = {
  language: string;
  marketingEmail: boolean;
  version: number;
  consentVersion: 1;
};
export function CommunicationPreferences() {
  const [saved, setSaved] = useState<Preferences | null>(null),
    [language, setLanguage] = useState("en"),
    [marketing, setMarketing] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const value = await api("/profile/communications");
      setSaved(value);
      setLanguage(value.language);
      setMarketing(value.marketingEmail);
      setMessage("");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <section aria-labelledby="communication-heading">
      <h2 id="communication-heading">Language and communications</h2>
      <p>
        Booking, payment and account security messages are required and remain
        available in your inbox. Marketing permission is optional.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!saved) return;
          setBusy(true);
          try {
            const value = await api("/profile/communications", {
              method: "PUT",
              body: JSON.stringify({
                language,
                marketingEmail: marketing,
                version: saved.version,
                consentVersion: 1,
              }),
            });
            setSaved(value);
            setMessage("Communication preferences saved.");
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="preferred-language">Preferred language</label>
        <select
          id="preferred-language"
          value={language}
          disabled={!saved || busy}
          onChange={(event) => setLanguage(event.target.value)}
        >
          {Object.entries({
            en: "English",
            hi: "Hindi",
            kn: "Kannada",
            ta: "Tamil",
            te: "Telugu",
            mr: "Marathi",
            bn: "Bengali",
            ml: "Malayalam",
            gu: "Gujarati",
            pa: "Punjabi",
          }).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <p>
          Your preference is saved for supported communications. The interface
          currently uses English.
        </p>
        <label>
          <input
            type="checkbox"
            checked={marketing}
            disabled={!saved || busy}
            onChange={(event) => setMarketing(event.target.checked)}
          />{" "}
          {consentPolicies.marketing_email.text}
        </label>
        <p>
          Marketing email consent, version 1. Saving permission does not
          subscribe you to an external mailing service; campaign delivery is not
          yet available.
        </p>
        <button disabled={!saved || busy} className="primary">
          {busy ? "Saving or loading…" : "Save communication preferences"}
        </button>
        <button type="button" disabled={busy} onClick={() => void load()}>
          Reload saved preferences
        </button>
      </form>
      <p role="status">{message}</p>
      <MarketingConsentHistory revision={saved?.version ?? 0} />
    </section>
  );
}
