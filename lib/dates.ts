/** A date-only value stored at midnight UTC (date applied, deadline). */
export function formatDay(value: Date | string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}
