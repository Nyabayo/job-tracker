/** Sessions last 7 days and are extended at most once a day while in use. */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;

/** Auth.js's cookie name for database sessions; `__Secure-` over HTTPS. */
export function sessionCookieName(secure: boolean): string {
  return `${secure ? "__Secure-" : ""}authjs.session-token`;
}
