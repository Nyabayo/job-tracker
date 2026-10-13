# Privacy and data protection

This describes what a Job Tracker installation stores. If you run a copy for other people, you are the data controller under the Kenya Data Protection Act 2019 (and GDPR, if it applies to you). The in-app page at `/privacy` says the same thing in plain language for your users.

## Data stored

| Data | Purpose | Kept for |
| --- | --- | --- |
| Email, optional name | Login and the emails the user asks for | Until the account is deleted |
| Argon2id password hash | Authentication | Until the account is deleted |
| Jobs, notes, contacts, tasks, tags | The tracker itself | Until the user deletes them or the account |
| Uploaded files | The user's documents | Until the user deletes them or the account |
| Sessions | Keeping the user logged in | 7 days, or until logout |
| Hashed email and reset tokens | Verification and password reset | 24 hours and 30 minutes |
| Audit log (event, time, truncated IP, browser) | Detecting attacks on the account | Kept after deletion with the user link removed |
| Rate-limit counters (keyed by truncated IP or email) | Stopping brute force | Minutes to an hour |

IP addresses are shortened before they're saved (the last part of an IPv4 address, or all but the first 48 bits of IPv6, is zeroed).

## What is not collected

No analytics, no ads, no third-party scripts, fonts or trackers (fonts are served by the app itself), and nothing is sent to outside services apart from email through the SMTP server you configure.

## Cookies

| Cookie | Purpose |
| --- | --- |
| `authjs.session-token` (`__Secure-` over HTTPS) | Session. HttpOnly, SameSite=Lax. |
| `jt-csrf` (`__Host-jt-csrf` over HTTPS) | Random anti-forgery token for forms. HttpOnly, SameSite=Lax. |

Both are strictly necessary, so no consent banner is needed.

## User rights

- **Access and portability:** full export as JSON, CSV and a ZIP of files (Sprint 4, story A8).
- **Erasure:** Settings → Delete account. Access ends immediately and all data and files are purged by a background job, at the latest within 24 hours.
- **Rectification:** users can edit everything they've entered.
