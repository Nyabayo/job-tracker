import { describe, expect, it } from "vitest";
import { deleteAccountSchema, loginSchema, resetPasswordSchema, signUpSchema } from "@/lib/validation/auth";

const strong = "a long enough password";

describe("A1: sign-up validation", () => {
  it("accepts a valid sign-up and normalises the email", () => {
    const r = signUpSchema.parse({ email: "  Ann@Example.COM ", password: strong, confirmPassword: strong });
    expect(r.email).toBe("ann@example.com");
  });

  it("rejects short passwords, mismatched confirmation and bad emails", () => {
    const r = signUpSchema.safeParse({ email: "not-an-email", password: "short", confirmPassword: "different" });
    expect(r.success).toBe(false);
    const paths = r.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).toEqual(expect.arrayContaining(["email", "password"]));
  });

  it("rejects passwords over 128 characters", () => {
    const long = "x".repeat(129);
    expect(signUpSchema.safeParse({ email: "a@b.co", password: long, confirmPassword: long }).success).toBe(false);
  });

  it("flags a confirmation that doesn't match", () => {
    const r = signUpSchema.safeParse({ email: "a@b.co", password: strong, confirmPassword: `${strong}!` });
    expect(r.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});

describe("A1: login validation", () => {
  it("does not apply password length rules at login", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});

describe("A3: reset token format", () => {
  it("accepts only 43-character base64url tokens", () => {
    const token = "A".repeat(43);
    expect(resetPasswordSchema.safeParse({ token, password: strong, confirmPassword: strong }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token: "../../etc", password: strong, confirmPassword: strong }).success).toBe(false);
  });
});

describe("A7: delete account confirmation", () => {
  it("requires the word DELETE exactly", () => {
    expect(deleteAccountSchema.safeParse({ password: "x", confirm: "DELETE" }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ password: "x", confirm: "delete" }).success).toBe(false);
  });
});
