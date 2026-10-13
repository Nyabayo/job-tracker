// Starts a throwaway Postgres 16 (Testcontainers), creates the three roles
// exactly as production does (prisma/roles.sql), runs every migration as the
// owner, then applies rls.sql. Tests connect as jt_app / jt_auth, so RLS is
// enforced exactly as in production.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

const root = path.resolve(import.meta.dirname, "../..");
let container: StartedPostgreSqlContainer | undefined;

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  container = await new PostgreSqlContainer(process.env.PG_IMAGE ?? "postgres:16-alpine")
    .withPassword("superpass")
    .start();

  const roles = readFileSync(path.join(root, "prisma/roles.sql"), "utf8");
  await container.copyContentToContainer([{ content: roles, target: "/tmp/roles.sql" }]);
  const result = await container.exec([
    "psql", "-v", "ON_ERROR_STOP=1", "-U", container.getUsername(), "-d", "postgres",
    "-v", "owner_password=ownerpass", "-v", "app_password=apppass", "-v", "auth_password=authpass",
    "-v", "db_name=jobtracker_test", "-f", "/tmp/roles.sql",
  ]);
  if (result.exitCode !== 0) throw new Error(`roles.sql failed: ${result.output}`);

  const host = container.getHost();
  const port = container.getPort();
  const url = (user: string, pass: string) => `postgresql://${user}:${pass}@${host}:${port}/jobtracker_test`;
  const urls = {
    owner: url("jt_owner", "ownerpass"),
    app: url("jt_app", "apppass"),
    auth: url("jt_auth", "authpass"),
  };

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL_OWNER: urls.owner },
    stdio: "pipe",
  });
  const owner = new Client({ connectionString: urls.owner });
  await owner.connect();
  await owner.query(readFileSync(path.join(root, "prisma/rls.sql"), "utf8"));
  await owner.end();

  project.provide("dbUrls", urls);

  return async () => {
    await container?.stop();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    dbUrls: { owner: string; app: string; auth: string };
  }
}
