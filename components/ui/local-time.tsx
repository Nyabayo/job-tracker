"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Shows a timestamp in the viewer's own time zone (the server doesn't know it). */
export function LocalTime({ value, dateOnly = false }: { value: Date | string; dateOnly?: boolean }) {
  const date = new Date(value);
  const text = useSyncExternalStore(
    subscribe,
    () => (dateOnly ? date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : date.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })),
    () => date.toISOString().slice(0, dateOnly ? 10 : 16).replace("T", " ") + (dateOnly ? "" : " UTC"),
  );
  return <time dateTime={date.toISOString()}>{text}</time>;
}
