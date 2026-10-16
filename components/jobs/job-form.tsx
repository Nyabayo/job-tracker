"use client";

import { startTransition as startFormTransition, useActionState, useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { CsrfInput, useCsrfToken } from "@/components/security/csrf";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { CSRF_FIELD } from "@/lib/security/csrf-shared";
import { CURRENCIES, EMPLOYMENT_TYPES, SALARY_PERIODS, WORK_TYPES, label } from "@/lib/board/constants";
import type { ActionResult } from "@/lib/action-result";
import { createJobAction, importJobAction, updateJobAction } from "@/app/(app)/jobs/actions";

export type JobFormValues = {
  title?: string;
  companyName?: string;
  companyUrl?: string;
  jobPostUrl?: string;
  jobBoardName?: string;
  jobBoardUrl?: string;
  location?: string;
  country?: string;
  workType?: string;
  employmentType?: string;
  salaryMin?: string;
  salaryMax?: string;
  salaryCurrency?: string;
  salaryPeriod?: string;
  excitement?: string;
  dateApplied?: string;
  deadline?: string;
  stageId?: string;
  descriptionHtml?: string;
};

const opts = (values: readonly string[]) => values.map((v) => ({ value: v, label: label(v) || v }));

function err(result: ActionResult | null, key: string): string | undefined {
  return result?.fieldErrors?.[key]?.[0];
}

/** C2: paste a link, we fetch the page on the server and pre-fill the form. */
function LinkImport({ onImported }: { onImported: (values: JobFormValues, preview: string | null) => void }) {
  const csrf = useCsrfToken();
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-primary-soft/40 p-4">
      <div className="flex flex-col gap-3 tab:flex-row tab:items-end">
        <div className="flex-1">
          <Field
            label="Paste a job link"
            type="url"
            inputMode="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            hint="We read the page and fill in what we can. You check it before saving."
          />
        </div>
        <Button
          variant="secondary"
          disabled={pending || !url}
          onClick={() =>
            start(async () => {
              const res = await importJobAction({ url, [CSRF_FIELD]: csrf });
              setResult(res);
              if (res.ok && res.job) {
                const j = res.job;
                const s = (v: string | number | null) => (v === null ? undefined : String(v));
                const preview = j.descriptionHtml ? j.descriptionHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400) : null;
                onImported(
                  {
                    title: s(j.title), companyName: s(j.companyName), jobPostUrl: j.jobPostUrl, jobBoardName: s(j.jobBoardName), location: s(j.location),
                    country: s(j.country), workType: s(j.workType), employmentType: s(j.employmentType), salaryMin: s(j.salaryMin), salaryMax: s(j.salaryMax),
                    salaryCurrency: s(j.salaryCurrency), salaryPeriod: s(j.salaryPeriod), deadline: s(j.deadline), descriptionHtml: s(j.descriptionHtml),
                  },
                  preview,
                );
              }
            })
          }
        >
          <Link2 aria-hidden="true" className="size-4" />
          {pending ? "Reading the page..." : "Fill in from link"}
        </Button>
      </div>
      {result?.message ? <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert> : null}
    </div>
  );
}

/** C1 and D1 to D6. With `jobId` it edits; without, it adds a new job. */
export function JobForm({
  stages,
  initial = {},
  jobId,
  withImport = false,
  defaultCurrency,
}: {
  stages: { id: string; name: string }[];
  initial?: JobFormValues;
  jobId?: string;
  withImport?: boolean;
  defaultCurrency?: string;
}) {
  const [values, setValues] = useState<JobFormValues>(initial);
  const [preview, setPreview] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [result, formAction, pending] = useActionState<ActionResult | null, FormData>(jobId ? updateJobAction : createJobAction, null);
  const v = (k: keyof JobFormValues) => values[k] ?? "";

  return (
    <div className="flex flex-col gap-5">
      {withImport ? (
        <LinkImport
          onImported={(imported, text) => {
            setValues((old) => ({ ...old, ...Object.fromEntries(Object.entries(imported).filter(([, val]) => val !== undefined)) }));
            setPreview(text);
            setVersion((n) => n + 1);
          }}
        />
      ) : null}
      <form
        key={version}
        onSubmit={(e) => {
          // Submitting by hand keeps what was typed if the server rejects it.
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startFormTransition(() => formAction(data));
        }}
        noValidate className="flex flex-col gap-5" aria-label={jobId ? "Edit job" : "Add job"}>
        <CsrfInput />
        {jobId ? <input type="hidden" name="jobId" value={jobId} /> : null}
        {values.descriptionHtml && !jobId ? <input type="hidden" name="descriptionHtml" value={values.descriptionHtml} /> : null}
        {result && !result.ok && result.message ? <Alert tone="danger">{result.message}</Alert> : null}
        {result?.ok && result.message ? <Alert tone="success">{result.message}</Alert> : null}

        <div className="grid grid-cols-1 gap-4 tab:grid-cols-2">
          <Field label="Job title" name="title" required maxLength={200} defaultValue={v("title")} error={err(result, "title")} autoComplete="off" />
          <Field label="Company" name="companyName" required maxLength={200} defaultValue={v("companyName")} error={err(result, "companyName")} autoComplete="organization" />
          <SelectField label="Stage" name="stageId" defaultValue={v("stageId") || stages[0]?.id} options={stages.map((s) => ({ value: s.id, label: s.name }))} />
          <SelectField
            label="Excitement"
            name="excitement"
            defaultValue={v("excitement")}
            placeholder="Not rated"
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? "star" : "stars"}` }))}
          />
        </div>

        <fieldset className="grid grid-cols-1 gap-4 tab:grid-cols-2">
          <legend className="mb-2 text-lg font-bold">Links</legend>
          <Field label="Job post link" name="jobPostUrl" type="url" inputMode="url" defaultValue={v("jobPostUrl")} error={err(result, "jobPostUrl")} />
          <Field label="Company website" name="companyUrl" type="url" inputMode="url" defaultValue={v("companyUrl")} error={err(result, "companyUrl")} />
          <Field label="Job board" name="jobBoardName" maxLength={100} placeholder="e.g. LinkedIn" defaultValue={v("jobBoardName")} error={err(result, "jobBoardName")} />
          <Field label="Job board link" name="jobBoardUrl" type="url" inputMode="url" defaultValue={v("jobBoardUrl")} error={err(result, "jobBoardUrl")} />
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-4 tab:grid-cols-2">
          <legend className="mb-2 text-lg font-bold">Where and how</legend>
          <Field label="Location" name="location" maxLength={200} placeholder="e.g. Nairobi" defaultValue={v("location")} error={err(result, "location")} />
          <Field label="Country code" name="country" maxLength={2} placeholder="e.g. KE" autoCapitalize="characters" defaultValue={v("country")} error={err(result, "country")} />
          <SelectField label="Work type" name="workType" defaultValue={v("workType")} placeholder="Not set" options={opts(WORK_TYPES)} error={err(result, "workType")} />
          <SelectField label="Employment type" name="employmentType" defaultValue={v("employmentType")} placeholder="Not set" options={opts(EMPLOYMENT_TYPES)} error={err(result, "employmentType")} />
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-4 tab:grid-cols-2 lg:grid-cols-4">
          <legend className="mb-2 text-lg font-bold">Salary</legend>
          <Field label="Minimum" name="salaryMin" inputMode="decimal" defaultValue={v("salaryMin")} error={err(result, "salaryMin")} />
          <Field label="Maximum" name="salaryMax" inputMode="decimal" defaultValue={v("salaryMax")} error={err(result, "salaryMax")} />
          <SelectField label="Currency" name="salaryCurrency" defaultValue={v("salaryCurrency") || defaultCurrency || ""} placeholder="Not set" options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          <SelectField label="Period" name="salaryPeriod" defaultValue={v("salaryPeriod")} placeholder="Not set" options={SALARY_PERIODS.map((p) => ({ value: p, label: label(p) }))} />
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-4 tab:grid-cols-2">
          <legend className="mb-2 text-lg font-bold">Dates</legend>
          <Field label="Date applied" name="dateApplied" type="date" defaultValue={v("dateApplied")} error={err(result, "dateApplied")} hint="Set automatically when you move the job to Applied." />
          <Field label="Application deadline" name="deadline" type="date" defaultValue={v("deadline")} error={err(result, "deadline")} />
        </fieldset>

        {preview && !jobId ? (
          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <h2 className="font-bold">Description found</h2>
            <p className="mt-1 text-sm text-secondary">The full description is saved with the job, so you keep it even if the post is taken down.</p>
            <p className="mt-2 text-sm">{preview}...</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : jobId ? "Save changes" : "Save job"}
          </Button>
        </div>
      </form>
    </div>
  );
}
