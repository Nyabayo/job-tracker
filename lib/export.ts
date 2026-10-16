import "server-only";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { withUser } from "@/lib/db";
import { env } from "@/lib/env";
import { s3 } from "@/lib/storage";
import { cleanFileName } from "@/lib/documents/filetype";
import type { ZipEntry } from "@/lib/zip";

// A6: everything we store about a user, in one JSON document, plus a jobs
// CSV. Secrets (password hash, 2FA secret, recovery codes, session tokens)
// are never included.

export async function exportData(userId: string) {
  return withUser(userId, async (tx) => {
    const [user, stages, jobs, links, tags, jobTags, notes, documents, jobDocuments, contacts, jobContacts, tasks, notifications, timeline] =
      await Promise.all([
        tx.user.findFirst({
          where: { id: userId },
          select: { id: true, email: true, name: true, theme: true, timezone: true, defaultCurrency: true, emailReminders: true, totpEnabled: true, createdAt: true },
        }),
        tx.stage.findMany(),
        tx.job.findMany(),
        tx.jobLink.findMany(),
        tx.tag.findMany(),
        tx.jobTag.findMany(),
        tx.note.findMany(),
        tx.document.findMany({ omit: { storageKey: true } }),
        tx.jobDocument.findMany(),
        tx.contact.findMany(),
        tx.jobContact.findMany(),
        tx.task.findMany(),
        tx.notification.findMany(),
        tx.timelineEvent.findMany(),
      ]);
    return {
      exportedAt: new Date().toISOString(),
      format: "job-tracker-export/1",
      user, stages, jobs, links, tags, jobTags, notes, documents, jobDocuments, contacts, jobContacts, tasks, notifications, timeline,
    };
  });
}

/** One CSV cell. Cells that a spreadsheet would run as a formula are made inert. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function jobsCsv(data: Awaited<ReturnType<typeof exportData>>): string {
  const stage = new Map(data.stages.map((s) => [s.id, s.name]));
  const columns = [
    "title", "companyName", "stage", "location", "country", "workType", "employmentType", "salaryMin", "salaryMax", "salaryCurrency",
    "salaryPeriod", "excitement", "jobBoardName", "jobPostUrl", "companyUrl", "dateSaved", "dateApplied", "deadline", "archivedAt",
  ] as const;
  const rows = data.jobs.map((j) => {
    const record: Record<(typeof columns)[number], unknown> = {
      title: j.title, companyName: j.companyName, stage: stage.get(j.stageId) ?? "", location: j.location, country: j.country, workType: j.workType,
      employmentType: j.employmentType, salaryMin: j.salaryMin, salaryMax: j.salaryMax, salaryCurrency: j.salaryCurrency, salaryPeriod: j.salaryPeriod,
      excitement: j.excitement, jobBoardName: j.jobBoardName, jobPostUrl: j.jobPostUrl, companyUrl: j.companyUrl, dateSaved: j.dateSaved,
      dateApplied: j.dateApplied, deadline: j.deadline, archivedAt: j.archivedAt,
    };
    // eslint-disable-next-line security/detect-object-injection -- `c` comes from the fixed column list
    return columns.map((c) => csvCell(record[c])).join(",");
  });
  return [columns.join(","), ...rows].join("\r\n") + "\r\n";
}

/**
 * A6: data.json, jobs.csv and every clean uploaded file, one at a time, for
 * the ZIP export. Files still being scanned or flagged are left out.
 */
export async function* exportZipEntries(userId: string): AsyncGenerator<ZipEntry> {
  const data = await exportData(userId);
  yield { name: "data.json", data: Buffer.from(JSON.stringify(data, null, 2), "utf8") };
  yield { name: "jobs.csv", data: Buffer.from(jobsCsv(data), "utf8") };

  const files = await withUser(userId, (tx) =>
    tx.document.findMany({ where: { scanStatus: "CLEAN" }, select: { id: true, originalName: true, storageKey: true }, orderBy: { createdAt: "asc" } }),
  );
  for (const file of files) {
    const obj = await s3().send(new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: file.storageKey }));
    if (!obj.Body) continue;
    yield { name: `files/${file.id.slice(0, 8)}-${cleanFileName(file.originalName)}`, data: await obj.Body.transformToByteArray() };
  }
}
