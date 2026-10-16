import { BlockList, isIP } from "node:net";

// C2 SSRF protection: addresses the link fetcher must never connect to.
// Private, loopback, link-local (including cloud metadata 169.254.169.254),
// carrier-grade NAT, documentation, multicast, reserved, and IPv6 equivalents.

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 23], ["2001:db8::", 32],
  ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** IPv4 address embedded in an IPv4-mapped or IPv4-compatible IPv6 address. */
function embeddedIpv4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const dotted = /^::(?:ffff:(?:0:)?)?(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);
  if (dotted?.[1]) return dotted[1];
  const hex = /^::(?:ffff:(?:0:)?)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex?.[1] && hex[2]) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return null;
}

/** True when the fetcher must refuse this IP address. Anything unparseable is refused. */
export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return blocked.check(ip, "ipv4");
  if (version === 6) {
    const v4 = embeddedIpv4(ip);
    if (v4) return isIP(v4) !== 4 || blocked.check(v4, "ipv4");
    return blocked.check(ip, "ipv6");
  }
  return true;
}
