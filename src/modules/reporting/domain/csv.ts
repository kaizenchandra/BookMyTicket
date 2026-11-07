// Quote every cell and neutralize formula/control prefixes, including leading whitespace.
export function csvCell(value: unknown): string {
  let text = String(value ?? "").replace(
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,
    "",
  );
  if (/^[\s]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",") + "\r\n";
}
