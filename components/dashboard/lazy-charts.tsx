"use client";

import dynamic from "next/dynamic";

const loading = () => <div className="h-[260px] animate-pulse rounded-[var(--radius-card)] bg-ground" aria-hidden="true" />;

export const WeeklyChart = dynamic(() => import("./charts").then((m) => m.WeeklyChart), { ssr: false, loading });
export const FunnelChart = dynamic(() => import("./charts").then((m) => m.FunnelChart), { ssr: false, loading });
