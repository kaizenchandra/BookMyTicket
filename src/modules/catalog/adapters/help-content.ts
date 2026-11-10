import { searchHelp, type HelpSearch } from "../domain/help.ts";
import type { HelpContent } from "../application/help.ts";
import type { HelpArticle } from "../domain/help.ts";
// Bootstrap fixture for migration 068/tests. Runtime answers are read from PostgreSQL.
const articles: readonly HelpArticle[] = [
  {
    id: "reservation-expiry",
    version: 1,
    topic: "booking",
    question: "Does refreshing extend my seat reservation?",
    answer:
      "Seats are held only after the server confirms a reservation. The countdown uses server time. Refreshing does not extend the hold. If it expires, check availability and select seats again; availability is not guaranteed.",
    href: "/explore",
    action: "Browse available listings",
  },
  {
    id: "find-booking",
    version: 1,
    topic: "booking",
    question: "Where can I find my booking and ticket?",
    answer:
      "Sign in to the account used for the booking and open My bookings. Search by booking reference or title, or filter by status and dates. Open the booking for its current status and available ticket actions.",
    href: "/bookings",
    action: "Open My bookings",
  },
  {
    id: "cancel-booking",
    version: 1,
    topic: "booking",
    question: "Can I cancel a booking?",
    answer:
      "Open the booking to check its available actions and accepted policy. Cancellation depends on eligibility and cutoff times. Review any cancellation preview before confirming. A cancelled booking and a completed refund are separate states; contact support if recovery is required.",
    href: "/bookings",
    action: "Check booking actions",
  },
  {
    id: "payment-pending",
    version: 1,
    topic: "payment",
    question: "My payment is pending. Should I pay again?",
    answer:
      "A payment callback is not a booking confirmation. Open your booking and retrieve its payment status before making another payment. Follow the actions shown for that booking. If payment or refund recovery is required, contact support with your booking reference. Do not share card details, OTPs or payment secrets.",
    href: "/bookings",
    action: "Check booking and payment status",
  },
  {
    id: "communication-preferences",
    version: 1,
    topic: "account",
    question: "How do I change communication preferences?",
    answer:
      "Sign in and open your account to manage your preferred language and optional marketing email consent. Transactional booking, payment and account security messages remain required. The interface currently uses English. Saving marketing consent does not subscribe you to an external campaign service.",
    href: "/profile",
    action: "Open account preferences",
  },
  {
    id: "accessible-booking",
    version: 1,
    topic: "accessibility",
    question: "Can I use a keyboard or change the theme?",
    answer:
      "Use keyboard navigation and the seat list to select places. Light and Dark themes are available from the header. Contact support if you encounter an accessibility barrier; do not include OTPs or payment secrets in your message.",
    href: "/cases",
    action: "Contact support",
  },
];
export class PublishedHelpContent implements HelpContent {
  published(filters: HelpSearch = { terms: [] }) {
    return searchHelp(articles, filters.terms.join(" "), filters.topic)
      .filter((article) => !filters.after || article.id > filters.after)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, 21);
  }
}
