import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Load .env for local development without an extra dependency.
if (existsSync(".env")) process.loadEnvFile(".env");

// Migrations run as the owner role. The app itself never sees these
// credentials; it connects as the non-owner roles jt_app and jt_auth (A5).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL_OWNER ?? "",
  },
});
