import { describe, expect, it } from "vitest";
import { generate } from "otplib";
import { authDb } from "@/lib/db";
import { decryptSecret, encryptSecret, hashRecoveryCode } from "@/lib/auth/totp";
import {
  beginSetup,
  confirmSetup,
  decodeTicket,
  disableTwoFactor,
  encodeTicket,
  redeemSecondFactor,
  regenerateRecoveryCodes,
  twoFactorStatus,
} from "@/lib/auth/two-factor";
import { createUser } from "./helpers";

const codeAt = (secret: string, offsetSeconds = 0) => generate({ secret, epoch: Math.floor(Date.now() / 1000) + offsetSeconds });

async function enable(label: string) {
  const user = await createUser(label);
  const setup = await beginSetup(user.id, user.email);
  if (!setup) throw new Error("setup failed");
  const codes = await confirmSetup(user.id, await codeAt(setup.secret));
  if (!codes) throw new Error("confirm failed");
  return { user, secret: setup.secret, codes };
}

describe("A4: TOTP secrets at rest", () => {
  it("encrypts with AES-GCM and refuses tampered values", () => {
    const stored = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(stored).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(stored)).toBe("JBSWY3DPEHPK3PXP");
    const [v, iv, tag, data] = stored.split(".");
    const flipped = Buffer.from(data!, "base64url");
    flipped[0]! ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64url")].join("."))).toThrow();
  });
});

describe("A4: setup", () => {
  it("stays off until a correct code confirms it, then gives 10 hashed recovery codes", async () => {
    const user = await createUser("tfa-setup");
    const setup = await beginSetup(user.id, user.email);
    expect(setup?.uri).toMatch(/^otpauth:\/\/totp\//);
    expect((await twoFactorStatus(user.id)).enabled).toBe(false);

    expect(await confirmSetup(user.id, "000000")).toBeNull();
    const codes = await confirmSetup(user.id, await codeAt(setup!.secret));
    expect(codes).toHaveLength(10);
    expect(await twoFactorStatus(user.id)).toEqual({ enabled: true, codesLeft: 10 });

    const row = await authDb().user.findUniqueOrThrow({ where: { id: user.id }, select: { totpSecret: true } });
    expect(row.totpSecret).not.toContain(setup!.secret);
    const stored = await authDb().recoveryCode.findMany({ where: { userId: user.id }, select: { codeHash: true } });
    expect(stored.map((r) => r.codeHash)).toContain(hashRecoveryCode(codes![0]!));
    expect(stored.map((r) => r.codeHash)).not.toContain(codes![0]);
  });

  it("can't be restarted while on, so a session thief can't swap the secret", async () => {
    const { user } = await enable("tfa-restart");
    expect(await beginSetup(user.id, user.email)).toBeNull();
  });
});

describe("A4: login codes", () => {
  it("accepts each app code once", async () => {
    const { user, secret } = await enable("tfa-replay");
    // The setup code's time step is already used.
    expect(await redeemSecondFactor(user.id, await codeAt(secret))).toBeNull();
    const next = await codeAt(secret, 30);
    expect(await redeemSecondFactor(user.id, next)).toBe("totp");
    expect(await redeemSecondFactor(user.id, next)).toBeNull();
  });

  it("accepts each recovery code once, in any case or spacing", async () => {
    const { user, codes } = await enable("tfa-recovery");
    expect(await redeemSecondFactor(user.id, ` ${codes[3]!.toUpperCase()} `)).toBe("recovery");
    expect(await redeemSecondFactor(user.id, codes[3]!)).toBeNull();
    expect((await twoFactorStatus(user.id)).codesLeft).toBe(9);
  });

  it("refuses another user's recovery code", async () => {
    const a = await enable("tfa-a");
    const b = await enable("tfa-b");
    expect(await redeemSecondFactor(a.user.id, b.codes[0]!)).toBeNull();
  });

  it("new recovery codes replace the old ones", async () => {
    const { user, codes } = await enable("tfa-regen");
    const fresh = await regenerateRecoveryCodes(user.id, codes[0]!);
    expect(fresh).toHaveLength(10);
    expect(await redeemSecondFactor(user.id, codes[1]!)).toBeNull();
    expect(await redeemSecondFactor(user.id, fresh![1]!)).toBe("recovery");
  });

  it("turning off needs a valid code and removes the secret and codes", async () => {
    const { user, codes } = await enable("tfa-off");
    expect(await disableTwoFactor(user.id, "123456")).toBe(false);
    expect(await disableTwoFactor(user.id, codes[0]!)).toBe(true);
    const row = await authDb().user.findUniqueOrThrow({ where: { id: user.id }, select: { totpEnabled: true, totpSecret: true } });
    expect(row).toEqual({ totpEnabled: false, totpSecret: null });
    expect(await authDb().recoveryCode.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("A4: pending-login ticket", () => {
  it("round-trips, expires after 5 minutes and rejects any change", () => {
    const now = Date.now();
    const ticket = encodeTicket({ userId: "u1", next: "/board" }, now);
    expect(decodeTicket(ticket, now)).toEqual({ userId: "u1", next: "/board" });
    expect(decodeTicket(ticket, now + 5 * 60 * 1000 + 1)).toBeNull();
    const [payload, mac] = ticket.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "someone-else", n: "/board", e: now + 60_000 })).toString("base64url");
    expect(decodeTicket(`${forged}.${mac}`, now)).toBeNull();
    expect(decodeTicket(`${payload}.x${mac}`, now)).toBeNull();
    expect(decodeTicket(undefined, now)).toBeNull();
  });
});
