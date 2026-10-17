import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { forwardedClientIp, truncateIp } from "@/lib/ip";

export type ClientInfo = { ip: string | null; rawIp: string | null; userAgent: string | null };

/** The caller's IP (only when TRUST_PROXY is on) and user agent. */
export async function clientInfo(): Promise<ClientInfo> {
  const h = await headers();
  const forwarded = env().TRUST_PROXY ? forwardedClientIp(h.get("x-forwarded-for")) : null;
  return {
    rawIp: forwarded,
    ip: truncateIp(forwarded),
    userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
  };
}
