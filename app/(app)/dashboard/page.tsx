import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { FunnelChart, WeeklyChart } from "@/components/dashboard/lazy-charts";
import { requireUser } from "@/lib/auth/session";
import { loadMetricJobs } from "@/lib/dashboard/service";
import { applicationsPerWeek, computeMetrics, funnel, RANGES, rangeBounds, type RangeKey } from "@/lib/dashboard/metrics";
import { cn } from "@/lib/utils";
import { z } from "zod";

export const metadata: Metadata = { title: "Dashboard" };

const paramsSchema = z.object({
  range: z.enum(Object.keys(RANGES) as [RangeKey, ...RangeKey[]]).catch("all"),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
});

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="font-heading text-3xl font-extrabold text-primary">{value}</span>
      <span className="text-sm text-secondary">{label}</span>
    </Card>
  );
}

/** H1 to H3. */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const raw = await searchParams;
  const p = paramsSchema.parse({ range: raw.range ?? "all", from: raw.from, to: raw.to });
  const { from, to } = rangeBounds(p.range, new Date(), { from: p.from, to: p.to });
  const data = await loadMetricJobs(user.id, from, to);
  const m = computeMetrics(data.jobs);
  const weekly = applicationsPerWeek(data.jobs, from, to);
  const stages = funnel(data.jobs, data.stages);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="See what's working: response, interview and offer rates." />
      <nav aria-label="Date range" className="flex flex-wrap gap-2">
        {(Object.keys(RANGES) as RangeKey[])
          .filter((k) => k !== "custom")
          .map((k) => (
            <Link
              key={k}
              href={`/dashboard?range=${k}`}
              aria-current={p.range === k ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-[var(--radius-chip)] border px-4 text-sm font-semibold",
                p.range === k ? "border-primary bg-primary text-on-primary" : "border-border bg-surface",
              )}
            >
              {RANGES[k]}
            </Link>
          ))}
      </nav>
      <form method="get" action="/dashboard" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="range" value="custom" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dash-from" className="text-sm font-semibold">
            From
          </label>
          <Input id="dash-from" name="from" type="date" defaultValue={p.from ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dash-to" className="text-sm font-semibold">
            To
          </label>
          <Input id="dash-to" name="to" type="date" defaultValue={p.to ?? ""} />
        </div>
        <button type="submit" className={buttonVariants({ variant: "secondary" })}>
          Show custom range
        </button>
      </form>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 tab:grid-cols-3 lg:grid-cols-5">
        <Tile value={String(m.total)} label="Total jobs" />
        <Tile value={String(m.applied)} label="Applications" />
        <Tile value={String(m.active)} label="Active" />
        <Tile value={String(m.interviews)} label="Interviews" />
        <Tile value={String(m.offers)} label="Offers" />
        <Tile value={String(m.rejections)} label="Rejections" />
        <Tile value={`${m.responseRate}%`} label="Response rate" />
        <Tile value={`${m.interviewRate}%`} label="Interview rate" />
        <Tile value={`${m.offerRate}%`} label="Offer rate" />
        <Tile value={m.avgDaysToFirstResponse === null ? "None yet" : `${m.avgDaysToFirstResponse} days`} label="Average wait for a first response" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-lg font-bold">Applications per week</h2>
          {weekly.length ? <WeeklyChart data={weekly} /> : <p className="text-secondary">No applications in this range yet.</p>}
          {weekly.length ? (
            <table className="sr-only">
              <caption>Applications per week</caption>
              <thead>
                <tr>
                  <th>Week starting</th>
                  <th>Applications</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map((w) => (
                  <tr key={w.week}>
                    <td>{w.week}</td>
                    <td>{w.applications}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-lg font-bold">Jobs by stage</h2>
          <FunnelChart data={stages} />
          <table className="sr-only">
            <caption>Jobs by stage</caption>
            <tbody>
              {stages.map((s) => (
                <tr key={s.stage}>
                  <th scope="row">{s.stage}</th>
                  <td>{s.jobs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <p className="text-sm text-secondary">
        A response means a job moved past Applied (to Interview, Offer or Rejected). Rates are out of the jobs you applied to.
      </p>
    </div>
  );
}
