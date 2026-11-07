import { BookingProgress, SeatSelection } from "./features/booking-design.tsx";
import { CommunicationPreferences } from "./features/communication-preferences.tsx";
import { CategoryDetail } from "./features/category-detail.tsx";
import { CatalogSearch, CatalogFilters } from "./features/catalog-search.tsx";
import { NotificationInbox } from "./features/notifications.tsx";
import { ProviderStaff } from "./features/provider-staff.tsx";
import { SupportOperations } from "./features/support-operations.tsx";
import { VenueWorkspace } from "./features/venues.tsx";
import { SaveListing, FavoritesPage } from "./features/favorites.tsx";
import { SessionManagement } from "./features/sessions.tsx";
import { AccountSecurity } from "./features/mfa.tsx";
import { PricingAdmin } from "./features/pricing-admin.tsx";
import { CheckoutQuote, BookingDetail } from "./features/checkout.tsx";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, ApiError, money } from "./api.ts";
import "./style.css";
type Listing = {
  nextSession?: {
    startsAt: string;
    timeZone: string;
    venueName: string;
  } | null;
  id: string;
  title: string;
  kind: string;
  city: string;
  description: string;
  poster_url: string | null;
  metadata: Record<string, string>;
};
function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const clear = () => {
      setData(null);
      setError("");
      setRevision((r) => r + 1);
    };
    window.addEventListener("bmt-session", clear);
    return () => window.removeEventListener("bmt-session", clear);
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    api<T>(path)
      .then((d) => {
        if (current) setData(d);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [path, revision]);
  return { data, error, loading, retry: () => setRevision((r) => r + 1) };
}
function Notice({ message }: { message: string }) {
  return (
    <div className="notice" role="status">
      {message}
    </div>
  );
}
function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="ticket-icon" aria-hidden="true">
        ◇
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
function App() {
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme ?? "LIGHT",
  );
  const [city, setCity] = useState(
    () =>
      new URLSearchParams(location.search).get("city") ??
      localStorage.getItem("bmt-city") ??
      "",
  );
  const [cityOpen, setCityOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState(
    new URLSearchParams(location.search).get("q") ?? "",
  );
  const identityRef = React.useRef<string | null>(null);
  useEffect(() => {
    let current = true;
    const refresh = async () => {
      const expected = identityRef.current;
      try {
        const account = await api("/me");
        if (!current || identityRef.current !== expected) return;
        if (identityRef.current !== account.id) {
          identityRef.current = account.id;
          setMe(account);
          window.dispatchEvent(new Event("bmt-session"));
        }
      } catch (error) {
        if (
          current &&
          identityRef.current === expected &&
          error instanceof ApiError &&
          error.status === 401 &&
          identityRef.current
        ) {
          identityRef.current = null;
          setMe(null);
          window.dispatchEvent(new Event("bmt-session"));
        }
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      current = false;
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("bmt-theme", theme);
  }, [theme]);
  const route = location.pathname;
  const category =
    route === "/events" ? "event" : route === "/sports" ? "sports" : "movie";
  async function toggleTheme() {
    const next = theme === "LIGHT" ? "DARK" : "LIGHT";
    setTheme(next);
    if (me) {
      try {
        const profile = await api("/profile");
        await api("/profile", {
          method: "PUT",
          body: JSON.stringify({
            name: profile.name,
            city: profile.city,
            theme: next,
          }),
        });
      } catch {
        setStatus(
          "Theme saved on this device. Account synchronization failed.",
        );
      }
    }
  }
  async function signedIn(user: any) {
    identityRef.current = user.id;
    setMe(user);
    window.dispatchEvent(new Event("bmt-session"));
    setAuthOpen(false);
    try {
      const p = await api("/profile");
      setTheme(p.theme);
    } catch {}
  }
  return (
    <>
      <a className="skip" href="#main">
        Skip to main content
      </a>
      <header>
        <div className="top container">
          <a className="brand" href="/explore" aria-label="BookMyTicket home">
            book<span>my</span>ticket
          </a>
          <CatalogSearch
            value={search}
            onChange={setSearch}
            city={city}
            action={
              ["/", "/explore", "/movies", "/events", "/sports"].includes(route)
                ? route
                : "/explore"
            }
          />
          <button className="location" onClick={() => setCityOpen(true)}>
            {city || "Select your city"} <span aria-hidden="true">⌄</span>
          </button>
          <button
            className="primary compact"
            onClick={() =>
              me ? location.assign("/profile") : setAuthOpen(true)
            }
          >
            {me ? "My account" : "Sign in"}
          </button>
          <button
            className="theme"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "LIGHT" ? "Dark" : "Light"} theme`}
            aria-pressed={theme === "DARK"}
          >
            {theme === "LIGHT" ? "☾" : "☀"}
          </button>
        </div>
        <div className="nav-bar">
          <nav className="container nav" aria-label="Primary">
            <div>
              {[
                ["Movies", "/movies"],
                ["Events", "/events"],
                ["Sports", "/sports"],
              ].map(([label, url]) => (
                <a
                  key={url}
                  className={route === url ? "active" : ""}
                  href={`${url}${city ? "?city=" + encodeURIComponent(city) : ""}`}
                >
                  {label}
                </a>
              ))}
            </div>
            <div>
              <a href="/partner/onboarding">List your show</a>
              <a href="/favorites">Favorites</a>
              <a href="/bookings">My bookings</a>
              <a href="/notifications">Notifications</a>
              <a href="/help">Help</a>
            </div>
          </nav>
        </div>
      </header>
      <main
        id="main"
        className={`container ${/^\/(occurrence|checkout|bookings)\//.test(route) ? "booking-main" : ""}`}
      >
        {status && <Notice message={status} />}
        {["/", "/explore", "/movies", "/events", "/sports"].includes(route) ? (
          <Discovery
            city={city}
            category={category}
            search={new URLSearchParams(location.search).get("q") ?? ""}
            selectCity={() => setCityOpen(true)}
          />
        ) : route.startsWith("/listing/") ? (
          <Detail
            id={route.split("/")[2]}
            accountId={me?.id}
            signIn={() => setAuthOpen(true)}
          />
        ) : route.startsWith("/occurrence/") ? (
          <Seats id={route.split("/")[2]} signIn={() => setAuthOpen(true)} />
        ) : route.startsWith("/checkout/") ? (
          <Reservation id={route.split("/")[2]} />
        ) : route === "/favorites" ? (
          <FavoritesPage
            key={me?.id ?? "anonymous"}
            accountId={me?.id}
            signIn={() => setAuthOpen(true)}
          />
        ) : route === "/notifications" ? (
          <NotificationInbox
            key={me?.id ?? "anonymous"}
            accountId={me?.id}
            signIn={() => setAuthOpen(true)}
          />
        ) : route === "/profile" ? (
          <Profile
            key={me?.id ?? "anonymous"}
            me={me}
            signIn={() => setAuthOpen(true)}
            setTheme={setTheme}
          />
        ) : route === "/partner/venues" ? (
          <VenueWorkspace key={me?.id ?? "anonymous"} />
        ) : route === "/partner" || route.startsWith("/partner/") ? (
          <Provider
            key={me?.id ?? "anonymous"}
            signIn={() => setAuthOpen(true)}
          />
        ) : route.startsWith("/bookings/") ? (
          <BookingDetail key={me?.id ?? "anonymous"} id={route.split("/")[2]} />
        ) : route === "/bookings" ? (
          <Bookings />
        ) : route === "/scanner" ? (
          <Scanner key={me?.id ?? "anonymous"} />
        ) : route === "/admin/pricing" ? (
          <PricingAdmin />
        ) : route === "/admin" ? (
          <Admin />
        ) : route === "/operations" ? (
          <Operations key={me?.id ?? "anonymous"} />
        ) : route === "/cases" ? (
          <Cases />
        ) : route === "/help" ? (
          <section className="reading">
            <p className="eyebrow">HELP & ACCESSIBILITY</p>
            <h1>How can we help?</h1>
            <h2>Payment uncertainty</h2>
            <p>
              A payment callback is not a booking confirmation. If a payment is
              pending, retrieve its status before making another payment.
            </p>
            <h2>Booking availability</h2>
            <p>
              Seats are held only after the server confirms a reservation. The
              countdown uses server time; refreshing does not extend it.
            </p>
            <h2>Accessibility</h2>
            <p>
              Use keyboard navigation and the seat list to select places. Light
              and Dark themes are available from the header.
            </p>
            <a className="primary" href="/cases">
              Contact support
            </a>
            <p>
              Do not include OTPs or payment secrets in support messages. No
              response estimate is configured.
            </p>
          </section>
        ) : (
          <Empty title="This page is not available">
            Return to <a href="/explore">discovery</a> to browse published
            listings.
          </Empty>
        )}
      </main>
      <section className="partner-strip">
        <div className="container">
          <div>
            <strong>Bring your audience together.</strong>
            <p>Movies, live experiences, and sporting moments.</p>
          </div>
          <a className="primary" href="/partner/onboarding">
            List your show
          </a>
        </div>
      </section>
      <footer className="container">
        <a className="brand" href="/explore">
          book<span>my</span>ticket
        </a>
        <p>
          Independent ticket booking platform. Not affiliated with BookMyShow.
        </p>
        <div>
          <a href="/help">Help & accessibility</a>
          <a href="/partner/cinema">Cinema partners</a>
          <a href="/partner/organizer">Event & sports organizers</a>
          <a href="/bookings">My bookings</a>
          <a href="/notifications">Notifications</a>
          <a href="/admin">Administration</a>
          <a href="/operations">Support & finance</a>
          <a href="/scanner">Admission</a>
        </div>
        <small>Development build · Live sales are not enabled</small>
      </footer>
      {cityOpen && (
        <Modal title="Choose your city" close={() => setCityOpen(false)}>
          <CityPicker
            city={city}
            onChoose={(value) => {
              setCity(value);
              localStorage.setItem("bmt-city", value);
              setCityOpen(false);
              const url = new URL(location.href);
              url.searchParams.set("city", value);
              url.searchParams.delete("after");
              location.assign(url.toString());
            }}
          />
        </Modal>
      )}
      {authOpen && (
        <Modal title="Get started" close={() => setAuthOpen(false)}>
          <SignIn onSuccess={signedIn} />
        </Modal>
      )}
    </>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => before?.focus();
  }, []);
  return (
    <dialog ref={ref} onCancel={close}>
      <div className="modal-heading">
        <h2>{title}</h2>
        <button onClick={close} aria-label="Close dialog">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function CityPicker({
  city,
  onChoose,
}: {
  city: string;
  onChoose: (c: string) => void;
}) {
  const { data, error, loading } = useLoad<{ items: string[] }>("/cities");
  const [value, setValue] = useState(city);
  return (
    <>
      <p>Choose a city with published listings, or enter your city manually.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onChoose(value.trim());
        }}
      >
        <label htmlFor="city">City name</label>
        <input
          id="city"
          value={value}
          required
          maxLength={100}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="primary">Use this city</button>
      </form>
      {loading ? (
        <p>Loading cities…</p>
      ) : error ? (
        <Notice message={error} />
      ) : (
        <div className="chips">
          {data?.items.map((c) => (
            <button key={c} onClick={() => onChoose(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
function Discovery({
  city,
  category,
  search,
  selectCity,
}: {
  city: string;
  category: string;
  search: string;
  selectCity: () => void;
}) {
  const parameters = new URLSearchParams(location.search);
  const extra = Object.fromEntries(
    ["language", "genre", "format", "sort", "after"]
      .filter((k) => parameters.get(k))
      .map((k) => [k, parameters.get(k)!]),
  );
  const firstPage = new URLSearchParams(parameters);
  firstPage.delete("after");
  const query = new URLSearchParams({
    kind: category,
    ...(category === "event" ? { upcoming: "true" } : {}),
    ...extra,
    ...(city ? { city } : {}),
    ...(search ? { q: search } : {}),
  });
  const { data, error, loading, retry } = useLoad<{
    items: Listing[];
    nextCursor: string | null;
    total: number;
    facets: Record<string, string[]>;
  }>(`/catalog?${query}`);
  return (
    <>
      <section className="intro">
        <div>
          <p className="eyebrow">YOUR NEXT EXPERIENCE</p>
          <h1>
            {category === "movie"
              ? "Movies"
              : category === "event"
                ? "Events"
                : "Sports"}
            {city ? ` in ${city}` : ""}
          </h1>
          <p>Find a moment worth stepping out for.</p>
        </div>
        <button onClick={selectCity}>
          ⌖ {city ? "Change city" : "Choose your city"}
        </button>
      </section>
      <div className="discovery-layout">
        <aside className="filters">
          <h2>Browse</h2>
          <CatalogFilters
            key={query.toString() + JSON.stringify(data?.facets)}
            facets={data?.facets ?? {}}
            city={city}
            search={search}
          />
          <p>Category</p>
          <div className="chips">
            {[
              ["Movies", "/movies"],
              ["Events", "/events"],
              ["Sports", "/sports"],
            ].map(([name, href]) => (
              <a
                key={href}
                href={`${href}?${new URLSearchParams(city ? { city } : {})}`}
              >
                {name}
              </a>
            ))}
          </div>
          {search && (
            <>
              <p>Search</p>
              <a
                className="chip"
                href={`${location.pathname}?${new URLSearchParams(city ? { city } : {})}`}
              >
                {search} ×
              </a>
            </>
          )}
          <p className="muted">
            Only published listings appear here. Availability is confirmed when
            you reserve.
          </p>
        </aside>
        <section className="results" aria-label="Listings">
          <div className="section-heading">
            <h2>
              {search
                ? `Results for “${search}”`
                : category === "movie"
                  ? "Movies"
                  : category === "event"
                    ? "Upcoming events"
                    : "Upcoming fixtures"}
            </h2>
          </div>
          {!loading && data && !error && (
            <p role="status">{data.total} matching listings</p>
          )}
          {loading ? (
            <div role="status" className="skeleton">
              Loading available listings…
            </div>
          ) : error ? (
            <>
              <Notice message={error} />
              <button onClick={retry}>Try again</button>
            </>
          ) : !data?.items.length ? (
            <Empty
              title={
                search
                  ? "No matching listings"
                  : "Your next experience is on its way"
              }
            >
              {search
                ? "Try another title or clear your search."
                : `No published ${category === "movie" ? "movies" : category === "event" ? "events" : "sports fixtures"}${city ? " in " + city : ""} are available yet.`}
              {(search || city || Object.keys(extra).length > 0) && (
                <a className="chip" href={`${location.pathname}?city=`}>
                  Clear filters
                </a>
              )}
              <a className="chip" href="/partner">
                Cinema or organizer? Publish your listings
              </a>
            </Empty>
          ) : (
            <div className="cards">
              {data.items.map((item) => (
                <a className="card" href={`/listing/${item.id}`} key={item.id}>
                  {item.poster_url ? (
                    <img
                      src={item.poster_url}
                      alt={`${item.title} poster`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="poster-fallback">
                      {item.kind.toUpperCase()}
                      <span>{item.title}</span>
                    </div>
                  )}
                  {item.metadata.demo === "true" && (
                    <p className="eyebrow">DEMO · Fictional listing</p>
                  )}
                  <h3>{item.title}</h3>
                  {item.nextSession && (
                    <>
                      <p className="event-date">
                        {new Date(item.nextSession.startsAt).toLocaleString(
                          "en-IN",
                          {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: item.nextSession.timeZone,
                          },
                        )}
                      </p>
                      <p>{item.nextSession.venueName}</p>
                    </>
                  )}
                  <p>{item.city}</p>
                  <p>{item.metadata.genre ?? item.kind}</p>
                </a>
              ))}
            </div>
          )}
          <nav aria-label="Catalog pages" className="chips">
            {parameters.has("after") && (
              <a href={`${location.pathname}?${firstPage}`}>First page</a>
            )}
            {!loading && !error && data?.nextCursor && (
              <a
                href={`${location.pathname}?${new URLSearchParams({ ...Object.fromEntries(parameters), city, q: search, after: data.nextCursor })}`}
              >
                Next page
              </a>
            )}
          </nav>
        </section>
      </div>
    </>
  );
}
function SignIn({ onSuccess }: { onSuccess: (user: any) => void }) {
  const [email, setEmail] = useState(""),
    [challenge, setChallenge] = useState<any>(null),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [resendAt, setResendAt] = useState(0),
    [expiresAt, setExpiresAt] = useState(0),
    [now, setNow] = useState(Date.now());
  const {
    data: configuration,
    loading: configLoading,
    error: configError,
    retry: reloadConfiguration,
  } = useLoad<{
    otpAvailable: boolean;
    otpDelivery: string;
    localMailpitUrl: string | null;
  }>("/config");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function requestCode() {
    const next = await api("/auth/challenges", {
      method: "POST",
      body: JSON.stringify({ email: email.trim() }),
    });
    setChallenge(next);
    setCode("");
    setResendAt(Date.now() + next.resendAfterSeconds * 1000);
    setExpiresAt(Date.now() + next.expiresInSeconds * 1000);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!challenge) await requestCode();
      else
        onSuccess(
          await api("/auth/verify", {
            method: "POST",
            body: JSON.stringify({ challengeId: challenge.challengeId, code }),
          }),
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (busy || Date.now() < resendAt) return;
    setBusy(true);
    setError("");
    try {
      await requestCode();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const cooldown = Math.max(0, Math.ceil((resendAt - now) / 1000));
  return (
    <form onSubmit={submit}>
      <p>
        Sign up or log in with your email. A new account is created only after
        you verify the code.
      </p>
      {configLoading && <p role="status">Checking email configuration…</p>}
      {configError && (
        <>
          <Notice message={configError} />
          <button type="button" onClick={reloadConfiguration}>
            Retry email configuration
          </button>
        </>
      )}
      {configuration && !configuration.otpAvailable && (
        <Notice message="Email verification is not configured. No code can be sent until the email service and OTP secret are configured." />
      )}
      {configuration?.localMailpitUrl && (
        <p className="notice">
          Local development: verification emails are captured in{" "}
          <a
            href={configuration.localMailpitUrl}
            target="_blank"
            rel="noreferrer"
          >
            Mailpit inbox
          </a>
          , not sent to your external email inbox.
        </p>
      )}
      {challenge ? (
        <>
          <p>
            Code sent to {challenge.destination}.{" "}
            {now < expiresAt
              ? "It expires in " +
                Math.max(0, Math.ceil((expiresAt - now) / 1000)) +
                " seconds."
              : "This code has expired. Request another code."}
          </p>
          <label htmlFor="otp">Six-digit verification code</label>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setChallenge(null);
              setCode("");
              setError("");
            }}
          >
            Change email
          </button>
          <button
            type="button"
            disabled={busy || cooldown > 0}
            onClick={resend}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </>
      ) : (
        <>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </>
      )}
      {error && <Notice message={error} />}
      <button
        className="primary"
        disabled={
          busy ||
          configLoading ||
          !configuration?.otpAvailable ||
          Boolean(challenge && now >= expiresAt)
        }
      >
        {busy
          ? "Please wait…"
          : challenge
            ? "Verify and continue"
            : "Send verification code"}
      </button>
      <p className="muted">Never share your verification code with anyone.</p>
    </form>
  );
}

function Detail({
  id,
  accountId,
  signIn,
}: {
  id: string;
  accountId?: string;
  signIn: () => void;
}) {
  const { data, error, loading } = useLoad<Listing>(`/catalog/${id}`);
  if (loading) return <p role="status">Loading listing…</p>;
  if (error || !data) return <Notice message={error || "Listing not found."} />;
  return (
    <div className="listing-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a
          href={`/${data.kind === "movie" ? "movies" : data.kind === "event" ? "events" : "sports"}`}
        >
          {data.kind === "movie"
            ? "Movies"
            : data.kind === "event"
              ? "Events"
              : "Sports"}
        </a>
        <span aria-hidden="true">›</span>
        <span>{data.title}</span>
      </nav>
      <section className="detail detail-hero">
        <div className="detail-poster">
          {data.poster_url ? (
            <img src={data.poster_url} alt={`${data.title} poster`} />
          ) : (
            <div className="poster-fallback">{data.title}</div>
          )}
          <span>
            {data.metadata.demo === "true"
              ? "Fictional demo listing"
              : data.city}
          </span>
        </div>
        <div className="detail-headline">
          <p className="eyebrow">
            {data.kind === "movie" ? "AT THE MOVIES" : "LIVE EXPERIENCES"} ·{" "}
            {data.city}
          </p>
          <h1>{data.title}</h1>
          <div className="format-tags">
            {[data.metadata.format, data.metadata.language]
              .filter(Boolean)
              .map((value, i) => (
                <span key={i}>{value}</span>
              ))}
          </div>
          <p className="detail-meta">
            {[
              data.metadata.duration,
              data.metadata.genre,
              data.metadata.certification,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="detail-actions">
            <a className="primary" href="#sessions">
              Book tickets
            </a>
            <SaveListing id={id} accountId={accountId} signIn={signIn} />
          </div>
          {data.metadata.demo === "true" && (
            <p className="demo-disclosure">
              DEMO · Fictional listing. Paid demo sessions cannot collect
              payments.
            </p>
          )}
        </div>
      </section>
      <section className="detail-about">
        <h2>About {data.kind === "movie" ? "the movie" : "the experience"}</h2>
        <p>{data.description}</p>
        {data.metadata.managedBy ? (
          <CategoryDetail id={id} category={data.metadata.managedBy} />
        ) : (
          <dl>
            {Object.entries(data.metadata).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <Occurrences listingId={id} />
    </div>
  );
}

function Seats({ id, signIn }: { id: string; signIn: () => void }) {
  const { data, error, loading, retry } = useLoad<any>(
    `/occurrences/${id}/inventory`,
  );
  const [selected, setSelected] = useState<Record<string, number>>({}),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const key = React.useRef(crypto.randomUUID());
  async function reserve() {
    setBusy(true);
    try {
      const r = await api("/reservations", {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: JSON.stringify({
          items: Object.entries(selected)
            .filter(([, n]) => n > 0)
            .map(([resourceId, quantity]) => ({
              occurrenceId: id,
              resourceId,
              quantity,
            })),
        }),
      });
      location.assign(`/checkout/${r.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) signIn();
      setMessage((e as Error).message);
      retry();
    } finally {
      setBusy(false);
    }
  }
  if (loading && !data) return <p>Loading seats…</p>;
  if (error) return <Notice message={error} />;
  return (
    <section>
      <BookingProgress step={2} />
      <div className="booking-title">
        <a
          className="back-link"
          href={`/listing/${data.occurrence.listing_id}`}
          aria-label="Back to showtimes"
        >
          ‹
        </a>
        <div>
          <p className="eyebrow">SELECT YOUR TICKETS</p>
          <h1>{data?.occurrence.venue_name}</h1>
          <p>
            {new Date(data?.occurrence.starts_at).toLocaleString("en-IN", {
              timeZone: data?.occurrence.time_zone,
            })}{" "}
            · {data?.occurrence.time_zone}
          </p>
        </div>
      </div>
      {data.occurrence.venue_snapshot?.accessibility && (
        <p className="venue-access">
          {data.occurrence.venue_snapshot.accessibility}
        </p>
      )}
      <SeatSelection
        resources={data.resources}
        plan={data.occurrence.venue_snapshot?.configuration}
        selected={selected}
        busy={busy}
        onChange={(resourceId, quantity) => {
          setSelected({ ...selected, [resourceId]: quantity });
          key.current = crypto.randomUUID();
        }}
      />
      <p className="muted">
        Your selection is reserved only after the server confirms the hold.
      </p>
      {message && <Notice message={message} />}
      <div className="booking-bottom-bar">
        <div>
          <strong>
            {Object.values(selected).reduce((sum, n) => sum + n, 0)} ticket(s)
            selected
          </strong>
          <span>
            {money(
              data.resources.reduce(
                (sum: number, r: any) =>
                  sum + (selected[r.id] ?? 0) * r.price_paise,
                0,
              ),
            )}{" "}
            <small>before fees & taxes</small>
          </span>
        </div>
        <button
          className="primary"
          disabled={busy || !Object.values(selected).some((n) => n > 0)}
          onClick={reserve}
        >
          {busy ? "Reserving…" : "Continue"}
        </button>
      </div>
    </section>
  );
}
function Reservation({ id }: { id: string }) {
  const { data, error, loading, retry } = useLoad<any>(`/reservations/${id}`);
  const [remaining, setRemaining] = useState(0);
  const [releaseError, setReleaseError] = useState("");
  useEffect(() => {
    if (!data) return;
    const offset = new Date(data.server_time).getTime() - Date.now();
    const tick = () =>
      setRemaining(
        Math.max(
          0,
          Math.floor(
            (new Date(data.expires_at).getTime() - Date.now() - offset) / 1000,
          ),
        ),
      );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data]);
  if (loading) return <p>Retrieving reservation…</p>;
  if (error) return <Notice message={error} />;
  return (
    <section className="reading reservation-page">
      <BookingProgress step={3} />
      <p className="eyebrow">YOUR RESERVATION</p>
      <h1>Review your selection</h1>
      <p className="hold-timer">
        {remaining > 0 && data.effective_state === "active"
          ? `Hold expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
          : "This reservation is no longer active."}
      </p>
      <details className="reservation-items">
        <summary>
          Your selection · {money(data.subtotalPaise)} before fees and taxes
        </summary>
        <ul>
          {data.items.map((i: any) => (
            <li key={i.resource_id}>
              {i.resource_id} × {i.quantity}{" "}
              <strong>{money(i.quantity * i.unit_price_paise)}</strong>
            </li>
          ))}
        </ul>
      </details>
      <CheckoutQuote
        reservationId={id}
        active={remaining > 0 && data.effective_state === "active"}
      />
      {releaseError && <Notice message={releaseError} />}
      <button onClick={retry}>Refresh reservation status</button>
      <button
        onClick={async () => {
          try {
            await api(`/reservations/${id}`, { method: "DELETE" });
            retry();
          } catch (error) {
            setReleaseError((error as Error).message);
          }
        }}
      >
        Release reservation
      </button>
    </section>
  );
}
function Profile({
  me,
  signIn,
  setTheme,
}: {
  me: any;
  signIn: () => void;
  setTheme: (theme: string) => void;
}) {
  const { data, error, loading } = useLoad<any>("/profile");
  const [name, setName] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (data) setName(data.name);
  }, [data]);
  if (!me)
    return (
      <Empty title="Sign in to manage your account">
        <button onClick={signIn}>Sign in</button>
      </Empty>
    );
  return (
    <section className="reading">
      <h1>Your profile</h1>
      <p>{me.contact}</p>
      {error && <Notice message={error} />}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api("/profile", {
              method: "PUT",
              body: JSON.stringify({
                name,
                theme: document.documentElement.dataset.theme,
                city: data?.city ?? null,
              }),
            });
            setMessage("Profile saved.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <label htmlFor="name">Name</label>
        <input
          id="name"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="primary" disabled={loading}>
          Save profile
        </button>
      </form>
      {message && <Notice message={message} />}
      <CommunicationPreferences key={me.id} />
      <AccountSecurity />
      <SessionManagement />
      <button
        onClick={async () => {
          await api("/auth/logout", { method: "POST" });
          localStorage.removeItem("bmt-theme");
          setTheme("LIGHT");
          location.assign("/explore");
        }}
      >
        Sign out
      </button>
    </section>
  );
}
function Provider({ signIn }: { signIn: () => void }) {
  const { data, error, loading, retry } = useLoad<{ items: any[] }>(
    "/organizations",
  );
  const [name, setName] = useState(""),
    [kind, setKind] = useState("cinema"),
    [message, setMessage] = useState("");
  return (
    <section className="reading">
      <p className="eyebrow">PARTNER WITH BOOKMYTICKET</p>
      <h1>Your shows. Your audience.</h1>
      <p>
        Create your organization, then submit it for review. After approval,
        create and submit your movie, event or sports listing. An administrator
        must approve publication before customers can discover it.
      </p>
      <p>
        Add your actual venues, seating, pricing and showtimes to open booking.
        Publishing a listing alone does not create ticket availability.
      </p>
      <a href="/partner/venues">Manage listings, venues and showtimes</a>
      <ProviderStaff onChanged={retry} />
      {error ? (
        <>
          <Notice message={error} />
          <button onClick={signIn}>Sign in</button>
        </>
      ) : (
        <>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/organizations", {
                  method: "POST",
                  body: JSON.stringify({ name, kind }),
                });
                setName("");
                setMessage("Organization draft saved.");
                retry();
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            <label htmlFor="organization">Organization name</label>
            <input
              id="organization"
              minLength={2}
              maxLength={150}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label htmlFor="kind">Organization type</label>
            <select
              id="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="cinema">Cinema partner</option>
              <option value="event">Event organizer</option>
              <option value="sports">Sports organizer</option>
            </select>
            <button className="primary">Save onboarding draft</button>
          </form>
          {loading ? (
            <p>Loading organizations…</p>
          ) : (
            data?.items.map((o) => (
              <article className="organization" key={o.id}>
                <h2>{o.name}</h2>
                <p>
                  {o.kind} · {o.state} · {o.role}
                </p>
                {o.role === "owner" && (
                  <ProviderStaff key={o.id} org={o.id} onChanged={retry} />
                )}
                {o.state === "draft" && o.role === "owner" && (
                  <button
                    onClick={async () => {
                      try {
                        await api(`/organizations/${o.id}/submit`, {
                          method: "POST",
                          body: JSON.stringify({ version: o.version }),
                        });
                        retry();
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    Submit for review
                  </button>
                )}
              </article>
            ))
          )}
        </>
      )}
      {message && <Notice message={message} />}
    </section>
  );
}
function Occurrences({ listingId }: { listingId: string }) {
  const { data, error, loading, retry } = useLoad<{ items: any[] }>(
    `/catalog/${listingId}/occurrences`,
  );
  const [date, setDate] = useState(""),
    [venue, setVenue] = useState("");
  const localDate = (o: any) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: o.time_zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(o.starts_at));
  const dates = Array.from(new Set((data?.items ?? []).map(localDate))),
    venues = Array.from(new Set((data?.items ?? []).map((o) => o.venue_name)));
  const visible = (data?.items ?? []).filter(
    (o) =>
      (!date || localDate(o) === date) && (!venue || o.venue_name === venue),
  );
  return (
    <section
      id="sessions"
      className="showtime-section"
      aria-labelledby="sessions-heading"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">PLAN YOUR VISIT</p>
          <h2 id="sessions-heading">Select a date and venue</h2>
        </div>
        <p className="muted">All times are local to the venue</p>
      </div>
      {loading ? (
        <p role="status">Loading sessions…</p>
      ) : error ? (
        <>
          <Notice message={error} />
          <button onClick={retry}>Try again</button>
        </>
      ) : (
        <>
          <div className="showtime-toolbar">
            <div className="date-strip" aria-label="Show dates">
              <button aria-pressed={!date} onClick={() => setDate("")}>
                All
                <br />
                dates
              </button>
              {dates.map((d) => {
                const day = new Date(`${d}T12:00:00Z`);
                return (
                  <button
                    key={d}
                    aria-pressed={date === d}
                    onClick={() => setDate(d)}
                    aria-label={day.toLocaleDateString("en-IN", {
                      dateStyle: "full",
                      timeZone: "UTC",
                    })}
                  >
                    <small>
                      {day.toLocaleDateString("en-IN", {
                        weekday: "short",
                        timeZone: "UTC",
                      })}
                    </small>
                    <strong>{day.getUTCDate()}</strong>
                    <small>
                      {day.toLocaleDateString("en-IN", {
                        month: "short",
                        timeZone: "UTC",
                      })}
                    </small>
                  </button>
                );
              })}
            </div>
            <label className="venue-filter">
              Filter by venue
              <select value={venue} onChange={(e) => setVenue(e.target.value)}>
                <option value="">All venues</option>
                {venues.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          {!visible.length && (
            <div className="empty">
              <h3>No sessions for this selection</h3>
              <p>Try another date or venue.</p>
              <button
                onClick={() => {
                  setDate("");
                  setVenue("");
                }}
              >
                Show all sessions
              </button>
            </div>
          )}
          {Array.from(new Set(visible.map((o) => o.venue_name))).map((name) => (
            <article className="venue-showtimes" key={name}>
              <div className="venue-description">
                <h3>{name}</h3>
                <p className="muted">
                  Select a showtime to choose your tickets
                </p>
              </div>
              <div className="showtime-options">
                {visible
                  .filter((o) => o.venue_name === name)
                  .map((o) => {
                    const available =
                      o.state === "open" &&
                      o.sales_valid &&
                      o.available_units > 0;
                    return (
                      <div className="showtime-option" key={o.id}>
                        {available ? (
                          <a
                            className="showtime-button"
                            href={`/occurrence/${o.id}`}
                            aria-label={`${name}, ${new Date(o.starts_at).toLocaleString("en-IN", { timeZone: o.time_zone })}, ${o.available_units} available`}
                          >
                            <strong>
                              {new Date(o.starts_at).toLocaleTimeString(
                                "en-IN",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: o.time_zone,
                                },
                              )}
                            </strong>
                            <small>
                              {o.min_price_paise === 0
                                ? "Free"
                                : `From ${money(o.min_price_paise)}`}
                            </small>
                          </a>
                        ) : (
                          <span className="showtime-button closed">
                            <strong>
                              {new Date(o.starts_at).toLocaleTimeString(
                                "en-IN",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: o.time_zone,
                                },
                              )}
                            </strong>
                            <small>
                              {o.state !== "open"
                                ? o.state
                                : !o.sales_valid
                                  ? "Sales unavailable"
                                  : "Sold out"}
                            </small>
                          </span>
                        )}
                        <small>
                          {new Date(o.starts_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            timeZone: o.time_zone,
                          })}
                          {o.is_demo ? " · DEMO" : ""}
                        </small>
                      </div>
                    );
                  })}
              </div>
            </article>
          ))}
        </>
      )}
      <p className="muted">
        Availability is checked again when you reserve. Final fees and taxes are
        shown at checkout.
      </p>
    </section>
  );
}

function Bookings() {
  const { data, error, loading, retry } = useLoad<{ items: any[] }>(
    "/bookings",
  );
  return (
    <section className="reading">
      <p className="eyebrow">YOUR EXPERIENCES</p>
      <h1>My bookings</h1>
      {loading ? (
        <p>Loading bookings…</p>
      ) : error ? (
        <Notice message={error} />
      ) : !data?.items.length ? (
        <Empty title="No bookings yet">
          Your bookings will appear here after you begin checkout.
        </Empty>
      ) : (
        data.items.map((b) => (
          <article className="organization" key={b.id}>
            <h2>
              <a href={`/bookings/${b.id}`}>Booking {b.id.slice(0, 8)}</a>
            </h2>
            <p>
              {b.state} · {money(b.amount_paise)}
            </p>
            <p>{new Date(b.created_at).toLocaleString("en-IN")}</p>
            <p>Payment, ticket and refund states are tracked separately.</p>
          </article>
        ))
      )}
      <button onClick={retry}>Check latest status</button>
    </section>
  );
}
function Scanner() {
  const [occurrenceId, setOccurrence] = useState(""),
    [gate, setGate] = useState(""),
    [token, setToken] = useState(""),
    [outcome, setOutcome] = useState(""),
    [busy, setBusy] = useState(false);
  const key = React.useRef(crypto.randomUUID());
  return (
    <section className="reading">
      <p className="eyebrow">ADMISSION</p>
      <h1>Verify a ticket</h1>
      <p>
        Enter your assigned occurrence and gate. Every admission is verified
        online.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await api("/scanner/admissions", {
              method: "POST",
              headers: { "Idempotency-Key": key.current },
              body: JSON.stringify({ occurrenceId, gate, token }),
            });
            setOutcome(r.outcome);
          } catch (e) {
            setOutcome(`Unable to verify: ${(e as Error).message}`);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="occurrence">Assigned occurrence ID</label>
        <input
          id="occurrence"
          required
          value={occurrenceId}
          onChange={(e) => {
            setOccurrence(e.target.value);
            key.current = crypto.randomUUID();
          }}
        />
        <label htmlFor="gate">Assigned gate</label>
        <input
          id="gate"
          required
          value={gate}
          onChange={(e) => {
            setGate(e.target.value);
            key.current = crypto.randomUUID();
          }}
        />
        <label htmlFor="ticket-token">Ticket token — manual entry</label>
        <input
          id="ticket-token"
          autoComplete="off"
          required
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            key.current = crypto.randomUUID();
          }}
        />
        <button className="primary" disabled={busy}>
          {busy ? "Verifying…" : "Verify admission"}
        </button>
      </form>
      {outcome && <Notice message={outcome} />}
      <p className="muted">
        Staff MFA and a current occurrence/gate grant are required. Camera
        scanning and supervisor exceptions remain in implementation.
      </p>
    </section>
  );
}
function Cases() {
  const { data, error, loading, retry } = useLoad<{ items: any[] }>("/cases");
  const [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [category, setCategory] = useState("booking"),
    [message, setMessage] = useState("");
  return (
    <section className="reading">
      <h1>Your support cases</h1>
      <p>Do not include OTPs, card details, or payment secrets.</p>
      {error && <Notice message={error} />}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api("/cases", {
              method: "POST",
              body: JSON.stringify({ subject, category, body }),
            });
            setMessage("Your case has been recorded.");
            setSubject("");
            setBody("");
            retry();
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <label htmlFor="subject">Subject</label>
        <input
          id="subject"
          required
          minLength={5}
          maxLength={150}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <label htmlFor="category">Category</label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {["booking", "payment", "accessibility", "other"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label htmlFor="case-body">How can we help?</label>
        <textarea
          id="case-body"
          required
          minLength={10}
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="primary">Create case</button>
      </form>
      {message && <Notice message={message} />}{" "}
      {!loading &&
        data?.items.map((c) => (
          <article className="organization" key={c.id}>
            <h2>{c.subject}</h2>
            <p>
              {c.state} · {c.category}
            </p>
            <CaseMessages id={c.id} />
          </article>
        ))}
    </section>
  );
}
function CaseMessages({ id }: { id: string }) {
  const { data, error, retry } = useLoad<{ items: any[] }>(
    `/cases/${id}/messages`,
  );
  const [body, setBody] = useState(""),
    [message, setMessage] = useState("");
  return (
    <>
      {error && <Notice message={error} />}{" "}
      {data?.items.map((m) => (
        <p key={m.id}>{m.body}</p>
      ))}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api(`/cases/${id}/messages`, {
              method: "POST",
              body: JSON.stringify({ body }),
            });
            setBody("");
            retry();
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <label htmlFor={`reply-${id}`}>Reply to support</label>
        <input
          id={`reply-${id}`}
          required
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button>Send reply</button>
      </form>
      {message && <Notice message={message} />}
    </>
  );
}
function Admin() {
  const { data, error, loading, retry } = useLoad<any>("/admin/reviews");
  const [message, setMessage] = useState("");
  async function review(kind: string, item: any, state: string) {
    const reason = window.prompt("Record the reason for this review decision:");
    if (!reason) return;
    try {
      await api(`/admin/${kind}/${item.id}/review`, {
        method: "POST",
        body: JSON.stringify({ version: item.version, state, reason }),
      });
      setMessage("Review decision saved.");
      retry();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <section className="reading">
      <p className="eyebrow">PLATFORM ADMINISTRATION</p>
      <h1>Review queue</h1>
      <p>
        <a className="primary" href="/admin/pricing">
          Manage commercial policies
        </a>
      </p>
      {loading ? (
        <p>Loading review queue…</p>
      ) : error ? (
        <Notice message={error} />
      ) : (
        <>
          <h2>Provider applications</h2>
          {!data?.providers.length && <p>No submitted applications.</p>}
          {data?.providers.map((p: any) => (
            <article className="organization" key={p.id}>
              <h3>{p.name}</h3>
              <p>
                {p.kind} · version {p.version}
              </p>
              <button onClick={() => review("providers", p, "approved")}>
                Approve
              </button>
              <button
                onClick={() => review("providers", p, "changes_requested")}
              >
                Request changes
              </button>
            </article>
          ))}
          <h2>Listings</h2>
          {!data?.listings.length && <p>No listings awaiting review.</p>}
          {data?.listings.map((p: any) => (
            <article className="organization" key={p.id}>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <button onClick={() => review("listings", p, "published")}>
                Publish approved listing
              </button>
              <button
                onClick={() => review("listings", p, "changes_requested")}
              >
                Request changes
              </button>
            </article>
          ))}
        </>
      )}
      {message && <Notice message={message} />}
    </section>
  );
}
function Operations() {
  const [view, setView] = useState("cases");
  const { data, error, loading } = useLoad<{ items: any[] }>(
    view === "cases" ? "/me" : "/operations/ledger",
  );
  return (
    <section className="reading">
      <p className="eyebrow">SUPPORT & FINANCE</p>
      <h1>{view === "cases" ? "Support queue" : "Financial ledger"}</h1>
      <div className="chips">
        <button onClick={() => setView("cases")}>Support cases</button>
        <button onClick={() => setView("ledger")}>Ledger journals</button>
      </div>
      {view === "cases" ? (
        <SupportOperations />
      ) : loading ? (
        <p>Loading authorized records…</p>
      ) : error ? (
        <Notice message={error} />
      ) : !data?.items.length ? (
        <Empty title="No records">
          No records are available in this authorized view.
        </Empty>
      ) : (
        data.items.map((r: any) => (
          <article className="organization" key={r.id}>
            <h2>{view === "cases" ? r.subject : r.event_id}</h2>
            {view === "cases" ? (
              <p>
                {r.category} · {r.state}
              </p>
            ) : (
              <ul>
                {r.lines.map((l: any, i: number) => (
                  <li key={i}>
                    {l.account}: {money(Number(l.amountPaise))}
                  </li>
                ))}
              </ul>
            )}
            <p>{new Date(r.created_at).toLocaleString("en-IN")}</p>
          </article>
        ))
      )}
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
