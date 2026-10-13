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
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX),
  confirm: z.literal("DELETE", { error: 'Type DELETE in capital letters to confirm.' }),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
