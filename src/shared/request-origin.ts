const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
function parseOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return url;
  } catch {
    return null;
  }
}
// Never derive trust from Host or forwarded headers supplied by a request.
export function isAllowedOrigin(
  origin: string,
  configured: string,
  environment?: string,
): boolean {
  const actual = parseOrigin(origin),
    expected = parseOrigin(configured);
  if (!actual || !expected) return false;
  if (actual.origin === expected.origin) return true;
  return (
    (environment === undefined || environment === "development") &&
    loopback.has(actual.hostname) &&
    loopback.has(expected.hostname) &&
    actual.protocol === expected.protocol &&
    actual.port === expected.port
  );
}
