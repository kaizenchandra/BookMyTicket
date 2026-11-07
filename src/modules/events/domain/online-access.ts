import { AppError } from "../../../shared/errors.ts";
export function validateOnlineAccess(input: {
  url?: string;
  opensAt: string;
  closesAt: string;
}) {
  const duration = Date.parse(input.closesAt) - Date.parse(input.opensAt);
  if (!(duration > 0 && duration <= 7 * 86400000))
    throw new AppError(
      "INVALID_ACCESS_WINDOW",
      "Choose an access window of up to seven days.",
      422,
    );
  if (input.url !== undefined) {
    let valid = false;
    try {
      const url = new URL(input.url);
      valid =
        input.url.length <= 2000 &&
        url.protocol === "https:" &&
        !url.username &&
        !url.password;
    } catch {}
    if (!valid)
      throw new AppError(
        "INVALID_JOIN_URL",
        "Use an HTTPS joining URL without embedded credentials.",
        422,
      );
  }
}
