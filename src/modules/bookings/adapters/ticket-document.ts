import type { WalletView } from "../contracts/wallet.ts";
export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function ticketDocument(wallet: WalletView) {
  const e = escapeHtml;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>BookMyTicket tickets</title><style>body{font:16px system-ui;max-width:760px;margin:32px auto;padding:16px;color:#161616;background:#fff}article{border:1px solid #777;padding:20px;margin:20px 0;break-inside:avoid}img{display:block;width:256px;height:256px;max-width:100%}h1,h2{line-height:1.2}p{overflow-wrap:anywhere}@media print{body{margin:0;padding:0}article{page-break-inside:avoid}}</style></head><body><h1>BookMyTicket</h1><p>Booking reference: ${e(wallet.orderId)}</p><p>Saved ticket display · synchronized ${e(wallet.serverTime)}. Current validity requires server verification at admission. Protect this file; it contains admission credentials. Use your browser's Print command to print.</p>${wallet.issuance === "pending" ? "<p>Some tickets are still being issued. This file may be incomplete.</p>" : ""}<p>${e(wallet.instructions)}</p>${wallet.items
    .map((t) => {
      const o = wallet.occurrences.find((o) => o.id === t.occurrenceId);
      return `<article><h2>${e(o?.venueName ?? "Venue unavailable")}</h2><p>${o ? e(new Date(o.startsAt).toLocaleString("en-IN", { timeZone: o.timeZone })) + " · " + e(o.timeZone) : ""}</p>${o?.venueAddress ? `<p>Scheduled venue address: ${e(o.venueAddress)}${o.venueCity ? ", " + e(o.venueCity) : ""}</p>${o.directionsUrl ? `<p><a href="${e(o.directionsUrl)}" target="_blank" rel="noopener noreferrer">Directions on Google Maps (external service)</a></p>` : ""}<p>Use the address above if maps or location access is unavailable. Check current booking notices before travelling.</p>` : "<p>No street address was supplied for this occurrence. Check the organizer’s instructions before travelling.</p>"}<p>Ticket: ${e(t.id)}</p><p>Seat/category: ${e(t.label)} · Admission ${t.ordinal + 1} · Gate: ${e(t.gate || "Not specified")}</p><p>Status at synchronization: ${e(t.status)}</p>${t.qrSvg ? `<img alt="Admission QR code for ticket ${e(t.id)}" src="data:image/svg+xml;base64,${Buffer.from(t.qrSvg).toString("base64")}">` : "<p>No active admission QR code.</p>"}</article>`;
    })
    .join("")}</body></html>`;
}
