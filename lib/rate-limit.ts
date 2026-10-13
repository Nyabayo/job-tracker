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
    resetPerEmail: limiter(pool, "reset_email", 3, 60 * 60),
    resetPerIp: limiter(pool, "reset_ip", 10, 60 * 60),
    verifyPerEmail: limiter(pool, "verify_email", 3, 60 * 60),
    deletePerUser: limiter(pool, "delete_user", 5, 15 * 60),
  };
}

function limits(): Limiters {
  globalForLimits.jobTrackerLimits ??= createLimiters();
  return globalForLimits.jobTrackerLimits;
}

export type LimitName = Exclude<keyof Limiters, "loginFailures" | "loginLock">;

/** Consumes one point. Returns false when the caller is over the limit. */
export async function takeToken(name: LimitName, key: string | null): Promise<boolean> {
  if (!key) return true;
  try {
    // eslint-disable-next-line security/detect-object-injection -- `name` is a typed union key
    await limits()[name].consume(key);
    return true;
  } catch (err) {
    if (err instanceof RateLimiterRes) return false;
    throw err;
  }
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
