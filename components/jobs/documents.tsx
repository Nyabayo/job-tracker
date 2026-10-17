"use client";

import { useRef, useState } from "react";
import { Download, Eye, FileImage, FileText, Trash2, Upload } from "lucide-react";
import { ActionForm, useFormPending } from "@/components/ui/action-form";
import { ActionButton } from "@/components/ui/confirm-button";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { LocalTime } from "@/components/ui/local-time";
import { deleteDocumentAction, uploadDocumentAction } from "@/app/(app)/documents/actions";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "CV", label: "CV" },
  { value: "COVER_LETTER", label: "Cover letter" },
  { value: "ACADEMIC_CERT", label: "Academic certificate" },
  { value: "PROFESSIONAL_CERT", label: "Professional certificate" },
  { value: "TESTIMONIAL", label: "Testimonial" },
  { value: "RECOMMENDATION", label: "Recommendation letter" },
  { value: "OTHER", label: "Other" },
];
const typeLabel = (t: string) => TYPES.find((x) => x.value === t)?.label ?? t;

export type DocumentView = {
  id: string;
  type: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: string;
  createdAt: Date | string;
};

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function UploadButton({ disabled }: { disabled: boolean }) {
  const pending = useFormPending();
  return (
    <Button type="submit" disabled={pending || disabled}>
      <Upload aria-hidden="true" className="size-4" />
      {pending ? "Uploading and scanning..." : "Upload file"}
    </Button>
  );
}

/** E1 to E3: drag-and-drop zone on desktop, a plain file button on phones. */
export function DocumentsPanel({ jobId, documents, maxMb }: { jobId: string; documents: DocumentView[]; maxMb: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);
  // Checked here too so a big file isn't sent at all; the server checks again.
  const pick = (files: FileList | null) => {
    const file = files?.[0];
    setChosen(file?.name ?? null);
    setTooBig(Boolean(file && file.size > maxMb * 1024 * 1024));
  };
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
      <ul className="flex flex-col gap-3">
        {documents.length === 0 ? <li className="text-secondary">No files yet. Upload the exact CV and cover letter you sent for this job.</li> : null}
        {documents.map((d) => {
          const Icon = d.mimeType.startsWith("image/") ? FileImage : FileText;
          const previewable = d.mimeType === "application/pdf" || d.mimeType.startsWith("image/");
          return (
            <li key={d.id}>
              <Card className="flex flex-wrap items-center gap-3 p-3">
                <Icon aria-hidden="true" className="size-8 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="break-all font-semibold">{d.originalName}</p>
                  <p className="text-sm text-secondary">
                    {typeLabel(d.type)} · {size(d.sizeBytes)} · <LocalTime value={d.createdAt} dateOnly /> ·{" "}
                    <span className={cn(d.scanStatus === "CLEAN" ? "text-success" : "text-danger", "font-semibold")}>
                      {d.scanStatus === "CLEAN" ? "Virus-checked" : "Not checked"}
                    </span>
                  </p>
                </div>
                <div className="flex gap-1">
                  {previewable ? (
                    <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="flex size-11 items-center justify-center rounded-[var(--radius-control)] hover:bg-primary-soft" aria-label={`Preview ${d.originalName}`}>
                      <Eye aria-hidden="true" className="size-5" />
                    </a>
                  ) : null}
                  <a href={`/api/documents/${d.id}?download=1`} className="flex size-11 items-center justify-center rounded-[var(--radius-control)] hover:bg-primary-soft" aria-label={`Download ${d.originalName}`}>
                    <Download aria-hidden="true" className="size-5" />
                  </a>
                  <ActionButton action={deleteDocumentAction} values={{ id: d.id }} variant="ghost" size="icon" label={`Delete ${d.originalName}`} confirm="Delete?">
                    <Trash2 aria-hidden="true" className="size-4" />
                  </ActionButton>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <Card className="p-4">
        <h2 className="mb-3 text-lg font-bold">Upload a file</h2>
        <ActionForm action={uploadDocumentAction} label="Upload a file" resetOnSuccess onSuccess={() => pick(null)} className="flex flex-col gap-4">
          <input type="hidden" name="jobId" value={jobId} />
          <SelectField name="type" label="What is it?" defaultValue="CV" options={TYPES} />
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (input.current && e.dataTransfer.files.length > 0) {
                input.current.files = e.dataTransfer.files;
                pick(e.dataTransfer.files);
              }
            }}
            className={cn("hidden flex-col items-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-border p-6 text-center lg:flex", over && "border-primary bg-primary-soft")}
          >
            <Upload aria-hidden="true" className="size-6 text-secondary" />
            <p className="text-sm text-secondary">Drop a file here, or use the button below</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="document-file" className="text-sm font-semibold">
              File
            </label>
            <input
              ref={input}
              id="document-file"
              name="file"
              type="file"
              required
              accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
              onChange={(e) => pick(e.target.files)}
              aria-invalid={tooBig ? true : undefined}
              aria-describedby="document-file-hint"
              className="min-h-11 text-sm file:mr-3 file:min-h-11 file:rounded-[var(--radius-control)] file:border file:border-border file:bg-surface file:px-4 file:font-semibold"
            />
            {tooBig ? (
              <p id="document-file-hint" role="alert" className="text-sm font-medium text-danger">
                That file is too big. The limit is {maxMb} MB.
              </p>
            ) : (
              <p id="document-file-hint" className="text-sm text-secondary">
                {chosen ? `Selected: ${chosen}` : `PDF, Word (.docx), PNG or JPG, up to ${maxMb} MB.`}
              </p>
            )}
          </div>
          <div>
            <UploadButton disabled={tooBig} />
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
