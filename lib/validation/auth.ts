import { z } from "zod";

// Shared by the forms (react-hook-form) and the server actions (rule 4).

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use ${PASSWORD_MAX} characters or fewer.`);

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "This link is not valid.");

export const signUpSchema = z
  .object({
    name: z.string().trim().max(100, "Use 100 characters or fewer.").optional().or(z.literal("")),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don't match.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  // No length rules at login: never hint at the password policy here.
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX),
});

// A4: a 6-digit app code, or a recovery code such as "k7m2-qx9p-4h".
export const twoFactorSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter the code from your authenticator app.")
    .max(20, "That code is too long.")
    .regex(/^[A-Za-z0-9 -]+$/, "Use the 6 digits from your app, or a recovery code."),
});

export const oauthSchema = z.object({ provider: z.enum(["google", "github"]) });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resendVerificationSchema = z.object({ email: emailSchema });

export const verifyEmailSchema = z.object({ token: tokenSchema });

export const resetPasswordSchema = z
  .object({
    token: tokenSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don't match.",
  });

export const deleteAccountSchema = z.object({
  // Accounts made with Google or GitHub have no password; the action decides.
  password: z.string().max(PASSWORD_MAX).optional().or(z.literal("")),
  code: z.string().trim().max(20).optional().or(z.literal("")),
  confirm: z.literal("DELETE", { error: 'Type DELETE in capital letters to confirm.' }),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
