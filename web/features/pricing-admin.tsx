import { useEffect, useState } from "react";
import { api } from "../api.ts";
import type { CommercialPolicy } from "../../src/modules/pricing/contracts/index.ts";
type ApprovedPolicy = {
  id: string;
  label: string;
  configuration: CommercialPolicy;
  created_at: string;
};
export function PricingAdmin() {
  const [policies, setPolicies] = useState<ApprovedPolicy[] | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const [occurrence, setOccurrence] = useState(""),
    [assignment, setAssignment] = useState<{
      version: number;
      policy_id: string;
    } | null>(null),
    [loadedOccurrence, setLoadedOccurrence] = useState(""),
    [policyId, setPolicyId] = useState("");
  useEffect(() => {
    let current = true;
    api<{ items: ApprovedPolicy[] }>("/admin/pricing/policies")
      .then((r) => {
        if (current) {
          setPolicies(r.items);
          setError("");
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [revision]);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      values = new FormData(form);
    setBusy(true);
    setNotice("");
    try {
      await api("/admin/pricing/policies", {
        method: "POST",
        body: JSON.stringify({
          label: values.get("label"),
          reason: values.get("reason"),
          configuration: {
            feePerOrderPaise: Number(values.get("orderFee")),
            feePerTicketPaise: Number(values.get("ticketFee")),
            feeBasisPoints: Number(values.get("feeBps")),
            ticketTax: {
              basisPoints: Number(values.get("ticketTaxBps")),
              mode: values.get("ticketTaxMode"),
            },
            feeTax: {
              basisPoints: Number(values.get("feeTaxBps")),
              mode: values.get("feeTaxMode"),
            },
            allowFreeBookings: values.get("allowFreeBookings") === "on",
            ...(values.get("freeCancellationCutoffMinutes") !== ""
              ? {
                  freeCancellationCutoffMinutes: Number(
                    values.get("freeCancellationCutoffMinutes"),
                  ),
                }
              : {}),
            cancellationTerms: values.get("cancellation"),
            admissionTerms: values.get("admission"),
          },
        }),
      });
      form.reset();
      setNotice(
        "Approved policy version saved. Assign it explicitly to an occurrence to apply it.",
      );
      setRevision((r) => r + 1);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="reading">
      <p className="eyebrow">PRICING ADMINISTRATION</p>
      <h1>Commercial policies</h1>
      <p>
        Configure only approved commercial terms. Amounts are in paise. Rates
        are basis points: 100 basis points = 1%. No tax or fee defaults are
        supplied.
      </p>
      {error ? (
        <div className="notice" role="alert">
          {error}
        </div>
      ) : !policies ? (
        <p role="status">Loading approved policies…</p>
      ) : (
        <>
          <form onSubmit={create}>
            <h2>Approve a policy version</h2>
            <p>
              Policy versions cannot be edited. Approval is audited. Changing
              terms requires a new version.
            </p>
            <label htmlFor="policy-label">Policy name</label>
            <input
              id="policy-label"
              name="label"
              required
              minLength={2}
              maxLength={150}
            />
            {[
              ["orderFee", "Fixed fee per order (paise)"],
              ["ticketFee", "Fixed fee per admission (paise)"],
              ["feeBps", "Additional fee rate (basis points)"],
              ["ticketTaxBps", "Ticket tax rate (basis points)"],
              ["feeTaxBps", "Fee tax rate (basis points)"],
            ].map(([name, label]) => (
              <div key={name}>
                <label htmlFor={name}>{label}</label>
                <input
                  id={name}
                  name={name}
                  type="number"
                  min={0}
                  max={name.endsWith("Bps") ? 10000 : 1_000_000_000}
                  step={1}
                  required
                  inputMode="numeric"
                />
              </div>
            ))}
            {[
              ["ticketTaxMode", "Ticket tax treatment"],
              ["feeTaxMode", "Fee tax treatment"],
            ].map(([name, label]) => (
              <div key={name}>
                <label htmlFor={name}>{label}</label>
                <select id={name} name={name} required defaultValue="">
                  <option value="" disabled>
                    Select tax treatment
                  </option>
                  <option value="inclusive">
                    Included in configured price
                  </option>
                  <option value="exclusive">Added to configured price</option>
                </select>
              </div>
            ))}
            <label>
              <input type="checkbox" name="allowFreeBookings" /> Authorize free
              bookings when the complete order total, including fees and taxes,
              is zero
            </label>
            <label>
              Free cancellation cutoff (minutes before start; leave blank to
              prohibit)
              <input
                name="freeCancellationCutoffMinutes"
                type="number"
                min={0}
                max={525600}
              />
            </label>
            <label htmlFor="cancellation">
              Cancellation terms displayed to customers
            </label>
            <textarea
              id="cancellation"
              name="cancellation"
              required
              minLength={10}
              maxLength={10000}
            />
            <label htmlFor="admission">
              Admission terms displayed to customers
            </label>
            <textarea
              id="admission"
              name="admission"
              required
              minLength={10}
              maxLength={10000}
            />
            <label htmlFor="policy-reason">Approval reason</label>
            <textarea
              id="policy-reason"
              name="reason"
              required
              minLength={5}
              maxLength={2000}
            />
            <label className="policy-acceptance">
              <input type="checkbox" required />
              <span>
                I am authorized to approve these exact commercial terms.
              </span>
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Approve immutable policy version"}
            </button>
          </form>
          <hr />
          <h2>Assign a policy to an occurrence</h2>
          <p>
            Changing an assignment invalidates unaccepted quotes. Previously
            accepted orders keep their original terms.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setNotice("");
              try {
                const result = await api<{
                  assignment: { version: number; policy_id: string } | null;
                }>(`/admin/pricing/occurrences/${occurrence}`);
                setAssignment(result.assignment);
                setLoadedOccurrence(occurrence);
                setPolicyId(result.assignment?.policy_id ?? "");
              } catch (e) {
                setNotice((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="pricing-occurrence">Occurrence ID</label>
            <input
              id="pricing-occurrence"
              required
              value={occurrence}
              onChange={(e) => {
                setOccurrence(e.target.value);
                setLoadedOccurrence("");
                setAssignment(null);
              }}
            />
            <button disabled={busy}>Retrieve current assignment</button>
          </form>
          {loadedOccurrence && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setNotice("");
                try {
                  const result = await api<{
                    version: number;
                    policy_id: string;
                  }>(`/admin/pricing/occurrences/${loadedOccurrence}`, {
                    method: "PUT",
                    body: JSON.stringify({
                      policyId,
                      expectedVersion: assignment?.version ?? 0,
                    }),
                  });
                  setAssignment(result);
                  setNotice("Occurrence policy assignment saved.");
                } catch (e) {
                  setNotice((e as Error).message);
                  setLoadedOccurrence("");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                Current assignment version: {assignment?.version ?? 0}{" "}
                {assignment ? "" : "(no policy assigned)"}
              </p>
              <label htmlFor="approved-policy">Approved policy version</label>
              <select
                id="approved-policy"
                required
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
              >
                <option value="" disabled>
                  Select an approved policy
                </option>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} · {p.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <button className="primary" disabled={busy}>
                Apply policy to this occurrence
              </button>
            </form>
          )}
          <h2>Approved versions</h2>
          {!policies.length ? (
            <p>No commercial policies have been approved.</p>
          ) : (
            policies.map((p) => (
              <details className="organization" key={p.id}>
                <summary>
                  {p.label} · {p.id.slice(0, 8)}
                </summary>
                <p>Approved {new Date(p.created_at).toLocaleString("en-IN")}</p>
                <p>
                  Fixed fees: {p.configuration.feePerOrderPaise} paise/order +{" "}
                  {p.configuration.feePerTicketPaise} paise/admission.
                  Additional fee: {p.configuration.feeBasisPoints} basis points.
                </p>
                <p>
                  Ticket tax: {p.configuration.ticketTax.basisPoints} basis
                  points, {p.configuration.ticketTax.mode}. Fee tax:{" "}
                  {p.configuration.feeTax.basisPoints} basis points,{" "}
                  {p.configuration.feeTax.mode}.
                </p>
                <p>
                  Free bookings:{" "}
                  {p.configuration.allowFreeBookings
                    ? "Authorized for zero-total orders"
                    : "Not authorized"}
                </p>
                <p>
                  Free cancellation:{" "}
                  {p.configuration.freeCancellationCutoffMinutes === undefined
                    ? "Not permitted"
                    : `Until ${p.configuration.freeCancellationCutoffMinutes} minutes before start; unused tickets only`}
                </p>
                <h3>Cancellation</h3>
                <p>{p.configuration.cancellationTerms}</p>
                <h3>Admission</h3>
                <p>{p.configuration.admissionTerms}</p>
              </details>
            ))
          )}
        </>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <p>
        <a href="/admin">Back to administration</a>
      </p>
    </section>
  );
}
