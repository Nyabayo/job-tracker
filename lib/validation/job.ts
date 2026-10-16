import { z } from "zod";
import {
  CONTACT_RELATIONSHIPS, CURRENCIES, EMPLOYMENT_TYPES, INTERVIEW_TYPES, SALARY_PERIODS, SORTS, TASK_KINDS, WORK_TYPES,
} from "@/lib/board/constants";
import {
  optionalDate, optionalDateTime, optionalEnum, optionalMoney, optionalText, optionalUrl, optionalUuid, requiredText, requiredUrl, uuidField,
} from "@/lib/validation/forms";

// C1, D1 to D6: the job record. Only title and company are required.
export const jobSchema = z
  .object({
    title: requiredText(200, "Enter the job title."),
    companyName: requiredText(200, "Enter the company name."),
    companyUrl: optionalUrl,
    jobPostUrl: optionalUrl,
    jobBoardName: optionalText(100),
    jobBoardUrl: optionalUrl,
    location: optionalText(200),
    country: z
      .preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() || null : v), z.string().regex(/^[A-Z]{2}$/, "Use a two-letter country code, like KE.").nullish())
      .transform((v) => v ?? null),
    workType: optionalEnum(WORK_TYPES),
    employmentType: optionalEnum(EMPLOYMENT_TYPES),
    salaryMin: optionalMoney,
    salaryMax: optionalMoney,
    salaryCurrency: optionalEnum(CURRENCIES),
    salaryPeriod: optionalEnum(SALARY_PERIODS),
    excitement: z
      .preprocess((v) => (v === "" || v === "0" || v === undefined ? null : v), z.coerce.number().int().min(1).max(5).nullable())
      .transform((v) => v ?? null),
    dateApplied: optionalDate,
    deadline: optionalDate,
    stageId: optionalUuid,
    // Raw HTML from the link import (C2/C3); sanitised on the server before saving.
    descriptionHtml: z.preprocess((v) => (v === "" ? null : v), z.string().max(200_000, "That description is too long.").nullish()).transform((v) => v ?? null),
  })
  .refine((v) => v.salaryMin === null || v.salaryMax === null || v.salaryMin <= v.salaryMax, {
    path: ["salaryMax"],
    message: "The maximum must be at least the minimum.",
  });

export type JobInput = z.output<typeof jobSchema>;

export const moveJobSchema = z.object({
  jobId: uuidField,
  stageId: uuidField,
  // The cards directly above and below the drop point, in the target stage.
  aboveId: optionalUuid,
  belowId: optionalUuid,
});

export const jobIdSchema = z.object({ jobId: uuidField });

export const linkSchema = z.object({
  jobId: uuidField,
  label: requiredText(100, "Give the link a name."),
  url: requiredUrl,
});

export const tagsSchema = z.object({
  jobId: uuidField,
  tags: z
    .string()
    .max(1000)
    .transform((v) =>
      [...new Set(v.split(",").map((t) => t.trim().replace(/\s+/g, " ")).filter(Boolean))].slice(0, 20),
    )
    .refine((tags) => tags.every((t) => t.length <= 50), "Keep each tag to 50 characters or fewer."),
});

export const noteSchema = z.object({
  jobId: uuidField,
  content: requiredText(20_000, "Write something first."),
});

const phone = z
  .preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(50).regex(/^[+0-9 ()\-.]{3,50}$/, "Use digits, spaces and + ( ) - only.").nullish())
  .transform((v) => v ?? null);

const optionalEmail = z
  .preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().toLowerCase().max(320).pipe(z.email("Enter a valid email address.")).nullish())
  .transform((v) => v ?? null);

export const contactSchema = z.object({
  jobId: uuidField,
  name: requiredText(200, "Enter the contact's name."),
  relationship: optionalEnum(CONTACT_RELATIONSHIPS).transform((v) => v ?? "OTHER"),
  role: optionalText(200),
  company: optionalText(200),
  email: optionalEmail,
  phone,
  linkedinUrl: optionalUrl,
  notes: optionalText(5000),
  lastContactedAt: optionalDate,
});

export const taskSchema = z.object({
  jobId: optionalUuid,
  title: requiredText(200, "Enter what needs doing."),
  kind: optionalEnum(TASK_KINDS).transform((v) => v ?? "TASK"),
  interviewType: optionalEnum(INTERVIEW_TYPES),
  dueAt: optionalDateTime,
  remindAt: optionalDateTime,
  notes: optionalText(5000),
});

export const taskIdSchema = z.object({ taskId: uuidField });

const filterText = (max: number) => z.string().trim().max(max).optional().catch(undefined).transform((v) => v || undefined);
const filterDate = z.iso.date().optional().catch(undefined);

/** B6: board filters from the URL. Invalid values are ignored, never trusted. */
export const boardFilterSchema = z.object({
  q: filterText(200),
  stage: z.uuid().optional().catch(undefined),
  board: filterText(100),
  from: filterDate,
  to: filterDate,
  rating: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
  workType: z.enum(WORK_TYPES).optional().catch(undefined),
  country: z.string().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase()).optional().catch(undefined),
  tag: z.uuid().optional().catch(undefined),
  sort: z.enum(Object.keys(SORTS) as [keyof typeof SORTS, ...(keyof typeof SORTS)[]]).optional().catch(undefined),
});

export type BoardFilters = z.output<typeof boardFilterSchema>;

/** Reads the first value of each search param. */
export function firstParams(params: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    Object.defineProperty(out, key, { value: Array.isArray(value) ? value[0] : value, enumerable: true });
  }
  return out;
}
