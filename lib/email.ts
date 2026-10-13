import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { escapeHtml } from "@/lib/html";

const globalForMail = globalThis as unknown as { jobTrackerMail?: Transporter };

function transport(): Transporter {
  const e = env();
  globalForMail.jobTrackerMail ??= nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD ?? "" } : undefined,
    // Never read local files or fetch URLs while building a message.
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return globalForMail.jobTrackerMail;
}

type ActionEmail = { to: string; subject: string; intro: string; actionLabel: string; actionUrl: string; outro: string };

function render({ intro, actionLabel, actionUrl, outro }: ActionEmail): { text: string; html: string } {
  const text = `${intro}\n\n${actionLabel}: ${actionUrl}\n\n${outro}\n\nJob Tracker`;
  const html = `<!doctype html><html><body style="margin:0;background:#F7F6F2;font-family:Arial,sans-serif;color:#1B1D29">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;background:#FFFFFF;border:1px solid #E2E0D8;border-radius:14px">
<p style="font-size:15px;line-height:1.5">${escapeHtml(intro)}</p>
<p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#3D3BD4;color:#FFFFFF;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${escapeHtml(actionLabel)}</a></p>
<p style="font-size:14px;line-height:1.5;color:#4E5163">${escapeHtml(outro)}</p>
<p style="font-size:12px;color:#4E5163">Job Tracker</p></div></body></html>`;
  return { text, html };
}

async function send(mail: ActionEmail): Promise<void> {
  const { text, html } = render(mail);
  await transport().sendMail({ from: env().EMAIL_FROM, to: mail.to, subject: mail.subject, text, html });
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  await send({
    to,
    subject: "Confirm your email for Job Tracker",
    intro: "Thanks for signing up. Confirm your email address to start tracking your applications.",
    actionLabel: "Confirm my email",
    actionUrl: `${env().APP_URL}/verify-email?token=${encodeURIComponent(token)}`,
    outro: "This link works for 24 hours. If you didn't sign up, you can ignore this email.",
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  await send({
    to,
    subject: "Reset your Job Tracker password",
    intro: "We received a request to reset your password.",
    actionLabel: "Choose a new password",
    actionUrl: `${env().APP_URL}/reset-password?token=${encodeURIComponent(token)}`,
    outro: "This link works once, for 30 minutes. If you didn't ask for it, you can ignore this email; your password stays the same.",
  });
}

export async function sendAccountDeletedEmail(to: string): Promise<void> {
  const body = render({
    to,
    subject: "",
    intro: "Your Job Tracker account has been closed. All your jobs, files and notes will be permanently deleted within 24 hours.",
    actionLabel: "Visit Job Tracker",
    actionUrl: env().APP_URL,
    outro: "If you didn't do this, reply to this email straight away.",
  });
  await transport().sendMail({ from: env().EMAIL_FROM, to, subject: "Your Job Tracker account was deleted", ...body });
}
