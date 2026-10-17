import { NextResponse } from "next/server";

// Liveness check for Docker and uptime monitors. Reveals nothing else.
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
