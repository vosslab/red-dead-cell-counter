export function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): void {
  function quote(value: string): string {
    // ASVS 1.2.10: prefix formula-like values before spreadsheet export.
    const safe = /^[\t\r\n\0]|^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  }
  const lines = [headers.join(","), ...rows.map((fields) => fields.map(quote).join(","))];
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
