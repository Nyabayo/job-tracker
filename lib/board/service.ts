import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { withUser, type Tx } from "@/lib/db";
import { ownedOrNull, recordMissingRow } from "@/lib/db/owned";
import { sanitizeRichHtml } from "@/lib/html/sanitize";
import { positionBetween, renumber, POSITION_STEP } from "@/lib/board/position";
import { STAGE } from "@/lib/board/constants";
import type { BoardFilters, JobInput } from "@/lib/validation/job";

// Board and job records (B1 to B9, C1, D1 to D6). Every function runs inside
// withUser(), so row-level security limits it to the signed-in user's rows,
// and every id that came from a request is looked up before use: a miss is
// audited (ACCESS_DENIED when it belongs to someone else) and answered 404.

export class NotFoundError extends Error {
  constructor() {
    super("Not found");
  }
}

export const cardSelect = {
  id: true,
  stageId: true,
  positionInStage: true,
  title: true,
  companyName: true,
  location: true,
  workType: true,
  excitement: true,
  lastActivityAt: true,
  deadline: true,
  jobBoardName: true,
} satisfies Prisma.JobSelect;

export type Card = Prisma.JobGetPayload<{ select: typeof cardSelect }> & { dueSoon: boolean };

async function findStage(tx: Tx, userId: string, stageId: string) {
  const stage = await tx.stage.findFirst({ where: { id: stageId }, select: { id: true, name: true } });
  if (!stage) {
    await recordMissingRow(tx, userId, "stages", stageId);
    throw new NotFoundError();
  }
  return stage;
}

async function findJob(tx: Tx, userId: string, jobId: string) {
  const job = await tx.job.findFirst({ where: { id: jobId } });
  const owned = await ownedOrNull(tx, userId, "jobs", jobId, job);
  if (!owned) throw new NotFoundError();
  return owned;
}

export function listStages(userId: string) {
  return withUser(userId, (tx) =>
    tx.stage.findMany({ where: { hidden: false }, orderBy: { order: "asc" }, select: { id: true, name: true, color: true } }),
  );
}

function orderBy(sort: BoardFilters["sort"]): Prisma.JobOrderByWithRelationInput[] {
  switch (sort) {
    case "updated":
      return [{ lastActivityAt: "desc" }];
    case "created":
      return [{ createdAt: "desc" }];
    case "excitement":
      return [{ excitement: { sort: "desc", nulls: "last" } }, { lastActivityAt: "desc" }];
    case "deadline":
      return [{ deadline: { sort: "asc", nulls: "last" } }];
    case "company":
      return [{ companyName: "asc" }];
    default:
      return [{ positionInStage: "asc" }, { createdAt: "desc" }];
  }
}

export function jobWhere(filters: BoardFilters, archived: boolean): Prisma.JobWhereInput {
  const where: Prisma.JobWhereInput = { archivedAt: archived ? { not: null } : null };
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { companyName: { contains: filters.q, mode: "insensitive" } },
      { location: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.stage) where.stageId = filters.stage;
  if (filters.board) where.jobBoardName = { equals: filters.board, mode: "insensitive" };
  if (filters.rating) where.excitement = { gte: filters.rating };
  if (filters.workType) where.workType = filters.workType;
  if (filters.country) where.country = filters.country;
  if (filters.tag) where.tags = { some: { tagId: filters.tag } };
  if (filters.from || filters.to) {
    where.dateSaved = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
    };
  }
  return where;
}

/** B1, B4, B6: stages with their (filtered, sorted) cards. */
export async function loadBoard(userId: string, filters: BoardFilters) {
  return withUser(userId, async (tx) => {
    const [stages, jobs, tags, boards] = await Promise.all([
      tx.stage.findMany({ where: { hidden: false }, orderBy: { order: "asc" }, select: { id: true, name: true, color: true } }),
      tx.job.findMany({ where: jobWhere(filters, false), orderBy: orderBy(filters.sort), select: cardSelect, take: 2000 }),
      tx.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      tx.job.findMany({ where: { jobBoardName: { not: null } }, distinct: ["jobBoardName"], select: { jobBoardName: true }, take: 100 }),
    ]);
    // B4: bell on cards with an open task due by the end of tomorrow.
    const soon = new Date();
    soon.setUTCDate(soon.getUTCDate() + 2);
    soon.setUTCHours(0, 0, 0, 0);
    const due = await tx.task.findMany({
      where: { completedAt: null, dueAt: { lte: soon }, jobId: { in: jobs.map((j) => j.id) } },
      select: { jobId: true },
      distinct: ["jobId"],
    });
    const dueIds = new Set(due.map((d) => d.jobId));
    const cards: Card[] = jobs.map((j) => ({ ...j, dueSoon: dueIds.has(j.id) }));
    const totalActive = await tx.job.count({ where: { archivedAt: null } });
    return {
      stages,
      cards,
      tags,
      jobBoards: boards.flatMap((b) => (b.jobBoardName ? [b.jobBoardName] : [])),
      totalActive,
    };
  });
}

async function timeline(tx: Tx, userId: string, jobId: string, type: Prisma.TimelineEventCreateManyInput["type"], payload: Prisma.InputJsonValue = {}) {
  await tx.timelineEvent.createMany({ data: [{ userId, jobId, type, payload, source: "MANUAL" }] });
}

function jobData(input: JobInput) {
  const { stageId: _stageId, descriptionHtml, ...rest } = input;
  void _stageId;
  const description = descriptionHtml ? sanitizeRichHtml(descriptionHtml) : null;
  return { ...rest, descriptionHtml: description || null };
}

/** C1 (and C2's review step): creates a job at the top of its stage. */
export async function createJob(userId: string, input: JobInput): Promise<{ id: string }> {
  return withUser(userId, async (tx) => {
    const stage = input.stageId
      ? await findStage(tx, userId, input.stageId)
      : await tx.stage.findFirstOrThrow({ where: { hidden: false }, orderBy: { order: "asc" }, select: { id: true, name: true } });
    const top = await tx.job.findFirst({ where: { stageId: stage.id, archivedAt: null }, orderBy: { positionInStage: "asc" }, select: { positionInStage: true } });
    const data = jobData(input);
    const now = new Date();
    const job = await tx.job.create({
      data: {
        ...data,
        userId,
        stageId: stage.id,
        positionInStage: top ? top.positionInStage - POSITION_STEP : 0,
        dateApplied: data.dateApplied ?? (stage.name === STAGE.APPLIED ? now : null),
        descriptionSavedAt: data.descriptionHtml ? now : null,
      },
      select: { id: true },
    });
    await timeline(tx, userId, job.id, "CREATED", { stage: stage.name });
    return job;
  });
}

const TRACKED_FIELDS = [
  "title", "companyName", "companyUrl", "jobPostUrl", "jobBoardName", "jobBoardUrl", "location", "country", "workType",
  "employmentType", "salaryMin", "salaryMax", "salaryCurrency", "salaryPeriod", "excitement", "dateApplied", "deadline",
] as const;

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) return (a as Date | null)?.getTime() === (b as Date | null)?.getTime();
  if (a !== null && b !== null && typeof a === "object") return String(a) === String(b); // Prisma Decimal
  return a === b;
}

export type MoveResult = {
  movedToApplied: boolean;
  jobId: string;
  stageName: string;
  /** Where the card was, so the browser can offer Undo (B3). */
  from: { stageId: string; aboveId: string | null; belowId: string | null };
};

/** D1 to D6: updates a job, recording what changed on its timeline. */
export async function updateJob(userId: string, jobId: string, input: JobInput): Promise<MoveResult | null> {
  return withUser(userId, async (tx) => {
    const job = await findJob(tx, userId, jobId);
    const data = jobData(input);
    const changed = TRACKED_FIELDS.filter((f) => !same(job[f], data[f]));
    let move: MoveResult | null = null;
    // The description is only replaced when a new one is sent (C3 keeps the snapshot).
    const description = data.descriptionHtml && data.descriptionHtml !== job.descriptionHtml ? { descriptionHtml: data.descriptionHtml, descriptionSavedAt: new Date() } : {};
    await tx.job.update({
      where: { id: job.id },
      data: { ...data, descriptionHtml: undefined, ...description, lastActivityAt: new Date() },
      select: { id: true },
    });
    if (changed.length > 0 || "descriptionHtml" in description) {
      await timeline(tx, userId, job.id, "FIELD_UPDATED", { fields: "descriptionHtml" in description ? [...changed, "description"] : changed });
    }
    if (input.stageId && input.stageId !== job.stageId) {
      move = await moveInTx(tx, userId, { jobId, stageId: input.stageId, aboveId: null, belowId: null });
    }
    return move;
  });
}

async function moveInTx(
  tx: Tx,
  userId: string,
  { jobId, stageId, aboveId, belowId }: { jobId: string; stageId: string; aboveId: string | null; belowId: string | null },
): Promise<MoveResult> {
  const job = await findJob(tx, userId, jobId);
  const [fromStage, toStage] = await Promise.all([
    tx.stage.findFirstOrThrow({ where: { id: job.stageId }, select: { name: true } }),
    findStage(tx, userId, stageId),
  ]);
  const [previousAbove, previousBelow] = await Promise.all([
    tx.job.findFirst({
      where: { stageId: job.stageId, archivedAt: null, positionInStage: { lt: job.positionInStage } },
      orderBy: { positionInStage: "desc" },
      select: { id: true },
    }),
    tx.job.findFirst({
      where: { stageId: job.stageId, archivedAt: null, positionInStage: { gt: job.positionInStage } },
      orderBy: { positionInStage: "asc" },
      select: { id: true },
    }),
  ]);

  // Neighbours are looked up in the target stage, so a client can only point
  // at its own cards there; anything else is ignored.
  const neighbour = async (id: string | null) =>
    id && id !== jobId
      ? tx.job.findFirst({ where: { id, stageId: toStage.id, archivedAt: null }, select: { positionInStage: true } })
      : null;
  let [above, below] = await Promise.all([neighbour(aboveId), neighbour(belowId)]);
  if (!above && !below && !aboveId && !belowId) {
    // No drop point given (Move to menu, stage dropdown): go to the top.
    below = await tx.job.findFirst({
      where: { stageId: toStage.id, archivedAt: null, id: { not: jobId } },
      orderBy: { positionInStage: "asc" },
      select: { positionInStage: true },
    });
  }
  let position = positionBetween(above?.positionInStage ?? null, below?.positionInStage ?? null);
  if (position === null) {
    // Gap too small: renumber the column, then try again.
    const column = await tx.job.findMany({ where: { stageId: toStage.id, archivedAt: null, id: { not: jobId } }, orderBy: { positionInStage: "asc" }, select: { id: true } });
    const positions = renumber(column.length);
    await Promise.all(column.map((c, i) => tx.job.update({ where: { id: c.id }, data: { positionInStage: positions[i] }, select: { id: true } })));
    [above, below] = await Promise.all([neighbour(aboveId), neighbour(belowId)]);
    position = positionBetween(above?.positionInStage ?? null, below?.positionInStage ?? null) ?? 0;
  }

  const stageChanged = toStage.id !== job.stageId;
  const movedToApplied = stageChanged && toStage.name === STAGE.APPLIED;
  await tx.job.update({
    where: { id: job.id },
    data: {
      stageId: toStage.id,
      positionInStage: position,
      lastActivityAt: new Date(),
      // D3: date applied is set automatically the first time a job reaches Applied.
      ...(movedToApplied && !job.dateApplied ? { dateApplied: new Date() } : {}),
    },
    select: { id: true },
  });
  if (stageChanged) {
    await timeline(tx, userId, job.id, "STAGE_CHANGED", { from: fromStage.name, to: toStage.name });
  }
  return {
    movedToApplied,
    jobId: job.id,
    stageName: toStage.name,
    from: { stageId: job.stageId, aboveId: previousAbove?.id ?? null, belowId: previousBelow?.id ?? null },
  };
}

/** B2, B3: moves a card to a stage and position. */
export function moveJob(userId: string, input: { jobId: string; stageId: string; aboveId: string | null; belowId: string | null }) {
  return withUser(userId, (tx) => moveInTx(tx, userId, input));
}

/** B9: archive or restore. */
export async function setArchived(userId: string, jobId: string, archived: boolean): Promise<void> {
  await withUser(userId, async (tx) => {
    const job = await findJob(tx, userId, jobId);
    if (Boolean(job.archivedAt) === archived) return;
    await tx.job.update({ where: { id: job.id }, data: { archivedAt: archived ? new Date() : null, lastActivityAt: new Date() }, select: { id: true } });
    await timeline(tx, userId, job.id, archived ? "ARCHIVED" : "RESTORED");
  });
}

/** Permanent delete (from the Archive page, behind a confirm dialog). Returns the job's file keys. */
export async function deleteJob(userId: string, jobId: string): Promise<string[]> {
  return withUser(userId, async (tx) => {
    const job = await findJob(tx, userId, jobId);
    // Files linked only to this job go with it.
    const docs = await tx.document.findMany({
      where: { jobs: { every: { jobId: job.id }, some: { jobId: job.id } } },
      select: { id: true, storageKey: true },
    });
    await tx.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
    await tx.task.deleteMany({ where: { jobId: job.id } });
    await tx.job.delete({ where: { id: job.id }, select: { id: true } });
    return docs.map((d) => d.storageKey);
  });
}

/** Job detail page (D1 to D10). Returns null (404) for anything not owned. */
export async function getJobDetail(userId: string, jobId: string) {
  return withUser(userId, async (tx) => {
    const job = await tx.job.findFirst({
      where: { id: jobId },
      include: {
        stage: { select: { id: true, name: true, color: true } },
        links: { orderBy: { createdAt: "asc" } },
        tags: { include: { tag: { select: { id: true, name: true } } } },
        notes: { orderBy: { createdAt: "desc" } },
        contacts: { include: { contact: true }, orderBy: { createdAt: "asc" } },
        tasks: { orderBy: [{ completedAt: { sort: "asc", nulls: "first" } }, { dueAt: { sort: "asc", nulls: "last" } }] },
        timelineEvents: { orderBy: { createdAt: "desc" }, take: 200 },
        documents: { include: { document: true }, orderBy: { createdAt: "desc" } },
      },
    });
    return ownedOrNull(tx, userId, "jobs", jobId, job);
  });
}

export type JobDetail = NonNullable<Awaited<ReturnType<typeof getJobDetail>>>;

/** B9: the Archive page. */
export function listArchived(userId: string, filters: BoardFilters) {
  return withUser(userId, (tx) =>
    tx.job.findMany({
      where: jobWhere(filters, true),
      orderBy: { archivedAt: "desc" },
      select: { id: true, title: true, companyName: true, archivedAt: true, stage: { select: { name: true } } },
      take: 500,
    }),
  );
}

export { findJob, timeline };
