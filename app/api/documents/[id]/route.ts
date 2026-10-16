import { currentUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/db/owned";
import { readDocument } from "@/lib/documents/service";

// E1, E3: the only way to read a stored file. The owner check runs on every
// request (RLS + audited 404 for anyone else). Files are streamed from the
// private bucket, so the storage server is never exposed to browsers.
// PDFs and images can open inline (preview); Word files always download.

const INLINE = new Set(["application/pdf", "image/png", "image/jpeg"]);

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await params;
  if (!user || !isUuid(id)) return notFound();
  const file = await readDocument(user.id, id);
  if (!file) return notFound();
  const download = new URL(request.url).searchParams.get("download") === "1";
  const disposition = INLINE.has(file.doc.mimeType) && !download ? "inline" : "attachment";
  const ascii = file.doc.originalName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(file.body, {
    headers: {
      "Content-Type": file.doc.mimeType,
      "Content-Length": String(file.doc.sizeBytes),
      "Content-Disposition": `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.doc.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      // A file can never run script in this site's origin, even if opened directly.
      // (Browsers refuse to show PDFs in a sandboxed document, so PDFs get
      // default-src 'none' only; their own viewer runs outside this origin.)
      "Content-Security-Policy": file.doc.mimeType === "application/pdf" ? "default-src 'none'" : "default-src 'none'; img-src 'self'; sandbox",
    },
  });
}
