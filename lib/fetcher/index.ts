import "server-only";
import http from "node:http";
import https from "node:https";
import { lookup as dnsLookup } from "node:dns/promises";
import type { LookupFunction } from "node:net";
import { isIP } from "node:net";
import { isBlockedIp } from "@/lib/fetcher/ip";

// C2: the only code in the app allowed to fetch a URL a user typed (A10 SSRF).
// - http/https only, ports 80 and 443 only, no user:password@ in the URL
// - DNS is resolved by us and EVERY address is checked; the socket then
//   connects to the checked address, so DNS rebinding can't swap it
// - redirects are followed by hand (max 3) and each hop is checked again
// - 5 second overall timeout, 2 MB response limit, no cookies, no auth

export const FETCH_LIMITS = { maxRedirects: 3, timeoutMs: 5000, maxBytes: 2 * 1024 * 1024 } as const;

export class FetchBlockedError extends Error {}

export type Fetched = { url: string; status: number; contentType: string; body: string };

export function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchBlockedError("That isn't a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchBlockedError("Only http and https links can be imported.");
  if (url.username || url.password) throw new FetchBlockedError("Links with a username or password can't be imported.");
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (port !== "80" && port !== "443") throw new FetchBlockedError("Only links on the standard web ports can be imported.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isBlockedIp(host)) throw new FetchBlockedError("That address is private and can't be imported.");
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa)$/i.test(host)) throw new FetchBlockedError("That address is private and can't be imported.");
  return url;
}

/** Resolves a host and refuses if ANY of its addresses is blocked. */
export async function resolveSafe(host: string): Promise<{ address: string; family: 4 | 6 }> {
  const bare = host.replace(/^\[|\]$/g, "");
  const version = isIP(bare);
  if (version) {
    if (isBlockedIp(bare)) throw new FetchBlockedError("That address is private and can't be imported.");
    return { address: bare, family: version as 4 | 6 };
  }
  let records: { address: string; family: number }[];
  try {
    records = await dnsLookup(bare, { all: true, verbatim: true });
  } catch {
    throw new FetchBlockedError("We couldn't find that website.");
  }
  if (records.length === 0) throw new FetchBlockedError("We couldn't find that website.");
  if (records.some((r) => isBlockedIp(r.address))) throw new FetchBlockedError("That address is private and can't be imported.");
  const first = records[0] as { address: string; family: number };
  return { address: first.address, family: first.family === 6 ? 6 : 4 };
}

function request(url: URL, signal: AbortSignal): Promise<{ status: number; location: string | null; contentType: string; body: string }> {
  return new Promise((resolve, reject) => {
    // The connection uses only the address we checked.
    const lookup: LookupFunction = (hostname, options, callback) => {
      resolveSafe(hostname).then(
        ({ address, family }) => {
          if ((options as { all?: boolean }).all) (callback as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [{ address, family }]);
          else callback(null, address, family);
        },
        (err: unknown) => callback(err as NodeJS.ErrnoException, "", 4),
      );
    };
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup,
        signal,
        agent: false,
        headers: {
          "User-Agent": "JobTrackerBot/1.0 (+self-hosted job tracker; imports one page a user pasted)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "Accept-Language": "en",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        const contentType = String(res.headers["content-type"] ?? "");
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, location, contentType, body: "" });
          return;
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > FETCH_LIMITS.maxBytes) {
          res.destroy();
          reject(new FetchBlockedError("That page is too large to import."));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > FETCH_LIMITS.maxBytes) {
            res.destroy();
            reject(new FetchBlockedError("That page is too large to import."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, location: null, contentType, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/** Fetches a page a user pasted, safely. Throws FetchBlockedError with a user-facing message. */
export async function safeFetch(raw: string): Promise<Fetched> {
  const signal = AbortSignal.timeout(FETCH_LIMITS.timeoutMs);
  let url = checkUrl(raw);
  for (let hop = 0; hop <= FETCH_LIMITS.maxRedirects; hop++) {
    let res;
    try {
      res = await request(url, signal);
    } catch (err) {
      if (err instanceof FetchBlockedError) throw err;
      if (signal.aborted) throw new FetchBlockedError("That website took too long to answer.");
      throw new FetchBlockedError("We couldn't reach that website.");
    }
    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new FetchBlockedError("That website sent us somewhere we couldn't follow.");
      url = checkUrl(new URL(res.location, url).toString());
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new FetchBlockedError(`That website answered with an error (${res.status}).`);
    return { url: url.toString(), status: res.status, contentType: res.contentType, body: res.body };
  }
  throw new FetchBlockedError("That link redirects too many times.");
}
