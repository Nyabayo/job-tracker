import { describe, expect, it } from "vitest";
import { asOwner } from "./helpers";

// A5 guard rail: a new user-owned table without RLS fails the build.
describe("A5: RLS covers every user-owned table", () => {
  it("every table with a user_id column has RLS enabled and a jt_app policy", async () => {
    const rows = await asOwner<{ table_name: string; rls: boolean; app_policies: number }>(`
      SELECT c.table_name,
             t.relrowsecurity AS rls,
             (SELECT count(*)::int FROM pg_policies p
               WHERE p.tablename = c.table_name AND 'jt_app' = ANY (p.roles)) AS app_policies
      FROM information_schema.columns c
      JOIN pg_class t ON t.relname = c.table_name AND t.relkind = 'r'
      WHERE c.table_schema = 'public' AND c.column_name = 'user_id' AND c.table_name <> 'audit_logs'
      ORDER BY 1`);
    expect(rows.length).toBeGreaterThanOrEqual(18);
    const unprotected = rows.filter((r) => !r.rls || r.app_policies === 0).map((r) => r.table_name);
    expect(unprotected).toEqual([]);
  });

  it("the users, auth-token and audit tables have RLS enabled too", async () => {
    const rows = await asOwner<{ relname: string; relrowsecurity: boolean }>(
      `SELECT relname, relrowsecurity FROM pg_class
       WHERE relname IN ('users', 'verification_tokens', 'audit_logs') ORDER BY 1`,
    );
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });

  it("the runtime roles can't bypass RLS and own no tables", async () => {
    const roles = await asOwner<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(
      `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('jt_app', 'jt_auth')`,
    );
    expect(roles).toHaveLength(2);
    expect(roles.every((r) => !r.rolsuper && !r.rolbypassrls)).toBe(true);
    const owned = await asOwner(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner IN ('jt_app', 'jt_auth')`);
    expect(owned).toEqual([]);
  });
});
