import { AppError } from "../../../shared/errors.ts";
export type VenueImage = {
  url: string;
  kind: "photo" | "map";
  alt: string;
  caption: string;
  attribution: string;
};
export function validateMedia(items: VenueImage[]) {
  if (items.length > 8)
    throw new AppError("INVALID_MEDIA", "Use at most eight images.", 422);
  const seen = new Set<string>();
  for (const item of items) {
    let url: URL;
    try {
      url = new URL(item.url);
    } catch {
      throw new AppError(
        "INVALID_MEDIA",
        "Use an absolute HTTPS image URL.",
        422,
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      /[\s\\]/.test(item.url)
    )
      throw new AppError(
        "INVALID_MEDIA",
        "Use an HTTPS image URL without credentials, fragments or whitespace.",
        422,
      );
    if (!item.alt.trim())
      throw new AppError(
        "INVALID_MEDIA",
        "Describe each image with alternative text.",
        422,
      );
    if (seen.has(url.href))
      throw new AppError(
        "INVALID_MEDIA",
        "Each image URL must be unique.",
        422,
      );
    seen.add(url.href);
  }
}
