// Points git at .githooks so the security checks run on every commit and
// push. Runs on `npm install`; does nothing outside a git checkout (e.g. in
// the Docker build).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".git")) {
  try {
    execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
  } catch {
    // git not installed: nothing to do.
  }
}
