export function venueDirections(
  venueName: string,
  address: string | null,
  city: string | null,
): string | null {
  if (!address?.trim()) return null;
  const destination = [venueName, address, city].filter(Boolean).join(", ");
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  return url.length <= 2048 ? url : null;
}
