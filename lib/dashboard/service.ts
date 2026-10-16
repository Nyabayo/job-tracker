import "server-only";
import { withUser } from "@/lib/db";
import { RESPONSE_STAGES } from "@/lib/board/constants";
import type { MetricJob } from "@/lib/dashboard/metrics";

/** H1: the jobs behind the dashboard (non-archived, so totals match the board). */
export function loadMetricJobs(userId: string, from: Date | null, to: Date) {
  return withUser(userId, async (tx) => {
    const [stages, jobs] = await Promise.all([
      tx.stage.findMany({ where: { hidden: false }, orderBy: { order: "asc" }, select: { name: true } }),
      tx.job.findMany({
        where: { archivedAt: null, dateSaved: { ...(from ? { gte: from } : {}), lte: to } },
        select: {
          id: true,
          dateSaved: true,
          dateApplied: true,
          stage: { select: { name: true } },
          timelineEvents: { where: { type: "STAGE_CHANGED" }, orderBy: { createdAt: "asc" }, select: { createdAt: true, payload: true } },
        },
        take: 10_000,
      }),
    ]);
    const metricJobs: MetricJob[] = jobs.map((j) => {
      const first = j.timelineEvents.find((e) => {
        const to = (e.payload as { to?: unknown } | null)?.to;
        return typeof to === "string" && RESPONSE_STAGES.includes(to);
      });
      return { id: j.id, stageName: j.stage.name, dateSaved: j.dateSaved, dateApplied: j.dateApplied, firstResponseAt: first?.createdAt ?? null };
    });
    return { stages: stages.map((s) => s.name), jobs: metricJobs };
  });
}
