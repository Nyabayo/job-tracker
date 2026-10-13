import { beforeAll, describe, expect, it } from "vitest";
import { authDb, withUser } from "@/lib/db";
import { ownedOrNull } from "@/lib/db/owned";
import { asOwner, asRole, createUser } from "./helpers";

// A5 acceptance: given users A and B with data, when A requests any of B's
// jobs, files or contacts by id, nothing is returned or changed, and an
// ACCESS_DENIED audit entry is written.

type Seeded = { userId: string; stageId: string; jobId: string; contactId: string; documentId: string; taskId: string; noteId: string };

async function seed(label: string): Promise<Seeded> {
  const user = await createUser(label);
  return withUser(user.id, async (tx) => {
    const stage = await tx.stage.findFirstOrThrow({ where: { name: "Applied" } });
    const job = await tx.job.create({
      data: { userId: user.id, stageId: stage.id, title: `${label} engineer`, companyName: `${label} Ltd` },
    });
    const contact = await tx.contact.create({ data: { userId: user.id, name: `${label} recruiter` } });
    await tx.jobContact.create({ data: { userId: user.id, jobId: job.id, contactId: contact.id, relationship: "RECRUITER" } });
    const document = await tx.document.create({
      data: {
        userId: user.id,
        type: "CV",
        originalName: `${label}-cv.pdf`,
        storageKey: `users/${user.id}/${crypto.randomUUID()}`,
        mimeType: "application/pdf",
        sizeBytes: 2048,
        sha256: "0".repeat(64),
      },
    });
    await tx.jobDocument.create({ data: { userId: user.id, jobId: job.id, documentId: document.id } });
    const task = await tx.task.create({ data: { userId: user.id, jobId: job.id, title: "Follow up" } });
    const note = await tx.note.create({ data: { userId: user.id, jobId: job.id, contentHtml: "<p>secret</p>" } });
    return { userId: user.id, stageId: stage.id, jobId: job.id, contactId: contact.id, documentId: document.id, taskId: task.id, noteId: note.id };
  });
}

let a: Seeded;
let b: Seeded;

beforeAll(async () => {
  a = await seed("alice");
  b = await seed("bob");
});

describe("A5: cross-user isolation under RLS", () => {
  it("each new user gets the five default stages", async () => {
    const stages = await withUser(a.userId, (tx) => tx.stage.findMany({ orderBy: { order: "asc" } }));
    expect(stages.map((s) => s.name)).toEqual(["Wishlist", "Applied", "Interview", "Offer", "Rejected"]);
    expect(stages.every((s) => s.userId === a.userId)).toBe(true);
  });

  it("A's lists never include B's rows", async () => {
    const seen = await withUser(a.userId, async (tx) => ({
      jobs: await tx.job.findMany(),
      contacts: await tx.contact.findMany(),
      documents: await tx.document.findMany(),
      tasks: await tx.task.findMany(),
      notes: await tx.note.findMany(),
      stages: await tx.stage.findMany(),
      users: await tx.user.findMany(),
    }));
    for (const rows of Object.values(seen)) {
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect("userId" in row ? row.userId : row.id).toBe(a.userId);
    }
  });

  it("looking up B's job, document or contact by its id returns nothing", async () => {
    const found = await withUser(a.userId, async (tx) => [
      await tx.job.findUnique({ where: { id: b.jobId } }),
      await tx.document.findUnique({ where: { id: b.documentId } }),
      await tx.contact.findUnique({ where: { id: b.contactId } }),
      await tx.user.findUnique({ where: { id: b.userId } }),
    ]);
    expect(found).toEqual([null, null, null, null]);
  });

  it("A cannot update or delete B's rows", async () => {
    const counts = await withUser(a.userId, async (tx) => [
      (await tx.job.updateMany({ where: { id: b.jobId }, data: { title: "hacked" } })).count,
      (await tx.contact.deleteMany({ where: { id: b.contactId } })).count,
      (await tx.document.deleteMany({ where: { id: b.documentId } })).count,
      (await tx.task.updateMany({ where: { id: b.taskId }, data: { title: "hacked" } })).count,
    ]);
    expect(counts).toEqual([0, 0, 0, 0]);
    const [job] = await asOwner<{ title: string }>("SELECT title FROM jobs WHERE id = $1", [b.jobId]);
    expect(job?.title).toBe("bob engineer");
  });

  it("A cannot create rows owned by B", async () => {
    await expect(
      withUser(a.userId, (tx) => tx.contact.create({ data: { userId: b.userId, name: "planted" } })),
    ).rejects.toThrow();
  });

  it("A cannot attach their job to B's stage, contact or document", async () => {
    await expect(
      withUser(a.userId, (tx) => tx.job.create({ data: { userId: a.userId, stageId: b.stageId, title: "x", companyName: "y" } })),
    ).rejects.toThrow();
    await expect(
      withUser(a.userId, (tx) => tx.jobContact.create({ data: { userId: a.userId, jobId: a.jobId, contactId: b.contactId } })),
    ).rejects.toThrow();
    await expect(
      withUser(a.userId, (tx) => tx.jobDocument.create({ data: { userId: a.userId, jobId: a.jobId, documentId: b.documentId } })),
    ).rejects.toThrow();
  });

  it("requesting B's job writes an ACCESS_DENIED audit entry; a random id does not", async () => {
    const randomId = crypto.randomUUID();
    const results = await withUser(a.userId, async (tx) => [
      await ownedOrNull(tx, a.userId, "jobs", b.jobId, await tx.job.findUnique({ where: { id: b.jobId } })),
      await ownedOrNull(tx, a.userId, "documents", b.documentId, await tx.document.findUnique({ where: { id: b.documentId } })),
      await ownedOrNull(tx, a.userId, "jobs", randomId, await tx.job.findUnique({ where: { id: randomId } })),
    ]);
    expect(results).toEqual([null, null, null]);

    const audits = await asOwner<{ detail: { table: string; id: string } }>(
      "SELECT detail FROM audit_logs WHERE event = 'ACCESS_DENIED' AND user_id = $1",
      [a.userId],
    );
    const targets = audits.map((r) => r.detail.id);
    expect(targets).toEqual(expect.arrayContaining([b.jobId, b.documentId]));
    expect(targets).not.toContain(randomId);
  });

  it("without a user set, the app role sees no rows at all", async () => {
    const rows = await asRole<{ n: number }>("app", "SELECT (SELECT count(*) FROM jobs)::int + (SELECT count(*) FROM users)::int AS n");
    expect(rows[0]?.n).toBe(0);
  });

  it("a forged app.user_id that isn't a UUID matches nothing and errors safely", async () => {
    await expect(asRole("app", "SELECT set_config('app.user_id', 'x'' OR 1=1 --', false); SELECT count(*) FROM jobs")).rejects.toThrow(/uuid/i);
  });
});

describe("A5: role boundaries", () => {
  it("the app role can't read the audit log, create users or read email tokens", async () => {
    await expect(asRole("app", "SELECT * FROM audit_logs")).rejects.toThrow(/permission denied/);
    await expect(asRole("app", "INSERT INTO users (email) VALUES ('x@example.test')")).rejects.toThrow(/permission denied/);
    await expect(asRole("app", "SELECT * FROM verification_tokens")).rejects.toThrow(/permission denied/);
  });

  it("the auth role can't read jobs, documents or contacts", async () => {
    await expect(asRole("auth", "SELECT * FROM jobs")).rejects.toThrow(/permission denied/);
    await expect(asRole("auth", "SELECT * FROM documents")).rejects.toThrow(/permission denied/);
    await expect(asRole("auth", "SELECT * FROM contacts")).rejects.toThrow(/permission denied/);
  });

  it("the app role can't turn RLS off", async () => {
    await expect(asRole("app", "ALTER TABLE jobs DISABLE ROW LEVEL SECURITY")).rejects.toThrow(/must be owner/);
    // row_security = off makes queries fail rather than bypass policies.
    await expect(asRole("app", "SET row_security = off; SELECT * FROM jobs")).rejects.toThrow(/row-level security/);
  });

  it("row_exists only answers for allow-listed tables", async () => {
    await expect(asRole("app", "SELECT row_exists('users', gen_random_uuid())")).rejects.toThrow(/not allowed/);
  });

  it("the auth role can see users, which login and purge need", async () => {
    const users = await authDb().user.count();
    expect(users).toBeGreaterThanOrEqual(2);
  });
});
