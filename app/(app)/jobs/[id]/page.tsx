import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Phone, Trash2, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getJobDetail, listStages } from "@/lib/board/service";
import { isUuid } from "@/lib/db/owned";
import { env } from "@/lib/env";
import { label, stageColorClass } from "@/lib/board/constants";
import { JobForm } from "@/components/jobs/job-form";
import { AddContactForm, AddLinkForm, AddNoteForm, AddTaskForm, TagsForm } from "@/components/jobs/detail-forms";
import { DocumentsPanel } from "@/components/jobs/documents";
import { TaskItem } from "@/components/tasks/task-item";
import { ActionButton } from "@/components/ui/confirm-button";
import { SafeHtml } from "@/components/ui/safe-html";
import { LocalTime } from "@/components/ui/local-time";
import { formatDay } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { Stars } from "@/components/board/job-card";
import { archiveJobAction, removeContactAction, removeLinkAction, removeNoteAction } from "@/app/(app)/jobs/actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Job" };

const TABS = ["overview", "description", "documents", "contacts", "tasks", "notes", "timeline"] as const;
type Tab = (typeof TABS)[number];

const EVENT_TEXT: Record<string, string> = {
  CREATED: "Job added",
  STAGE_CHANGED: "Stage changed",
  FIELD_UPDATED: "Details updated",
  DOCUMENT_ADDED: "Document added",
  CONTACT_ADDED: "Contact added",
  TASK_COMPLETED: "Task completed",
  NOTE_ADDED: "Note added",
  ARCHIVED: "Archived",
  RESTORED: "Restored",
};

function eventDetail(type: string, payload: unknown): string {
  const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  if (type === "STAGE_CHANGED" && typeof p.from === "string" && typeof p.to === "string") return `${p.from} to ${p.to}`;
  if (type === "CREATED" && typeof p.stage === "string") return `in ${p.stage}`;
  if (type === "FIELD_UPDATED" && Array.isArray(p.fields)) return p.fields.filter((f) => typeof f === "string").join(", ");
  if ((type === "CONTACT_ADDED" && typeof p.name === "string") || (type === "TASK_COMPLETED" && typeof p.title === "string")) return String(p.name ?? p.title);
  if (type === "DOCUMENT_ADDED" && typeof p.name === "string") return p.name;
  return "";
}

const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const [job, stages] = await Promise.all([getJobDetail(user.id, id), listStages(user.id)]);
  if (!job) notFound(); // A5: someone else's job is a 404, and audited
  const tabParam = typeof sp.tab === "string" ? sp.tab : "overview";
  const tab: Tab = (TABS as readonly string[]).includes(tabParam) ? (tabParam as Tab) : "overview";
  const openTasks = job.tasks.filter((t) => !t.completedAt).length;
  const counts: Partial<Record<Tab, number>> = {
    documents: job.documents.length,
    contacts: job.contacts.length,
    tasks: openTasks,
    notes: job.notes.length,
  };

  const followUp =
    sp.followup === "1"
      ? (() => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() + 7);
          return { title: `Follow up with ${job.companyName}`, due: `${d.toISOString().slice(0, 10)}T09:00` };
        })()
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Link href={job.archivedAt ? "/archive" : "/board"} className="inline-flex min-h-11 w-fit items-center gap-2 font-semibold text-primary">
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to {job.archivedAt ? "archive" : "board"}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="break-words text-2xl font-bold tab:text-3xl">{job.title}</h1>
          <p className="text-lg text-secondary">
            {job.companyUrl ? (
              <a href={job.companyUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                {job.companyName}
              </a>
            ) : (
              job.companyName
            )}
            {job.location ? ` · ${job.location}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-[var(--radius-chip)] border border-border bg-surface px-3 py-1 text-sm font-semibold">
              <span aria-hidden="true" className={cn("size-2.5 rounded-full", stageColorClass(job.stage.color))} />
              {job.stage.name}
            </span>
            {job.archivedAt ? <span className="rounded-[var(--radius-chip)] bg-accent-soft px-3 py-1 text-sm font-semibold">Archived</span> : null}
            <Stars value={job.excitement} />
            {job.tags.map((t) => (
              <Link key={t.tag.id} href={`/board?tag=${t.tag.id}`} className="rounded-[var(--radius-chip)] bg-primary-soft px-3 py-1 text-sm font-semibold text-text">
                {t.tag.name}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {job.jobPostUrl ? (
            <a href={job.jobPostUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-4 text-sm font-semibold">
              <ExternalLink aria-hidden="true" className="size-4" /> Job post
            </a>
          ) : null}
          <ActionButton action={archiveJobAction} values={{ jobId: job.id, archived: job.archivedAt ? "false" : "true" }} confirm={job.archivedAt ? undefined : "Archive this job?"}>
            {job.archivedAt ? "Restore" : "Archive"}
          </ActionButton>
        </div>
      </header>

      <nav aria-label="Job sections" className="-mx-1 overflow-x-auto px-1">
        <ul className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <li key={t}>
              <Link
                href={`/jobs/${job.id}?tab=${t}`}
                aria-current={tab === t ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 font-semibold capitalize",
                  tab === t ? "border-primary text-primary" : "border-transparent text-secondary hover:text-text",
                )}
              >
                {t}
                {counts[t] ? <span className="ml-1.5 rounded-[var(--radius-chip)] bg-ground px-2 text-xs">{counts[t]}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overview" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="p-4 tab:p-6">
            <JobForm
              jobId={job.id}
              stages={stages}
              initial={{
                title: job.title, companyName: job.companyName, companyUrl: job.companyUrl ?? undefined, jobPostUrl: job.jobPostUrl ?? undefined,
                jobBoardName: job.jobBoardName ?? undefined, jobBoardUrl: job.jobBoardUrl ?? undefined, location: job.location ?? undefined,
                country: job.country ?? undefined, workType: job.workType ?? undefined, employmentType: job.employmentType ?? undefined,
                salaryMin: job.salaryMin?.toString(), salaryMax: job.salaryMax?.toString(), salaryCurrency: job.salaryCurrency ?? undefined,
                salaryPeriod: job.salaryPeriod ?? undefined, excitement: job.excitement ? String(job.excitement) : undefined,
                dateApplied: dateInput(job.dateApplied), deadline: dateInput(job.deadline), stageId: job.stageId,
              }}
            />
          </Card>
          <div className="flex flex-col gap-6">
            <Card className="flex flex-col gap-3 p-4">
              <h2 className="text-lg font-bold">At a glance</h2>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <dt className="text-secondary">Saved</dt>
                <dd>{formatDay(job.dateSaved)}</dd>
                <dt className="text-secondary">Applied</dt>
                <dd>{formatDay(job.dateApplied) || "Not yet"}</dd>
                <dt className="text-secondary">Deadline</dt>
                <dd>{formatDay(job.deadline) || "None"}</dd>
                <dt className="text-secondary">Work type</dt>
                <dd>{label(job.workType) || "Not set"}</dd>
                <dt className="text-secondary">Salary</dt>
                <dd>
                  {job.salaryMin || job.salaryMax
                    ? `${job.salaryCurrency ?? ""} ${[job.salaryMin, job.salaryMax].filter(Boolean).map((n) => Number(n).toLocaleString("en")).join(" to ")} ${label(job.salaryPeriod)}`.trim()
                    : "Not set"}
                </dd>
              </dl>
            </Card>
            <Card className="flex flex-col gap-3 p-4">
              <h2 className="text-lg font-bold">Tags</h2>
              <TagsForm jobId={job.id} tags={job.tags.map((t) => t.tag.name)} />
            </Card>
            <Card className="flex flex-col gap-3 p-4">
              <h2 className="text-lg font-bold">Links</h2>
              {job.links.length === 0 ? <p className="text-sm text-secondary">No extra links yet.</p> : null}
              <ul className="flex flex-col gap-2">
                {job.links.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 min-w-0 items-center gap-2 font-semibold text-primary underline">
                      <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
                      <span className="truncate">{l.label}</span>
                    </a>
                    <ActionButton action={removeLinkAction} values={{ id: l.id }} variant="ghost" size="icon" label={`Remove link ${l.label}`} confirm="Remove?">
                      <Trash2 aria-hidden="true" className="size-4" />
                    </ActionButton>
                  </li>
                ))}
              </ul>
              <AddLinkForm jobId={job.id} />
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "description" ? (
        <Card className="p-4 tab:p-6">
          {job.descriptionHtml ? (
            <>
              <p className="mb-4 text-sm text-secondary">
                Saved on {formatDay(job.descriptionSavedAt)}. This copy stays even if the original post is taken down.
              </p>
              <SafeHtml html={job.descriptionHtml} className="max-w-prose" />
            </>
          ) : (
            <p className="text-secondary">No description saved. Add a job by pasting its link to keep a copy of the description.</p>
          )}
        </Card>
      ) : null}

      {tab === "documents" ? <DocumentsPanel jobId={job.id} documents={job.documents.map((d) => d.document)} maxMb={env().MAX_UPLOAD_MB} /> : null}

      {tab === "contacts" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            {job.contacts.length === 0 ? <p className="text-secondary">No contacts yet. Add the recruiter or hiring manager so you know who to follow up with.</p> : null}
            {job.contacts.map(({ contact: c, relationship }) => (
              <Card key={c.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold">{c.name}</h2>
                    <p className="text-sm text-secondary">{[label(relationship), c.role, c.company].filter(Boolean).join(" · ")}</p>
                  </div>
                  <ActionButton action={removeContactAction} values={{ jobId: job.id, id: c.id }} variant="ghost" size="icon" label={`Remove ${c.name}`} confirm="Remove?">
                    <Trash2 aria-hidden="true" className="size-4" />
                  </ActionButton>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.email ? (
                    <a href={`mailto:${encodeURIComponent(c.email).replace(/%40/g, "@")}`} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-border px-3 text-sm font-semibold">
                      <Mail aria-hidden="true" className="size-4" /> Email
                    </a>
                  ) : null}
                  {c.phone ? (
                    <a href={`tel:${c.phone.replace(/[^+0-9]/g, "")}`} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-border px-3 text-sm font-semibold">
                      <Phone aria-hidden="true" className="size-4" /> Call
                    </a>
                  ) : null}
                  {c.linkedinUrl ? (
                    <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-border px-3 text-sm font-semibold">
                      <UserRound aria-hidden="true" className="size-4" /> LinkedIn
                    </a>
                  ) : null}
                </div>
                {c.email || c.phone ? <p className="text-sm text-secondary">{[c.email, c.phone].filter(Boolean).join(" · ")}</p> : null}
                {c.lastContactedAt ? <p className="text-sm text-secondary">Last contacted {formatDay(c.lastContactedAt)}</p> : null}
                {c.notes ? <p className="whitespace-pre-line text-sm">{c.notes}</p> : null}
              </Card>
            ))}
          </div>
          <Card className="p-4">
            <h2 className="mb-3 text-lg font-bold">Add a contact</h2>
            <AddContactForm jobId={job.id} />
          </Card>
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ul className="flex flex-col gap-3">
            {job.tasks.length === 0 ? <li className="text-secondary">No tasks yet.</li> : null}
            {job.tasks.map((t) => (
              <TaskItem key={t.id} task={t} />
            ))}
          </ul>
          <Card className="p-4">
            <h2 className="mb-3 text-lg font-bold">{followUp ? "Add the follow-up" : "Add a task or interview"}</h2>
            <AddTaskForm jobId={job.id} followUp={followUp} />
          </Card>
        </div>
      ) : null}

      {tab === "notes" ? (
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <AddNoteForm jobId={job.id} />
          </Card>
          {job.notes.map((n) => (
            <Card key={n.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-2 text-sm text-secondary">
                <LocalTime value={n.createdAt} />
                <ActionButton action={removeNoteAction} values={{ id: n.id }} variant="ghost" size="icon" label="Delete note" confirm="Delete?">
                  <Trash2 aria-hidden="true" className="size-4" />
                </ActionButton>
              </div>
              <SafeHtml html={n.contentHtml} />
            </Card>
          ))}
        </div>
      ) : null}

      {tab === "timeline" ? (
        <ol className="flex flex-col gap-3">
          {job.timelineEvents.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3">
              <span className="rounded-[var(--radius-chip)] bg-ground px-2 py-0.5 text-xs font-bold">{e.source === "MANUAL" ? "Manual" : label(e.source)}</span>
              <span className="font-semibold">{EVENT_TEXT[e.type] ?? e.type}</span>
              <span className="text-secondary">{eventDetail(e.type, e.payload)}</span>
              <span className="ml-auto text-sm text-secondary">
                <LocalTime value={e.createdAt} />
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
