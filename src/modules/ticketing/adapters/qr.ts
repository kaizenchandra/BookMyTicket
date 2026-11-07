import QRCode from "qrcode";
import type { TicketCodeRenderer } from "../contracts/index.ts";
export class QrCodes implements TicketCodeRenderer {
  svg(token: string) {
    return QRCode.toString(token, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 4,
      width: 256,
      color: { dark: "#000000", light: "#ffffff" },
    });
  }
}
