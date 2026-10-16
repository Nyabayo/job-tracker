"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { CSRF_FAILED, csrfValid } from "@/lib/security/csrf";
import { invalid, type ActionResult } from "@/lib/action-result";
import { formObject } from "@/lib/validation/forms";
import {
  contactSchema, jobIdSchema, jobSchema, linkSchema, moveJobSchema, noteSchema, tagsSchema, taskIdSchema, taskSchema,
} from "@/lib/validation/job";
import { createJob, deleteJob, moveJob, NotFoundError, setArchived, updateJob, type MoveResult } from "@/lib/board/service";
import { EmptyNoteError, addContact, addLink, addNote, addTask, removeContact, removeLink, removeNote, removeTask, setTags, setTaskDone } from "@/lib/board/details";
import { deleteObjects } from "@/lib/storage";
import { z } from "zod";
import { takeToken } from "@/lib/rate-limit";
import { FetchBlockedError, safeFetch } from "@/lib/fetcher";
import { parseJobPage, type ParsedJob } from "@/lib/parser/job-posting";
import { requiredUrl } from "@/lib/validation/forms";

// Server actions for jobs and everything on a job (B2, B3, B9, C1, D1 to D9,
// F1, G1 to G3). Each one: CSRF check, signed-in user, Zod validation, then a
// service call that runs under row-level security.

const NOT_FOUND: ActionResult = { ok: false, message: "We couldn't find that job. It may have been deleted." };
const FAILED: ActionResult = { ok: false, message: "Something went wrong. Please try again." };

async function run(fn: () => Promise<void>, success = "Saved."): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true, message: success };
  } catch (err) {
    if (err instanceof NotFoundError) return NOT_FOUND;
    console.error("[jobs]", err);
    return FAILED;
  }
}

function refresh(jobId?: string | null) {
  revalidatePath("/board");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

/** C1: Add Job form. Redirects to the new job. */
export async function createJobAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(formData))) return CSRF_FAILED;
  const parsed = jobSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  let id: string;
  try {
    id = (await createJob(user.id, parsed.data)).id;
  } catch (err) {
    if (err instanceof NotFoundError) return { ok: false, message: "That stage no longer exists. Pick another." };
    console.error("[jobs]", err);
    return FAILED;
  }
  refresh();
  redirect(`/jobs/${id}?added=1`);
}

/** D1 to D6: edit a job's details. */
export async function updateJobAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(formData))) return CSRF_FAILED;
  const values = formObject(formData);
  const id = jobIdSchema.safeParse(values);
  const parsed = jobSchema.safeParse(values);
  if (!id.success) return NOT_FOUND;
  if (!parsed.success) return invalid(parsed.error);
  return run(async () => {
    await updateJob(user.id, id.data.jobId, parsed.data);
    refresh(id.data.jobId);
  }, "Changes saved.");
}

export type MoveActionResult = ActionResult & { move?: MoveResult };

/** B2, B3: drag and drop, keyboard moves and the "Move to" menu. */
export async function moveJobAction(input: unknown): Promise<MoveActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = moveJobSchema.safeParse(formObject(input));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const move = await moveJob(user.id, parsed.data);
    refresh(parsed.data.jobId);
    return { ok: true, move };
  } catch (err) {
    if (err instanceof NotFoundError) return NOT_FOUND;
    console.error("[jobs]", err);
    return { ok: false, message: "We couldn't move that card. Please try again." };
  }
}

/** B9: archive or restore a job. */
export async function archiveJobAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const values = formObject(input);
  const parsed = jobIdSchema.safeParse(values);
  if (!parsed.success) return NOT_FOUND;
  const archived = values.archived !== "false" && values.archived !== false;
  const result = await run(() => setArchived(user.id, parsed.data.jobId, archived), archived ? "Job archived." : "Job restored.");
  refresh(parsed.data.jobId);
  revalidatePath("/archive");
  return result;
}

/** Permanently deletes a job and the files only it uses. */
export async function deleteJobAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = jobIdSchema.safeParse(formObject(input));
  if (!parsed.success) return NOT_FOUND;
  const result = await run(async () => {
    const keys = await deleteJob(user.id, parsed.data.jobId);
    await deleteObjects(keys).catch((err: unknown) => console.error("[storage]", err));
  }, "Job deleted.");
  refresh();
  revalidatePath("/archive");
  return result;
}

// ---- D7 links -----------------------------------------------------------------

export async function addLinkAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(formData))) return CSRF_FAILED;
  const parsed = linkSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  return run(async () => {
    await addLink(user.id, parsed.data);
    refresh(parsed.data.jobId);
  }, "Link added.");
}

const idOnly = z.object({ id: z.uuid() });

export async function removeLinkAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = idOnly.safeParse(formObject(input));
  if (!parsed.success) return NOT_FOUND;
  return run(async () => refresh(await removeLink(user.id, parsed.data.id)), "Link removed.");
}

// ---- D8 tags ------------------------------------------------------------------

export async function setTagsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(formData))) return CSRF_FAILED;
  const parsed = tagsSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  return run(async () => {
    await setTags(user.id, parsed.data.jobId, parsed.data.tags);
    refresh(parsed.data.jobId);
  }, "Tags saved.");
}

// ---- D9 notes -----------------------------------------------------------------

export async function addNoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(formData))) return CSRF_FAILED;
  const parsed = noteSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    await addNote(user.id, parsed.data);
  } catch (err) {
    if (err instanceof EmptyNoteError) return { ok: false, fieldErrors: { content: ["Write something first."] } };
    if (err instanceof NotFoundError) return NOT_FOUND;
    console.error("[jobs]", err);
    return FAILED;
  }
  refresh(parsed.data.jobId);
  return { ok: true, message: "Note added." };
}

export async function removeNoteAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = idOnly.safeParse(formObject(input));
  if (!parsed.success) return NOT_FOUND;
  return run(async () => refresh(await removeNote(user.id, parsed.data.id)), "Note deleted.");
}

// ---- F1 contacts --------------------------------------------------------------

export async function addContactAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(formData))) return CSRF_FAILED;
  const parsed = contactSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  return run(async () => {
    await addContact(user.id, parsed.data);
    refresh(parsed.data.jobId);
  }, "Contact added.");
}

const jobContact = z.object({ jobId: z.uuid(), id: z.uuid() });

export async function removeContactAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = jobContact.safeParse(formObject(input));
  if (!parsed.success) return NOT_FOUND;
  return run(async () => {
    await removeContact(user.id, parsed.data.jobId, parsed.data.id);
    refresh(parsed.data.jobId);
  }, "Contact removed.");
}

// ---- G1 to G3 tasks -----------------------------------------------------------

export async function addTaskAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(formData))) return CSRF_FAILED;
  const parsed = taskSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  return run(async () => {
    const jobId = await addTask(user.id, parsed.data);
    refresh(jobId);
    revalidatePath("/tasks");
  }, "Task added.");
}

/** G2: accept the suggested follow-up (a plain object from the toast). */
export async function addTaskQuickAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = taskSchema.safeParse(formObject(input));
  if (!parsed.success) return invalid(parsed.error);
  return run(async () => {
    const jobId = await addTask(user.id, parsed.data);
    refresh(jobId);
    revalidatePath("/tasks");
  }, "Follow-up added.");
}

export async function setTaskDoneAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const values = formObject(input);
  const parsed = taskIdSchema.safeParse(values);
  if (!parsed.success) return NOT_FOUND;
  const done = values.done === true || values.done === "true";
  return run(async () => {
    refresh(await setTaskDone(user.id, parsed.data.taskId, done));
    revalidatePath("/tasks");
  }, done ? "Task done." : "Task reopened.");
}

export async function removeTaskAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = taskIdSchema.safeParse(formObject(input));
  if (!parsed.success) return NOT_FOUND;
  return run(async () => {
    refresh(await removeTask(user.id, parsed.data.taskId));
    revalidatePath("/tasks");
  }, "Task deleted.");
}

// ---- C2 link import -------------------------------------------------------------

export type ImportResult = ActionResult & { job?: ParsedJob & { jobPostUrl: string } };

const importSchema = z.object({ url: requiredUrl });

/** C2: fetches a pasted job link (SSRF-safe) and returns the details to review. Saves nothing. */
export async function importJobAction(input: unknown): Promise<ImportResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = importSchema.safeParse(formObject(input));
  if (!parsed.success) return invalid(parsed.error);
  if (!(await takeToken("importPerUser", user.id))) {
    return { ok: false, message: "You've imported a lot of links in a short time. Wait a few minutes, or fill in the details by hand." };
  }
  try {
    const page = await safeFetch(parsed.data.url);
    if (!/html|xml/i.test(page.contentType)) {
      return { ok: false, message: "That link isn't a web page we can read. Fill in the details by hand below." };
    }
    const job = parseJobPage(page.body, page.url);
    if (!job.title && !job.companyName) {
      return { ok: false, message: "We couldn't find job details on that page. Fill them in by hand below." };
    }
    return { ok: true, message: "Details filled in. Check them, then save.", job: { ...job, jobPostUrl: parsed.data.url } };
  } catch (err) {
    if (err instanceof FetchBlockedError) return { ok: false, message: `${err.message} You can still fill in the details by hand below.` };
    console.error("[import]", err);
    return { ok: false, message: "We couldn't read that page. Fill in the details by hand below." };
  }
}
