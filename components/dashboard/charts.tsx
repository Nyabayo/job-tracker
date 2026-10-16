"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// H2. Loaded only in the browser (next/dynamic), so the chart library never
// slows down the first paint and its inline styles are set by script, which
// the CSP allows, rather than in the HTML.

export function WeeklyChart({ data }: { data: { week: string; applications: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="week" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} tickFormatter={(w: string) => w.slice(5)} />
        <YAxis allowDecimals={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
        <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
        <Line type="monotone" dataKey="applications" name="Applications" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FunnelChart({ data }: { data: { stage: string; jobs: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="stage" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
        <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
        <Bar dataKey="jobs" name="Jobs" fill="var(--primary)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
