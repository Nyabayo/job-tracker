import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { withUser } from "@/lib/db";
import { recordMissingRow } from "@/lib/db/owned";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { s3, userPrefix, deleteObjects } from "@/lib/storage";
import { findJob, NotFoundError, timeline } from "@/lib/board/service";
import { cleanFileName, detectFileType } from "@/lib/documents/filetype";
import { scanBuffer } from "@/lib/documents/scan";
import type { DocumentType } from "@/lib/generated/prisma/enums";

// E1 to E3: files attached to a job. Every file is type-checked by its bytes,
// size-limited and scanned by ClamAV BEFORE anything is stored. Files live
// under a random key in a private bucket and are only ever served through
// /api/documents/[id], which checks ownership.

export class UploadError extends Error {}

export async function uploadDocument(userId: string, jobId: string, type: DocumentType, file: File): Promise<void> {
  const max = env().MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size === 0) throw new UploadError("That file is empty.");
  if (file.size > max) throw new UploadError(`That file is too big. The limit is ${env().MAX_UPLOAD_MB} MB.`);
  const data = new Uint8Array(await file.arrayBuffer());
  if (data.length > max) throw new UploadError(`That file is too big. The limit is ${env().MAX_UPLOAD_MB} MB.`);
  const kind = detectFileType(data);
  if (!kind) throw new UploadError("Only PDF, Word (.docx), PNG and JPG files can be uploaded.");

  // Check the job exists and is ours before spending time on the scan.
  await withUser(userId, (tx) => findJob(tx, userId, jobId));

  const scan = await scanBuffer(data);
  if (scan.status === "INFECTED") {
    await audit({ event: "UPLOAD", userId, detail: { rejected: "infected", signature: scan.signature } });
    throw new UploadError("That file contains malware, so it was not saved.");
  }
  if (scan.status === "FAILED") throw new UploadError("We couldn't check that file for viruses right now, so it wasn't saved. Please try again in a few minutes.");

  const storageKey = `${userPrefix(userId)}${randomBytes(24).toString("base64url")}`;
  const sha256 = createHash("sha256").update(data).digest("hex");
  await s3().send(new PutObjectCommand({ Bucket: env().S3_BUCKET, Key: storageKey, Body: data, ContentType: kind.mime }));
  const originalName = cleanFileName(file.name);
  try {
    await withUser(userId, async (tx) => {
      const job = await findJob(tx, userId, jobId);
      const doc = await tx.document.create({
        data: { userId, type, originalName, storageKey, mimeType: kind.mime, sizeBytes: data.length, sha256, scanStatus: "CLEAN" },
        select: { id: true },
      });
      await tx.jobDocument.create({ data: { userId, jobId: job.id, documentId: doc.id }, select: { jobId: true } });
      await timeline(tx, userId, job.id, "DOCUMENT_ADDED", { name: originalName });
      await tx.job.update({ where: { id: job.id }, data: { lastActivityAt: new Date() }, select: { id: true } });
    });
  } catch (err) {
    await deleteObjects([storageKey]).catch(() => {});
    throw err;
  }
  await audit({ event: "UPLOAD", userId, detail: { type, sizeBytes: data.length, mime: kind.mime } });
}

/** Returns the file for its owner only; null (404) otherwise, audited. */
export async function readDocument(userId: string, documentId: string) {
  const doc = await withUser(userId, async (tx) => {
    const row = await tx.document.findFirst({ where: { id: documentId } });
    if (!row) await recordMissingRow(tx, userId, "documents", documentId);
    return row;
  });
  if (!doc || doc.scanStatus !== "CLEAN") return null;
  const obj = await s3().send(new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: doc.storageKey }));
  if (!obj.Body) return null;
  return { doc, body: obj.Body.transformToWebStream() };
}

export async function deleteDocument(userId: string, documentId: string): Promise<string | null> {
  const result = await withUser(userId, async (tx) => {
    const doc = await tx.document.findFirst({ where: { id: documentId }, include: { jobs: { select: { jobId: true } } } });
    if (!doc) {
      await recordMissingRow(tx, userId, "documents", documentId);
      throw new NotFoundError();
    }
    await tx.document.delete({ where: { id: doc.id }, select: { id: true } });
    return { key: doc.storageKey, jobId: doc.jobs[0]?.jobId ?? null };
  });
  await deleteObjects([result.key]).catch((err: unknown) => console.error("[storage]", err));
  return result.jobId;
}
