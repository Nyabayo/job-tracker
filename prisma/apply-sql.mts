// Applies prisma/rls.sql as the owner role after `prisma migrate deploy`.
// rls.sql is idempotent, so this runs on every deploy.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

if (existsSync(".env")) process.loadEnvFile(".env");

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) throw new Error("DATABASE_URL_OWNER is not set");
  const sql = readFileSync(path.join(import.meta.dirname, "rls.sql"), "utf8");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Applied rls.sql");
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
