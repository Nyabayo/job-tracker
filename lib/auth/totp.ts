import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib";
import { env } from "@/lib/env";

// A4: authenticator-app codes (RFC 6238, 6 digits, 30 seconds).

const ISSUER = "Job Tracker";

function key(): Buffer {
  return Buffer.from(env().TOTP_ENCRYPTION_KEY, "hex");
}

/** AES-256-GCM, stored as v1.<iv>.<tag>.<ciphertext> in base64url. */
export function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unknown TOTP secret format");
  // A fixed 16-byte tag: a shortened tag would make forgery easier.
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"), { authTagLength: 16 });
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function newTotpSecret(): string {
  return generateSecret();
}

export function totpUri(secret: string, email: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

/**
 * Checks a 6-digit code, allowing one step of clock drift either way. Codes
 * from a step at or before `lastStep` are refused, so each code works once.
 * Returns the matched step to store, or null.
 */
export async function checkTotp(secret: string, code: string, lastStep: number | null): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const result = await verify({
    secret,
    token: code,
    epochTolerance: 30,
    ...(lastStep !== null ? { afterTimeStep: lastStep } : {}),
  });
  return result.valid && "timeStep" in result ? result.timeStep : null;
}

// Recovery codes: 10 single-use codes like "k7m2-qx9p-4h", about 55 bits each.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const RECOVERY_CODE_COUNT = 10;

export function newRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const chars = Array.from({ length: 11 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
  });
}

export function normaliseRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** High-entropy, single-use codes: a plain SHA-256 is enough (like tokens). */
export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normaliseRecoveryCode(code), "utf8").digest("hex");
}
