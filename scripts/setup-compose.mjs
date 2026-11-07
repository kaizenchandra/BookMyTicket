import { mkdir, writeFile, chmod, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const directory = ".local/compose/secrets";
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(".local/compose", 0o700);
await chmod(directory, 0o700);
const secrets = {
  postgres_password: () => randomBytes(32).toString("hex"),
  otp_pepper: () => randomBytes(32).toString("hex"),
  mfa_key: () => randomBytes(32).toString("hex"),
  export_key: () => randomBytes(32).toString("hex"),
  registration_key: () => randomBytes(32).toString("hex"),
  ticket_key: () => randomBytes(32).toString("hex"),
  resend_key: () => "",
  razorpay_key_id: () => "",
  razorpay_key_secret: () => "",
  razorpay_webhook_secret: () => "",
  razorpay_previous_webhook_secret: () => "",
};
let created = 0;
for (const [name, value] of Object.entries(secrets)) {
  const path = `${directory}/${name}`;
  try {
    await access(path);
  } catch {
    await writeFile(path, value() + "\n", { flag: "wx", mode: 0o444 });
    created++;
  }
}
console.log(
  `Local Compose secret directory ready (${created} new files). Existing files preserved; no secret values printed. Provider credentials remain unconfigured unless supplied separately.`,
);
