"use client";

import { useState } from "react";
import { ActionForm, useFieldError, useFormPending } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { TextareaField } from "@/components/ui/textarea";
import { CONTACT_RELATIONSHIPS, INTERVIEW_TYPES, TASK_KINDS, label } from "@/lib/board/constants";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { addContactAction, addLinkAction, addNoteAction, addTaskAction, setTagsAction } from "@/app/(app)/jobs/actions";

function F(props: React.ComponentProps<typeof Field> & { name: string }) {
  return <Field {...props} error={useFieldError(props.name)} />;
}

function Submit({ children }: { children: React.ReactNode }) {
  const pending = useFormPending();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : children}
    </Button>
  );
}

/** D7 */
export function AddLinkForm({ jobId }: { jobId: string }) {
  return (
    <ActionForm action={addLinkAction} label="Add a link" resetOnSuccess className="grid grid-cols-1 items-end gap-3 tab:grid-cols-[1fr_2fr_auto]">
      <input type="hidden" name="jobId" value={jobId} />
      <F name="label" label="Name" placeholder="e.g. Careers page" maxLength={100} required />
      <F name="url" label="Link" type="url" inputMode="url" placeholder="https://..." required />
      <Submit>Add link</Submit>
    </ActionForm>
  );
}

/** D8 */
export function TagsForm({ jobId, tags }: { jobId: string; tags: string[] }) {
  return (
    <ActionForm action={setTagsAction} label="Tags" className="flex flex-col gap-3 tab:flex-row tab:items-end">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="flex-1">
        <F name="tags" label="Tags" defaultValue={tags.join(", ")} hint="Separate tags with commas, e.g. remote, fintech, referral." maxLength={1000} />
      </div>
      <Submit>Save tags</Submit>
    </ActionForm>
  );
}

/** D9 */
export function AddNoteForm({ jobId }: { jobId: string }) {
  return (
    <ActionForm action={addNoteAction} label="Add a note" resetOnSuccess className="flex flex-col gap-3">
      <input type="hidden" name="jobId" value={jobId} />
      <NoteContent />
      <div>
        <Submit>Add note</Submit>
      </div>
    </ActionForm>
  );
}


/** F1 */
export function AddContactForm({ jobId }: { jobId: string }) {
  return (
    <ActionForm action={addContactAction} label="Add a contact" resetOnSuccess className="grid grid-cols-1 gap-3 tab:grid-cols-2">
      <input type="hidden" name="jobId" value={jobId} />
      <F name="name" label="Name" required maxLength={200} autoComplete="off" />
      <SelectField name="relationship" label="Relationship" defaultValue="RECRUITER" options={CONTACT_RELATIONSHIPS.map((r) => ({ value: r, label: label(r) }))} />
      <F name="role" label="Role" maxLength={200} />
      <F name="company" label="Company" maxLength={200} />
      <F name="email" label="Email" type="email" inputMode="email" maxLength={320} autoComplete="off" />
      <F name="phone" label="Phone" type="tel" inputMode="tel" maxLength={50} autoComplete="off" />
      <F name="linkedinUrl" label="LinkedIn profile" type="url" inputMode="url" placeholder="https://www.linkedin.com/in/..." />
      <F name="lastContactedAt" label="Last contacted" type="date" />
      <div className="tab:col-span-2">
        <ContactNotes />
      </div>
      <div className="tab:col-span-2">
        <Submit>Add contact</Submit>
      </div>
    </ActionForm>
  );
}

function NoteContent() {
  return <RichTextEditor name="content" label="New note" error={useFieldError("content")} placeholder="What happened, what to remember..." />;
}

function ContactNotes() {
  return <TextareaField name="notes" label="Notes" maxLength={5000} error={useFieldError("notes")} />;
}

function toIso(local: FormDataEntryValue | null): string {
  if (typeof local !== "string" || !local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

const REMINDERS = [
  { value: "", label: "No reminder" },
  { value: "0", label: "At the due time" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
];

/** G1, G3: tasks and interviews. Times are entered in local time and sent as ISO. */
export function AddTaskForm({ jobId, followUp }: { jobId: string | null; followUp?: { title: string; due: string } }) {
  const [kind, setKind] = useState<string>(followUp ? "FOLLOW_UP" : "TASK");
  return (
    <ActionForm action={addTaskAction} label="Add a task" resetOnSuccess className="grid grid-cols-1 gap-3 tab:grid-cols-2">
      {jobId ? <input type="hidden" name="jobId" value={jobId} /> : null}
      <F name="title" label="What needs doing?" required maxLength={200} defaultValue={followUp?.title} />
      <SelectField name="kind" label="Type" value={kind} onChange={(e) => setKind(e.target.value)} options={TASK_KINDS.map((k) => ({ value: k, label: label(k) }))} />
      {kind === "INTERVIEW" ? (
        <SelectField name="interviewType" label="Interview type" defaultValue="VIDEO" options={INTERVIEW_TYPES.map((k) => ({ value: k, label: label(k) }))} />
      ) : null}
      <LocalDateTime defaultValue={followUp?.due} />
      <div className="tab:col-span-2">
        <TaskNotes />
      </div>
      <div className="tab:col-span-2">
        <Submit>Add {kind === "INTERVIEW" ? "interview" : "task"}</Submit>
      </div>
    </ActionForm>
  );
}

function TaskNotes() {
  return <TextareaField name="notes" label="Notes" maxLength={5000} className="min-h-20" error={useFieldError("notes")} />;
}

/** Converts the local date/time and reminder choice into ISO fields the server validates. */
function LocalDateTime({ defaultValue }: { defaultValue?: string }) {
  const [due, setDue] = useState(defaultValue ?? "");
  const [remind, setRemind] = useState(defaultValue ? "0" : "");
  const dueIso = toIso(due);
  const remindIso = dueIso && remind !== "" ? new Date(new Date(dueIso).getTime() - Number(remind) * 60_000).toISOString() : "";
  return (
    <>
      <Field label="Due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} error={useFieldError("dueAt")} />
      <SelectField label="Reminder" value={remind} onChange={(e) => setRemind(e.target.value)} options={REMINDERS} disabled={!due} />
      <input type="hidden" name="dueAt" value={dueIso} />
      <input type="hidden" name="remindAt" value={remindIso} />
    </>
  );
}
