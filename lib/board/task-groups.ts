// G4: which section a task belongs in, by the viewer's local calendar day.

type Groupable = { dueAt: Date | string | null; completedAt: Date | string | null };

export function groupTasks<T extends Groupable>(tasks: T[], now: Date) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const out = { overdue: [] as T[], today: [] as T[], upcoming: [] as T[], completed: [] as T[] };
  for (const t of tasks) {
    if (t.completedAt) {
      out.completed.push(t);
      continue;
    }
    if (!t.dueAt) {
      out.upcoming.push(t);
      continue;
    }
    const due = new Date(t.dueAt).getTime();
    if (due < now.getTime() && due < startOfToday.getTime()) out.overdue.push(t);
    else if (due < startOfTomorrow.getTime()) out.today.push(t);
    else out.upcoming.push(t);
  }
  return out;
}
