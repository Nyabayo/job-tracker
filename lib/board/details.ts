import "server-only";
import { withUser, type Tx } from "@/lib/db";
import { recordMissingRow } from "@/lib/db/owned";
import { htmlHasText, sanitizeRichHtml, textToHtml } from "@/lib/html/sanitize";

export class EmptyNoteError extends Error {}
import { findJob, NotFoundError, timeline } from "@/lib/board/service";
import type { z } from "zod";
import type { contactSchema, linkSchema, noteSchema, taskSchema } from "@/lib/validation/job";

// Job detail records (D7 to D10, F1, G1 to G4). Same rules as service.ts:
// RLS on every query, and ids from the request are always looked up first.

async function touch(tx: Tx, jobId: string) {
  await tx.job.update({ where: { id: jobId }, data: { lastActivityAt: new Date() }, select: { id: true } });
}

async function owned<T>(tx: Tx, userId: string, table: "job_links" | "notes" | "contacts" | "tasks" | "notifications", id: string, row: T | null): Promise<T> {
  if (row) return row;
  await recordMissingRow(tx, userId, table, id);
  throw new NotFoundError();
}

// ---- D7 links ---------------------------------------------------------------

export function addLink(userId: string, input: z.output<typeof linkSchema>) {
  return withUser(userId, async (tx) => {
    const job = await findJob(tx, userId, input.jobId);
    await tx.jobLink.create({ data: { userId, jobId: job.id, label: input.label, url: input.url }, select: { id: true } });
    await timeline(tx, userId, job.id, "FIELD_UPDATED", { fields: ["links"] });
    await touch(tx, job.id);
  });
}

export function removeLink(userId: string, linkId: string) {
  return withUser(userId, async (tx) => {
    const link = await owned(tx, userId, "job_links", linkId, await tx.jobLink.findFirst({ where: { id: linkId } }));
    await tx.jobLink.delete({ where: { id: link.id }, select: { id: true } });
    return link.jobId;
  });
}

// ---- D8 tags ----------------------------------------------------------------

export function setTags(userId: string, jobId: string, names: string[]) {
  return withUser(userId, async (tx) => {
    const job = await findJob(tx, userId, jobId);
    const tags = await Promise.all(
      names.map((name) =>
        tx.tag.upsert({ where: { userId_name: { userId, name } }, create: { userId, name }, update: {}, select: { id: true } }),
      ),
    );
    await tx.jobTag.deleteMany({ where: { jobId: job.id } });
    if (tags.length > 0) await tx.jobTag.createMany({ data: tags.map((t) => ({ jobId: job.id, tagId: t.id, userId })) });
    // Tags no job uses any more are removed so the filter list stays tidy.
    await tx.tag.deleteMany({ where: { jobs: { none: {} } } });
    await timeline(tx, userId, job.id, "FIELD_UPDATED", { fields: ["tags"] });
    await touch(tx, job.id);
  });
}

// ---- D9 notes ---------------------------------------------------------------

export function addNote(userId: string, input: z.output<typeof noteSchema>) {
  return withUser(userId, async (tx) => {
    const job = await findJob(tx, userId, input.jobId);
    const contentHtml = input.format === "html" ? sanitizeRichHtml(input.content) : textToHtml(input.content);
    if (!htmlHasText(contentHtml)) throw new EmptyNoteError();
    await tx.note.create({ data: { userId, jobId: job.id, contentHtml }, select: { id: true } });
    await timeline(tx, userId, job.id, "NOTE_ADDED");
    await touch(tx, job.id);
  });
}

export function removeNote(userId: string, noteId: string) {
  return withUser(userId, async (tx) => {
    const note = await owned(tx, userId, "notes", noteId, await tx.note.findFirst({ where: { id: noteId } }));
    await tx.note.delete({ where: { id: note.id }, select: { id: true } });
    return note.jobId;
  });
}

// ---- F1 contacts ------------------------------------------------------------

export function addContact(userId: string, input: z.output<typeof contactSchema>) {
  return withUser(userId, async (tx) => {
    const job = await findJob(tx, userId, input.jobId);
    const { jobId: _jobId, relationship, ...fields } = input;
    void _jobId;
    const contact = await tx.contact.create({ data: { userId, ...fields }, select: { id: true } });
    await tx.jobContact.create({ data: { userId, jobId: job.id, contactId: contact.id, relationship }, select: { jobId: true } });
    await timeline(tx, userId, job.id, "CONTACT_ADDED", { name: input.name });
    await touch(tx, job.id);
  });
}

export function removeContact(userId: string, jobId: string, contactId: string) {
  return withUser(userId, async (tx) => {
    const job = await findJob(tx, userId, jobId);
    const contact = await owned(tx, userId, "contacts", contactId, await tx.contact.findFirst({ where: { id: contactId } }));
    await tx.jobContact.deleteMany({ where: { jobId: job.id, contactId: contact.id } });
    // A contact no job uses any more is deleted with it (data minimisation).
    await tx.contact.deleteMany({ where: { id: contact.id, jobs: { none: {} } } });
  });
}

// ---- G1, G3, G4 tasks -------------------------------------------------------

export function addTask(userId: string, input: z.output<typeof taskSchema>) {
  return withUser(userId, async (tx) => {
    const job = input.jobId ? await findJob(tx, userId, input.jobId) : null;
    await tx.task.create({
      data: {
        userId,
        jobId: job?.id ?? null,
        title: input.title,
        kind: input.kind,
        interviewType: input.kind === "INTERVIEW" ? input.interviewType : null,
        dueAt: input.dueAt,
        remindAt: input.remindAt,
        notes: input.notes,
      },
      select: { id: true },
    });
    if (job) await touch(tx, job.id);
    return job?.id ?? null;
  });
}

export function setTaskDone(userId: string, taskId: string, done: boolean) {
  return withUser(userId, async (tx) => {
    const task = await owned(tx, userId, "tasks", taskId, await tx.task.findFirst({ where: { id: taskId } }));
    await tx.task.update({ where: { id: task.id }, data: { completedAt: done ? new Date() : null }, select: { id: true } });
    if (done && task.jobId && !task.completedAt) await timeline(tx, userId, task.jobId, "TASK_COMPLETED", { title: task.title });
    return task.jobId;
  });
}

export function removeTask(userId: string, taskId: string) {
  return withUser(userId, async (tx) => {
    const task = await owned(tx, userId, "tasks", taskId, await tx.task.findFirst({ where: { id: taskId } }));
    await tx.task.delete({ where: { id: task.id }, select: { id: true } });
    return task.jobId;
  });
}

/** G4: every task, with its job's title. Grouped in the browser by local date. */
export function listTasks(userId: string) {
  return withUser(userId, (tx) =>
    tx.task.findMany({
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      include: { job: { select: { id: true, title: true, companyName: true } } },
      take: 1000,
    }),
  );
}

// ---- G5 notifications -------------------------------------------------------

export function unreadCount(userId: string) {
  return withUser(userId, (tx) => tx.notification.count({ where: { readAt: null } }));
}

export function listNotifications(userId: string) {
  return withUser(userId, (tx) => tx.notification.findMany({ orderBy: { createdAt: "desc" }, take: 100 }));
}

export function markAllRead(userId: string) {
  return withUser(userId, (tx) => tx.notification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } }));
}
