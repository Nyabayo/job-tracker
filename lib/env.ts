import "server-only";
import { z } from "zod";

// All configuration comes from environment variables (rule 3). Parsed lazily
// so `next build` does not need production secrets.

// The placeholder in .env.example. Copying that file without running
// scripts/selfhost.sh must not start an app with guessable secrets.
const PLACEHOLDER = "change-me";
const secret = () => z.string().min(1).refine((v) => !v.includes(PLACEHOLDER), "still set to the change-me placeholder");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),
  DATABASE_URL: secret(),
  DATABASE_URL_AUTH: secret(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().min(3),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: secret(),
  S3_SECRET_KEY: secret(),
  S3_FORCE_PATH_STYLE: z.stringbool().default(true),
  CLAMAV_HOST: z.string().default("clamav"),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(100).default(10),
  TOTP_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "TOTP_ENCRYPTION_KEY must be 64 hex characters"),
  // A2: optional sign-in with Google and GitHub. A provider shows on the
  // login page only when both its id and secret are set.
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  RUN_JOBS: z.stringbool().default(true),
  // Only trust X-Forwarded-For when a reverse proxy you control sets it.
  TRUST_PROXY: z.stringbool().default(false),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}

export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

export function isSecureUrl(): boolean {
  return env().APP_URL.startsWith("https://");
}

export type OAuthProvider = "google" | "github";

/** The Google and GitHub sign-in options this instance has keys for. */
export function oauthProviders(): OAuthProvider[] {
  const e = env();
  const list: OAuthProvider[] = [];
  if (e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET) list.push("google");
  if (e.AUTH_GITHUB_ID && e.AUTH_GITHUB_SECRET) list.push("github");
  return list;
}
