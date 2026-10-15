import { describe, expect, it } from "vitest";
import { forwardedClientIp } from "@/lib/ip";
import { parseEnv } from "@/lib/env";

describe("Rate limits: client IP behind a trusted proxy", () => {
  it("uses the address the proxy appended, not one the client sent", () => {
    expect(forwardedClientIp("203.0.113.9")).toBe("203.0.113.9");
    // The client forged the first entry; the proxy appended the real one.
    expect(forwardedClientIp("1.2.3.4, 198.51.100.7")).toBe("198.51.100.7");
    expect(forwardedClientIp("1.2.3.4,2001:db8::1")).toBe("2001:db8::1");
  });

  it("ignores missing or malformed values", () => {
    expect(forwardedClientIp(null)).toBeNull();
    expect(forwardedClientIp("")).toBeNull();
    expect(forwardedClientIp("1.2.3.4, not-an-ip")).toBeNull();
  });
});

describe("Insecure defaults: placeholder secrets", () => {
  const valid = {
    APP_URL: "https://jobs.example.com",
    DATABASE_URL: "postgresql://jt_app:s3cret-app@db:5432/jobtracker",
    DATABASE_URL_AUTH: "postgresql://jt_auth:s3cret-auth@db:5432/jobtracker",
    AUTH_SECRET: "a".repeat(64),
    SMTP_HOST: "smtp.example.com",
    EMAIL_FROM: "Job Tracker <no-reply@example.com>",
    S3_ENDPOINT: "http://storage:8333",
    S3_BUCKET: "jobtracker",
    S3_ACCESS_KEY: "0123456789abcdef",
    S3_SECRET_KEY: "fedcba9876543210fedcba9876543210",
    TOTP_ENCRYPTION_KEY: "0".repeat(64),
  };

  it("accepts real values", () => {
    expect(() => parseEnv(valid)).not.toThrow();
  });

  it.each(["DATABASE_URL", "DATABASE_URL_AUTH", "S3_ACCESS_KEY", "S3_SECRET_KEY"] as const)(
    "refuses to start with %s left as change-me",
    (key) => {
      const value = key.startsWith("DATABASE") ? "postgresql://jt_app:change-me@db:5432/jobtracker" : "change-me";
      expect(() => parseEnv({ ...valid, [key]: value })).toThrow(/change-me/);
    },
  );

  it("refuses the example AUTH_SECRET and TOTP key", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "change-me" })).toThrow();
    expect(() => parseEnv({ ...valid, TOTP_ENCRYPTION_KEY: "change-me" })).toThrow();
  });
});
