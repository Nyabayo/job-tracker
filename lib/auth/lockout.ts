/** Failed logins allowed before the account starts locking. */
export const FREE_FAILURES = 5;
/** Longest lock, so an attacker can't lock someone out for days. */
export const MAX_LOCK_SECONDS = 60 * 60;

/**
 * Progressive lockout (A1): after 5 failures the account locks for 1 minute,
 * then 2, 4, 8 ... up to 1 hour, doubling with each further failure.
 */
export function lockoutSeconds(failures: number): number {
  if (!Number.isFinite(failures) || failures < FREE_FAILURES) return 0;
  const exponent = Math.min(failures - FREE_FAILURES, 20);
  return Math.min(60 * 2 ** exponent, MAX_LOCK_SECONDS);
}
