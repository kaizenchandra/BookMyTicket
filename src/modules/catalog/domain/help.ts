export const helpTopics = [
  "booking",
  "payment",
  "account",
  "accessibility",
] as const;
export type HelpTopic = (typeof helpTopics)[number];
export type HelpArticle = {
  id: string;
  version: number;
  topic: HelpTopic;
  question: string;
  answer: string;
  href: string;
  action: string;
};
export type HelpSearch = {
  terms: readonly string[];
  topic?: HelpTopic;
  after?: string;
};
export function helpSearchTerms(q = "") {
  return q.trim().toLowerCase().split(/\s+/).filter(Boolean);
}
export function searchHelp(
  articles: readonly HelpArticle[],
  q = "",
  topic?: HelpTopic,
) {
  const terms = helpSearchTerms(q);
  return articles.filter((article) => {
    const text = `${article.question} ${article.answer}`.toLowerCase();
    return (
      (!topic || article.topic === topic) &&
      terms.every((term) => text.includes(term))
    );
  });
}

export const helpDestinations = {
  bookings: { href: "/bookings", action: "Open My bookings" },
  discovery: { href: "/explore", action: "Browse listings" },
  account: { href: "/profile", action: "Open account preferences" },
  support: { href: "/cases", action: "Contact support" },
} as const;
