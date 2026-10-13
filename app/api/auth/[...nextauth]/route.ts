// Auth.js endpoints (session, CSRF token, sign-out). OAuth callbacks for
// Google and GitHub (A2) are served from here in Sprint 3.
import { handlers } from "@/lib/auth/config";

export const { GET, POST } = handlers;
