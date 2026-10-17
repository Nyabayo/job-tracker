"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { CSRF_FAILED, csrfValid } from "@/lib/security/csrf";
import type { ActionResult } from "@/lib/action-result";
import { takeToken } from "@/lib/rate-limit";
import { formObject } from "@/lib/validation/forms";
import { NotFoundError } from "@/lib/board/service";
import { deleteDocument, UploadError, uploadDocument } from "@/lib/documents/service";

const DOCUMENT_TYPES = ["CV", "COVER_LETTER", "ACADEMIC_CERT", "PROFESSIONAL_CERT", "TESTIMONIAL", "RECOMMENDATION", "OTHER"] as const;
const uploadSchema = z.object({ jobId: z.uuid(), type: z.enum(DOCUMENT_TYPES, "Choose what kind of document this is.") });

/** E1, E2: upload a file to a job. */
export async function uploadDocumentAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(formData))) return CSRF_FAILED;
  const parsed = uploadSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Something went wrong." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, fieldErrors: { file: ["Choose a file to upload."] }, message: "Choose a file to upload." };
  if (!(await takeToken("uploadPerUser", user.id))) return { ok: false, message: "You've uploaded a lot of files in a short time. Please wait a while." };
  try {
    await uploadDocument(user.id, parsed.data.jobId, parsed.data.type, file);
  } catch (err) {
    if (err instanceof UploadError) return { ok: false, message: err.message };
    if (err instanceof NotFoundError) return { ok: false, message: "We couldn't find that job." };
    console.error("[upload]", err);
    return { ok: false, message: "The upload failed. Please try again." };
  }
  revalidatePath(`/jobs/${parsed.data.jobId}`);
  return { ok: true, message: "File uploaded and checked for viruses." };
}

export async function deleteDocumentAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await csrfValid(input))) return CSRF_FAILED;
  const parsed = z.object({ id: z.uuid() }).safeParse(formObject(input));
  if (!parsed.success) return { ok: false, message: "We couldn't find that file." };
  try {
    const jobId = await deleteDocument(user.id, parsed.data.id);
    if (jobId) revalidatePath(`/jobs/${jobId}`);
    return { ok: true, message: "File deleted." };
  } catch (err) {
    if (err instanceof NotFoundError) return { ok: false, message: "We couldn't find that file." };
    console.error("[documents]", err);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
