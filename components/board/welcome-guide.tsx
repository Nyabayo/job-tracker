"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const KEY = "jt-welcome-dismissed";
const subscribe = () => () => {};

function dismissedBefore(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** L4: three-step welcome guide, skippable. Remembered in this browser only. */
export function WelcomeGuide() {
  const stored = useSyncExternalStore(subscribe, dismissedBefore, () => true);
  const [skipped, setSkipped] = useState(false);
  if (stored || skipped) return null;
  const skip = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Storage blocked: just hide it for now.
    }
    setSkipped(true);
  };
  return (
    <section aria-labelledby="welcome-title" className="rounded-[var(--radius-panel)] bg-panel p-5 text-on-panel">
      <h2 id="welcome-title" className="text-xl font-bold text-accent">
        Welcome to Job Tracker
      </h2>
      <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
        <li>
          <p>
            <Link href="/jobs/new" className="font-semibold underline">
              Add your first job
            </Link>{" "}
            by pasting its link or typing the title and company.
          </p>
        </li>
        <li>Open the job and upload the CV you sent, so you can see which CV gets interviews.</li>
        <li>Explore the board: drag cards between stages, or use “Move to” on your phone.</li>
      </ol>
      <Button variant="accent" className="mt-4" onClick={skip}>
        Got it, skip the guide
      </Button>
    </section>
  );
}
