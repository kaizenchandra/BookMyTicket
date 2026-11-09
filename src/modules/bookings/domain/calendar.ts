export type CalendarOccurrence = {
  id: string;
  venueName: string;
  venueAddress?: string | null;
  venueCity?: string | null;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  state: string;
  version: number;
};
export const calendarText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
function folded(line: string) {
  const encoder = new TextEncoder();
  let result = "",
    bytes = 0;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    if (bytes + n > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += ch;
    bytes += n;
  }
  return result;
}
const utc = (s: string) =>
  new Date(s)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
export function calendar(
  occurrences: CalendarOccurrence[],
  serverTime: string,
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BookMyTicket//Booking Calendar//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const o of occurrences)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${o.id}@bookmyticket`,
      `DTSTAMP:${utc(serverTime)}`,
      `DTSTART:${utc(o.startsAt)}`,
      `DTEND:${utc(o.endsAt)}`,
      `SEQUENCE:${o.version}`,
      `STATUS:${o.state === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      `SUMMARY:${calendarText("Booking at " + o.venueName)}`,
      `LOCATION:${calendarText([o.venueName, o.venueAddress, o.venueCity].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${calendarText("Venue time zone: " + o.timeZone + ". Check the app for current schedule and admission status. This calendar entry is not a ticket.")}`,
      "END:VEVENT",
    );
  lines.push("END:VCALENDAR");
  return lines.map(folded).join("\r\n") + "\r\n";
}
