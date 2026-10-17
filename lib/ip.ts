import { isIP } from "node:net";

/**
 * Truncates an IP address before it is stored (privacy, section 7):
 * IPv4 keeps the first three octets (/24), IPv6 the first three hextets (/48).
 * Returns null for anything that is not a valid IP.
 */
export function truncateIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const ip = raw.trim();
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  if (version === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped?.[1]) return truncateIp(mapped[1]);
    const [head = ""] = ip.split("::");
    const groups = head.split(":").filter(Boolean);
    const expanded = ip.includes("::")
      ? [...groups, "0", "0", "0"].slice(0, 3)
      : ip.split(":").slice(0, 3);
    return `${expanded.join(":")}::`;
  }
  return null;
}

/**
 * The client IP from X-Forwarded-For. Takes the LAST entry: that is the one
 * the trusted reverse proxy appended. Earlier entries come from the client and
 * can be forged to dodge rate limits.
 */
export function forwardedClientIp(header: string | null | undefined): string | null {
  const last = header?.split(",").at(-1)?.trim();
  return last && isIP(last) ? last : null;
}
