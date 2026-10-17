import { beforeAll, describe, expect, it } from "vitest";
import { withUser } from "@/lib/db";
import { createJob, getJobDetail, loadBoard, moveJob, NotFoundError, setArchived, updateJob, deleteJob, listArchived } from "@/lib/board/service";
import { addContact, addLink, addNote, addTask, removeTask, setTags, setTaskDone } from "@/lib/board/details";
import { exportData } from "@/lib/export";
import { runReminders } from "@/lib/jobs/reminders";
import { jobSchema } from "@/lib/validation/job";
import { asOwner, createUser } from "./helpers";

// Sprint 2 to 4 acceptance tests for the board and job records, against a
// real Postgres with RLS, as the app's own roles.

type Stages = Record<"Wishlist" | "Applied" | "Interview" | "Offer" | "Rejected", string>;

async function stagesOf(userId: string): Promise<Stages> {
  const rows = await withUser(userId, (tx) => tx.stage.findMany());
  return Object.fromEntries(rows.map((s) => [s.name, s.id])) as Stages;
}

const job = (fields: Record<string, unknown>) => jobSchema.parse(fields);

let alice: { id: string };
let bob: { id: string };
let aStages: Stages;
let bStages: Stages;
let bobJob: string;
let bobTask: string;

beforeAll(async () => {
  alice = await createUser("alice-board");
  bob = await createUser("bob-board");
  aStages = await stagesOf(alice.id);
  bStages = await stagesOf(bob.id);
  bobJob = (await createJob(bob.id, job({ title: "Bob's secret job", companyName: "Bob Co", stageId: bStages.Applied }))).id;
  await addTask(bob.id, { jobId: bobJob, title: "Bob task", kind: "TASK", interviewType: null, dueAt: null, remindAt: null, notes: null });
  bobTask = (await withUser(bob.id, (tx) => tx.task.findFirstOrThrow({ select: { id: true } }))).id;
});

async function deniedTargets(userId: string): Promise<string[]> {
  const rows = await asOwner<{ detail: { id: string } }>("SELECT detail FROM audit_logs WHERE event = 'ACCESS_DENIED' AND user_id = $1", [userId]);
  return rows.map((r) => r.detail.id);
}

describe("C1, B1: adding jobs", () => {
  it("a new job goes to the top of Wishlist with a CREATED timeline event", async () => {
    const first = await createJob(alice.id, job({ title: "First", companyName: "Acme" }));
    const second = await createJob(alice.id, job({ title: "Second", companyName: "Acme" }));
    const board = await loadBoard(alice.id, { q: undefined, board: undefined });
    const wishlist = board.cards.filter((c) => c.stageId === aStages.Wishlist).map((c) => c.id);
    expect(wishlist.slice(0, 2)).toEqual([second.id, first.id]);
    const detail = await getJobDetail(alice.id, first.id);
    expect(detail?.timelineEvents.map((e) => e.type)).toEqual(["CREATED"]);
  });

  it("C3: the description is sanitised and saved with its date", async () => {
    const { id } = await createJob(alice.id, job({ title: "Desc", companyName: "Acme", descriptionHtml: "<p>Hi</p><script>alert(1)</script><a href='javascript:x'>x</a>" }));
    const detail = await getJobDetail(alice.id, id);
    expect(detail?.descriptionHtml).toBe("<p>Hi</p><a>x</a>");
    expect(detail?.descriptionSavedAt).toBeInstanceOf(Date);
  });
});

describe("B2, B3, D3, G2: moving cards", () => {
  it("B2: Applied to Interview persists, updates counts and writes STAGE_CHANGED", async () => {
    const { id } = await createJob(alice.id, job({ title: "Mover", companyName: "Acme", stageId: aStages.Applied }));
    const before = await loadBoard(alice.id, { q: undefined, board: undefined });
    const count = (b: typeof before, s: string) => b.cards.filter((c) => c.stageId === s).length;
    const result = await moveJob(alice.id, { jobId: id, stageId: aStages.Interview, aboveId: null, belowId: null });
    expect(result.stageName).toBe("Interview");
    expect(result.from.stageId).toBe(aStages.Applied);
    const after = await loadBoard(alice.id, { q: undefined, board: undefined });
    expect(count(after, aStages.Interview)).toBe(count(before, aStages.Interview) + 1);
    expect(count(after, aStages.Applied)).toBe(count(before, aStages.Applied) - 1);
    const detail = await getJobDetail(alice.id, id);
    expect(detail?.stageId).toBe(aStages.Interview);
    expect(detail?.timelineEvents[0]?.type).toBe("STAGE_CHANGED");
    expect(detail?.timelineEvents[0]?.payload).toEqual({ from: "Applied", to: "Interview" });
  });

  it("drops a card exactly between its neighbours", async () => {
    const ids = [];
    for (const t of ["c", "b", "a"]) ids.unshift((await createJob(alice.id, job({ title: t, companyName: "Order", stageId: aStages.Offer }))).id);
    const [a, b, c] = ids as [string, string, string];
    await moveJob(alice.id, { jobId: c, stageId: aStages.Offer, aboveId: a, belowId: b });
    const board = await loadBoard(alice.id, { q: "", board: undefined });
    const order = board.cards.filter((x) => x.stageId === aStages.Offer && [a, b, c].includes(x.id)).map((x) => x.id);
    expect(order).toEqual([a, c, b]);
  });

  it("D3, G2: the first move to Applied sets the date applied and flags a follow-up", async () => {
    const { id } = await createJob(alice.id, job({ title: "Apply", companyName: "Acme" }));
    const result = await moveJob(alice.id, { jobId: id, stageId: aStages.Applied, aboveId: null, belowId: null });
    expect(result.movedToApplied).toBe(true);
    expect((await getJobDetail(alice.id, id))?.dateApplied).toBeInstanceOf(Date);
  });

  it("D1 to D6: editing records which fields changed", async () => {
    const { id } = await createJob(alice.id, job({ title: "Edit", companyName: "Acme" }));
    await updateJob(alice.id, id, job({ title: "Edited", companyName: "Acme", excitement: "4", workType: "REMOTE" }));
    const detail = await getJobDetail(alice.id, id);
    expect(detail?.title).toBe("Edited");
    expect(detail?.timelineEvents[0]?.payload).toEqual({ fields: ["title", "workType", "excitement"] });
  });
});

describe("B6, B9: filters and archive", () => {
  it("search and filters narrow the board", async () => {
    await createJob(alice.id, job({ title: "Unique Rustacean", companyName: "Ferris Ltd", workType: "HYBRID", excitement: "5", country: "KE" }));
    const byText = await loadBoard(alice.id, { q: "rustacean", board: undefined });
    expect(byText.cards.map((c) => c.title)).toEqual(["Unique Rustacean"]);
    const byFilters = await loadBoard(alice.id, { q: undefined, board: undefined, workType: "HYBRID", rating: 5, country: "KE" });
    expect(byFilters.cards.every((c) => c.workType === "HYBRID")).toBe(true);
  });

  it("archived jobs leave the board and come back on restore", async () => {
    const { id } = await createJob(alice.id, job({ title: "Archive me", companyName: "Acme" }));
    await setArchived(alice.id, id, true);
    expect((await loadBoard(alice.id, { q: undefined, board: undefined })).cards.some((c) => c.id === id)).toBe(false);
    expect((await listArchived(alice.id, { q: "archive me", board: undefined })).map((j) => j.id)).toEqual([id]);
    await setArchived(alice.id, id, false);
    expect((await loadBoard(alice.id, { q: undefined, board: undefined })).cards.some((c) => c.id === id)).toBe(true);
    const types = (await getJobDetail(alice.id, id))?.timelineEvents.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["ARCHIVED", "RESTORED"]));
  });

  it("deleting a job removes it and its children", async () => {
    const { id } = await createJob(alice.id, job({ title: "Delete me", companyName: "Acme" }));
    await addNote(alice.id, { jobId: id, content: "bye", format: "text" });
    await deleteJob(alice.id, id);
    expect(await getJobDetail(alice.id, id)).toBeNull();
    expect(await asOwner("SELECT id FROM notes WHERE job_id = $1", [id])).toEqual([]);
  });
});

describe("D7 to D9, F1, G1: job details", () => {
  it("D9: rich text notes keep formatting but lose scripts, handlers and bad links", async () => {
    const { id } = await createJob(alice.id, job({ title: "Rich", companyName: "Acme" }));
    await addNote(alice.id, {
      jobId: id,
      format: "html",
      content: '<h2>Call</h2><p><strong>Ask</strong> <a href="javascript:alert(1)">x</a> <a href="https://acme.test" onclick="evil()">site</a></p><script>alert(1)</script><img src=x onerror=alert(1)>',
    });
    await expect(addNote(alice.id, { jobId: id, format: "html", content: "<p><br></p>" })).rejects.toThrow();
    const d = await getJobDetail(alice.id, id);
    expect(d?.notes).toHaveLength(1);
    expect(d?.notes[0]?.contentHtml).toBe('<h2>Call</h2><p><strong>Ask</strong> <a>x</a> <a href="https://acme.test">site</a></p>');
  });

  it("links, tags, notes, contacts and tasks attach to the job", async () => {
    const { id } = await createJob(alice.id, job({ title: "Full", companyName: "Acme" }));
    await addLink(alice.id, { jobId: id, label: "Careers", url: "https://acme.test/careers" });
    await setTags(alice.id, id, ["remote", "fintech"]);
    await addNote(alice.id, { jobId: id, content: "Spoke to <b>HR</b>", format: "text" });
    await addContact(alice.id, { jobId: id, name: "Amina", relationship: "RECRUITER", role: null, company: null, email: "amina@acme.test", phone: null, linkedinUrl: null, notes: null, lastContactedAt: null });
    await addTask(alice.id, { jobId: id, title: "Interview", kind: "INTERVIEW", interviewType: "VIDEO", dueAt: new Date(Date.now() + 86_400_000), remindAt: null, notes: null });
    const d = await getJobDetail(alice.id, id);
    expect(d?.links.map((l) => l.label)).toEqual(["Careers"]);
    expect(d?.tags.map((t) => t.tag.name).sort()).toEqual(["fintech", "remote"]);
    expect(d?.notes[0]?.contentHtml).toBe("<p>Spoke to &lt;b&gt;HR&lt;/b&gt;</p>");
    expect(d?.contacts[0]?.relationship).toBe("RECRUITER");
    expect(d?.tasks[0]?.interviewType).toBe("VIDEO");
    await setTaskDone(alice.id, d?.tasks[0]?.id as string, true);
    expect((await getJobDetail(alice.id, id))?.timelineEvents.some((e) => e.type === "TASK_COMPLETED")).toBe(true);
  });
});

describe("A5: another user's jobs are a 404 everywhere", () => {
  it("reading B's job returns nothing and is audited", async () => {
    expect(await getJobDetail(alice.id, bobJob)).toBeNull();
    expect(await deniedTargets(alice.id)).toContain(bobJob);
  });

  it("every write on B's job is refused", async () => {
    const attempts = [
      () => moveJob(alice.id, { jobId: bobJob, stageId: aStages.Offer, aboveId: null, belowId: null }),
      () => updateJob(alice.id, bobJob, job({ title: "pwned", companyName: "x" })),
      () => setArchived(alice.id, bobJob, true),
      () => deleteJob(alice.id, bobJob),
      () => addNote(alice.id, { jobId: bobJob, content: "x", format: "text" }),
      () => addLink(alice.id, { jobId: bobJob, label: "x", url: "https://x.test" }),
      () => setTags(alice.id, bobJob, ["x"]),
      () => removeTask(alice.id, bobTask),
      () => setTaskDone(alice.id, bobTask, true),
    ];
    for (const attempt of attempts) await expect(attempt()).rejects.toBeInstanceOf(NotFoundError);
    const bobView = await getJobDetail(bob.id, bobJob);
    expect(bobView?.title).toBe("Bob's secret job");
    expect(bobView?.archivedAt).toBeNull();
    expect(bobView?.notes).toEqual([]);
    expect(bobView?.tasks[0]?.completedAt).toBeNull();
  });

  it("A can't move a job into B's stage, or position it using B's cards", async () => {
    const { id } = await createJob(alice.id, job({ title: "Mine", companyName: "Acme" }));
    await expect(moveJob(alice.id, { jobId: id, stageId: bStages.Applied, aboveId: null, belowId: null })).rejects.toBeInstanceOf(NotFoundError);
    // B's card as a neighbour is simply not found under RLS, so it is ignored.
    const r = await moveJob(alice.id, { jobId: id, stageId: aStages.Applied, aboveId: bobJob, belowId: null });
    expect(r.stageName).toBe("Applied");
    expect(await createJob(alice.id, job({ title: "x", companyName: "y", stageId: bStages.Offer })).catch((e: unknown) => e)).toBeInstanceOf(NotFoundError);
  });

  it("A6: an export contains only my data and no secrets", async () => {
    const data = await exportData(alice.id);
    const text = JSON.stringify(data);
    expect(text).not.toContain("Bob's secret job");
    expect(text).not.toContain(bob.id);
    expect(text).not.toMatch(/passwordHash|totpSecret|storageKey|sessionToken/);
    expect(data.jobs.length).toBeGreaterThan(5);
  });
});

describe("G1, G5: reminders", () => {
  it("a due reminder becomes one in-app notification for its owner only", async () => {
    const { id } = await createJob(alice.id, job({ title: "Remind", companyName: "Acme" }));
    const past = new Date(Date.now() - 60_000);
    await addTask(alice.id, { jobId: id, title: "Send portfolio", kind: "TASK", interviewType: null, dueAt: new Date(Date.now() + 3_600_000), remindAt: past, notes: null });
    await createJob(alice.id, job({ title: "Closing", companyName: "Soon Ltd", deadline: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) }));
    expect(await runReminders()).toBeGreaterThanOrEqual(2);
    expect(await runReminders()).toBe(0); // each fires once
    const mine = await withUser(alice.id, (tx) => tx.notification.findMany());
    expect(mine.map((n) => n.title)).toEqual(expect.arrayContaining(["Reminder: Send portfolio", "Deadline soon: Closing at Soon Ltd"]));
    expect(await withUser(bob.id, (tx) => tx.notification.count())).toBe(0);
  });

  it("the app role can't call the reminder functions", async () => {
    await expect(withUser(alice.id, (tx) => tx.$queryRaw`SELECT * FROM claim_due_reminders(10)`)).rejects.toThrow(/permission denied/);
  });
});
