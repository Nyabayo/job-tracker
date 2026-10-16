import "server-only";
import { Pool } from "pg";
import { RateLimiterPostgres, RateLimiterRes } from "rate-limiter-flexible";
import { env } from "@/lib/env";
import { lockoutSeconds } from "@/lib/auth/lockout";

// Rate limits and lockouts are stored in Postgres (rate_limits table, created
// by rls.sql), so they hold across restarts and multiple app containers.

const globalForLimits = globalThis as unknown as { jobTrackerLimits?: Limiters };

type Limiters = ReturnType<typeof createLimiters>;

function limiter(pool: Pool, keyPrefix: string, points: number, durationSeconds: number): RateLimiterPostgres {
  return new RateLimiterPostgres({
    storeClient: pool,
    tableName: "rate_limits",
    tableCreated: true,
    keyPrefix,
    points,
    duration: durationSeconds,
  });
}

function createLimiters() {
  const pool = new Pool({ connectionString: env().DATABASE_URL_AUTH, max: 3 });
  return {
    loginPerIp: limiter(pool, "login_ip", 50, 15 * 60),
    loginFailures: limiter(pool, "login_fail", 1000, 24 * 60 * 60),
    loginLock: limiter(pool, "login_lock", 1, 60 * 60),
    signupPerIp: limiter(pool, "signup_ip", 10, 60 * 60),
    // Used instead of the per-IP limits above when the client IP is unknown
    // (TRUST_PROXY off): one bucket for the whole instance, so sign-up and
    // reset emails stay capped instead of becoming unlimited.
    signupAnyIp: limiter(pool, "signup_any_ip", 100, 60 * 60),
    resetAnyIp: limiter(pool, "reset_any_ip", 100, 60 * 60),
    resetPerEmail: limiter(pool, "reset_email", 3, 60 * 60),
    resetPerIp: limiter(pool, "reset_ip", 10, 60 * 60),
    verifyPerEmail: limiter(pool, "verify_email", 3, 60 * 60),
    deletePerUser: limiter(pool, "delete_user", 5, 15 * 60),
    importPerUser: limiter(pool, "import_user", 30, 10 * 60),
    uploadPerUser: limiter(pool, "upload_user", 60, 60 * 60),
    exportPerUser: limiter(pool, "export_user", 10, 60 * 60),
  };
}

function limits(): Limiters {
  globalForLimits.jobTrackerLimits ??= createLimiters();
  return globalForLimits.jobTrackerLimits;
}

/** Limits keyed by something every request has: an email or a user id. */
export type LimitName = "verifyPerEmail" | "resetPerEmail" | "deletePerUser" | "importPerUser" | "uploadPerUser" | "exportPerUser";
/** Limits keyed by the client IP, which is only known when TRUST_PROXY is on. */
export type IpLimitName = "loginPerIp" | "signupPerIp" | "resetPerIp";

// Login has no instance-wide fallback on purpose: one shared bucket would let
// anyone lock every user out. Per-email lockout still applies.
const ANY_IP_FALLBACK = {
  loginPerIp: null,
  signupPerIp: "signupAnyIp",
  resetPerIp: "resetAnyIp",
} as const satisfies Record<IpLimitName, keyof Limiters | null>;

async function consume(name: keyof Limiters, key: string): Promise<boolean> {
  try {
    // eslint-disable-next-line security/detect-object-injection -- `name` is a typed union key
    await limits()[name].consume(key);
    return true;
  } catch (err) {
    if (err instanceof RateLimiterRes) return false;
    throw err;
  }
}

/** Consumes one point. Returns false when the caller is over the limit. */
export async function takeToken(name: LimitName, key: string): Promise<boolean> {
  return consume(name, key);
}

/**
 * Per-IP limit. Without a trusted client IP it falls back to the
 * instance-wide bucket rather than letting every request through.
 */
export async function takeIpToken(name: IpLimitName, ip: string | null): Promise<boolean> {
  if (ip) return consume(name, ip);
  // eslint-disable-next-line security/detect-object-injection -- `name` is a typed union key
  const fallback = ANY_IP_FALLBACK[name];
  return fallback ? consume(fallback, "all") : true;
}

/** Seconds left on a login lock for this email, or 0. */
export async function loginLockRemaining(email: string): Promise<number> {
  const res = await limits().loginLock.get(email);
  if (!res || res.consumedPoints <= 1) return 0;
  return Math.ceil(res.msBeforeNext / 1000);
}

/** Records a failed login and applies the progressive lock. Returns lock seconds. */
export async function recordLoginFailure(email: string): Promise<number> {
  const res = await limits().loginFailures.penalty(email, 1);
  const seconds = lockoutSeconds(res.consumedPoints);
  if (seconds > 0) await limits().loginLock.block(email, seconds);
  return seconds;
}

export async function clearLoginFailures(email: string): Promise<void> {
  await Promise.all([limits().loginFailures.delete(email), limits().loginLock.delete(email)]);
}
