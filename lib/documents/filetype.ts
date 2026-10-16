// E1b: the real file type comes from its first bytes (magic numbers), never
// from the name or the browser's claimed type. Only PDF, DOCX, PNG and JPG.

export type AllowedType = { mime: string; ext: "pdf" | "docx" | "png" | "jpg"; inline: boolean };

const PDF: AllowedType = { mime: "application/pdf", ext: "pdf", inline: true };
const PNG: AllowedType = { mime: "image/png", ext: "png", inline: true };
const JPG: AllowedType = { mime: "image/jpeg", ext: "jpg", inline: true };
const DOCX: AllowedType = { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx", inline: false };

const startsWith = (buf: Uint8Array, bytes: number[]) => bytes.every((b, i) => buf[i] === b);

export function detectFileType(buf: Uint8Array): AllowedType | null {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return PDF; // %PDF-
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return PNG;
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return JPG;
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    // A DOCX is a ZIP holding [Content_Types].xml and a word/ folder. Other
    // ZIPs (and macro-enabled .docm) are refused.
    const text = Buffer.from(buf).toString("latin1");
    if (text.includes("[Content_Types].xml") && text.includes("word/") && !text.includes("vbaProject.bin")) return DOCX;
  }
  return null;
}

/** File name safe to show and to put in a Content-Disposition header. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
  return cleaned || "file";
}
