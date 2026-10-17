import { inject, vi } from "vitest";

// Point the app's database clients at the test container and give every other
// required setting a harmless value, before any app module is imported.
const urls = inject("dbUrls");
Object.assign(process.env, {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: urls.app,
  DATABASE_URL_AUTH: urls.auth,
  AUTH_SECRET: "x".repeat(40),
  SMTP_HOST: "localhost",
  EMAIL_FROM: "test@example.test",
  S3_ENDPOINT: "http://localhost:9",
  S3_BUCKET: "test-bucket",
  S3_ACCESS_KEY: "test",
  S3_SECRET_KEY: "test",
  TOTP_ENCRYPTION_KEY: "0".repeat(64),
  RUN_JOBS: "false",
});

// No HTTP request in these tests: audit entries get no IP or user agent.
vi.mock("@/lib/request", () => ({ clientInfo: async () => ({ ip: null, rawIp: null, userAgent: null }) }));

export const dbUrls = urls;
