-- G5: track which reminders and deadline alerts have been sent.
ALTER TABLE "tasks" ADD COLUMN "reminded_at" TIMESTAMPTZ(3);
ALTER TABLE "jobs" ADD COLUMN "deadline_notified_at" TIMESTAMPTZ(3);
