/** Quote CSV fields and neutralize spreadsheet formula interpretation of untrusted names. */
export function csvCell(value: unknown): string {
  let text = String(value ?? "")
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text
  return `"${text.replaceAll('"', '""')}"`
}
