import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Algorithm.Argon2id; the package exports it as a const enum, which isolated
// module builds can't read, so the value is written out.
const ARGON2ID = 2;

// Argon2id with the OWASP Password Storage Cheat Sheet baseline:
// 19 MiB memory, 2 iterations, 1 degree of parallelism.
const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

// Verified against when the email is unknown, so a login takes the same time
// whether or not the account exists.
let dummyHash: Promise<string> | undefined;

export async function verifyPassword(storedHash: string | null | undefined, password: string): Promise<boolean> {
  if (!storedHash) {
    dummyHash ??= hashPassword("timing-equaliser-not-a-real-password");
    await verify(await dummyHash, password).catch(() => false);
    return false;
  }
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
