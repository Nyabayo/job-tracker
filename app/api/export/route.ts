import { currentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { takeToken } from "@/lib/rate-limit";
import { exportData, jobsCsv } from "@/lib/export";

// A6: download all my data. Same-site GET only; the session cookie is
// SameSite=Lax and the response is a download nobody else can read.
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Not found", { status: 404 });
  if (!(await takeToken("exportPerUser", user.id))) return new Response("Too many exports. Please wait a while.", { status: 429 });
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const data = await exportData(user.id);
  await audit({ event: "EXPORT", userId: user.id, detail: { format } });
  const day = new Date().toISOString().slice(0, 10);
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `attachment; filename="job-tracker-${format === "csv" ? "jobs" : "export"}-${day}.${format}"`,
  };
  if (format === "csv") return new Response(jobsCsv(data), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  return new Response(JSON.stringify(data, null, 2), { headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
}
