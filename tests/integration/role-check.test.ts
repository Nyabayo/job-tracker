import { describe, expect, it } from "vitest";
import { assertSafeDatabaseRole } from "@/lib/db/role-check";
import { dbUrls } from "./env";

describe("A5: the app refuses to start with an RLS-bypassing role", () => {
  it("accepts jt_app and jt_auth", async () => {
    await expect(assertSafeDatabaseRole(dbUrls.app, "DATABASE_URL")).resolves.toBeUndefined();
    await expect(assertSafeDatabaseRole(dbUrls.auth, "DATABASE_URL_AUTH")).resolves.toBeUndefined();
  });

  it("rejects the table owner", async () => {
    await expect(assertSafeDatabaseRole(dbUrls.owner, "DATABASE_URL")).rejects.toThrow(/bypass row-level security/);
  });
});
