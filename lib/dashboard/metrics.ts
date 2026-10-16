import { RESPONSE_STAGES, STAGE } from "@/lib/board/constants";

// H1, H2: dashboard numbers. Pure functions so the maths is unit tested.
// Definitions (spec H): a response is a move past Applied (to Interview,
// Offer or Rejected). Rates use applied jobs as the denominator.

export type MetricJob = {
  id: string;
  stageName: string;
  dateSaved: Date;
  dateApplied: Date | null;
  /** First time the job reached a response stage, from its timeline. */
  firstResponseAt: Date | null;
};

export type Metrics = {
  total: number;
  applied: number;
  active: number;
  interviews: number;
  offers: number;
  rejections: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  avgDaysToFirstResponse: number | null;
};

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

export function computeMetrics(jobs: MetricJob[]): Metrics {
  const appliedJobs = jobs.filter((j) => j.dateApplied || j.stageName !== STAGE.WISHLIST);
  const count = (stage: string) => jobs.filter((j) => j.stageName === stage).length;
  const interviews = count(STAGE.INTERVIEW);
  const offers = count(STAGE.OFFER);
  const rejections = count(STAGE.REJECTED);
  const responded = appliedJobs.filter((j) => RESPONSE_STAGES.includes(j.stageName));
  const waits = appliedJobs
    .filter((j) => j.dateApplied && j.firstResponseAt && j.firstResponseAt >= j.dateApplied)
    .map((j) => ((j.firstResponseAt as Date).getTime() - (j.dateApplied as Date).getTime()) / 86_400_000);
  return {
    total: jobs.length,
    applied: appliedJobs.length,
    active: jobs.filter((j) => j.stageName === STAGE.APPLIED || j.stageName === STAGE.INTERVIEW).length,
    interviews,
    offers,
    rejections,
    responseRate: pct(responded.length, appliedJobs.length),
    interviewRate: pct(interviews + offers, appliedJobs.length),
    offerRate: pct(offers, appliedJobs.length),
    avgDaysToFirstResponse: waits.length ? Math.round((waits.reduce((a, b) => a + b, 0) / waits.length) * 10) / 10 : null,
  };
}

/** Monday (UTC) of the week a date falls in, as YYYY-MM-DD. */
export function weekStart(d: Date): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  return day.toISOString().slice(0, 10);
}

/** H2: applications per week (line chart), with empty weeks filled in. */
export function applicationsPerWeek(jobs: MetricJob[], from: Date | null, to: Date): { week: string; applications: number }[] {
  const applied = jobs.flatMap((j) => (j.dateApplied ? [j.dateApplied] : []));
  if (applied.length === 0) return [];
  const start = from ?? new Date(Math.min(...applied.map((d) => d.getTime())));
  const counts = new Map<string, number>();
  for (const d of applied) counts.set(weekStart(d), (counts.get(weekStart(d)) ?? 0) + 1);
  const out: { week: string; applications: number }[] = [];
  const cursor = new Date(`${weekStart(start)}T00:00:00.000Z`);
  for (let i = 0; cursor <= to && i < 600; i++) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ week: key, applications: counts.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return out;
}

/** H2: jobs per stage, in board order (bar chart). */
export function funnel(jobs: MetricJob[], stages: string[]): { stage: string; jobs: number }[] {
  return stages.map((stage) => ({ stage, jobs: jobs.filter((j) => j.stageName === stage).length }));
}

export const RANGES = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", all: "All time", custom: "Custom" } as const;
export type RangeKey = keyof typeof RANGES;

/** H3: the date range a filter selects (by date saved). */
export function rangeBounds(range: RangeKey, now: Date, custom?: { from?: string; to?: string }): { from: Date | null; to: Date } {
  if (range === "all") return { from: null, to: now };
  if (range === "custom") {
    const from = custom?.from ? new Date(`${custom.from}T00:00:00.000Z`) : null;
    const to = custom?.to ? new Date(`${custom.to}T23:59:59.999Z`) : now;
    return { from, to };
  }
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - Number(range));
  return { from, to: now };
}
