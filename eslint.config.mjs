import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  security.configs.recommended,
  {
    rules: {
      // Rule 5: no `any` unless a comment explains why (use an eslint-disable
      // comment with the reason).
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/generated/prisma/client",
              importNames: ["PrismaClient"],
              message: "Use withUser() or authDb() from @/lib/db so RLS always applies (A5).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/db/**", "lib/auth/config.ts", "tests/**", "prisma/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Test files build paths and objects from fixed test data.
    files: ["tests/**"],
    rules: { "security/detect-object-injection": "off", "security/detect-non-literal-fs-filename": "off" },
  },
  globalIgnores([".next/**", ".semgrep/**", "lib/generated/**", "node_modules/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts"]),
]);
