export type ProviderQueueCursor = { afterCreatedAt: string; afterId: string };
export function providerQueueSearch(search: string) {
  const incoming = new URLSearchParams(search),
    params = new URLSearchParams();
  for (const name of ["kind", "afterCreatedAt", "afterId"])
    if (incoming.has(name)) params.set(name, incoming.get(name)!);
  return params;
}
export function ProviderQueueNavigation({
  kind,
  paged,
  next,
}: {
  kind: string;
  paged: boolean;
  next: ProviderQueueCursor | null;
}) {
  const first = new URLSearchParams();
  if (kind) first.set("kind", kind);
  const later = new URLSearchParams(first);
  if (next) {
    later.set("afterCreatedAt", next.afterCreatedAt);
    later.set("afterId", next.afterId);
  }
  return (
    <nav aria-label="Provider application pages">
      {paged && <a href={`/admin?${first}`}>First applications</a>}
      {next && <a href={`/admin?${later}`}>Next applications</a>}
    </nav>
  );
}
