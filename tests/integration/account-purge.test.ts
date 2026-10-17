import { describe, expect, it, vi } from "vitest";
import { authDb, withUser } from "@/lib/db";
import { accountsAwaitingPurge, purgeAccount } from "@/lib/jobs/account-purge";
import { asOwner, createUser } from "./helpers";

const deleteUserFiles = vi.fn<(userId: string) => Promise<number>>(async () => 2);
vi.mock("@/lib/storage", () => ({ deleteUserFiles: (id: string) => deleteUserFiles(id) }));

// A7 acceptance: when a user confirms deletion, all their records and files
// are removed and they can't log in.
describe("A7: account purge", () => {
  it("removes every record and file of a deleted user and leaves others alone", async () => {
    const doomed = await createUser("doomed");
    const keeper = await createUser("keeper");
    for (const u of [doomed, keeper]) {
      await withUser(u.id, async (tx) => {
        const stage = await tx.stage.findFirstOrThrow();
        const job = await tx.job.create({ data: { userId: u.id, stageId: stage.id, title: "Role", companyName: "Co" } });
        await tx.note.create({ data: { userId: u.id, jobId: job.id, contentHtml: "<p>n</p>" } });
        await tx.task.create({ data: { userId: u.id, jobId: job.id, title: "t" } });
        await tx.timelineEvent.create({ data: { userId: u.id, jobId: job.id, type: "CREATED" } });
      });
    }
    await authDb().session.create({ data: { userId: doomed.id, sessionToken: crypto.randomUUID(), expires: new Date(Date.now() + 1e6) } });
    await authDb().user.update({ where: { id: doomed.id }, data: { deletedAt: new Date() } });

    expect(await accountsAwaitingPurge()).toContain(doomed.id);
    await purgeAccount(doomed.id);

    expect(deleteUserFiles).toHaveBeenCalledWith(doomed.id);
    const tables = ["users", "stages", "jobs", "notes", "tasks", "timeline_events", "sessions"];
    for (const table of tables) {
      const column = table === "users" ? "id" : "user_id";
      const [row] = await asOwner<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${column} = $1`, [doomed.id]);
      expect(row?.n, table).toBe(0);
    }
    const [kept] = await asOwner<{ n: number }>("SELECT count(*)::int AS n FROM jobs WHERE user_id = $1", [keeper.id]);
    expect(kept?.n).toBe(1);
    expect(await accountsAwaitingPurge()).not.toContain(doomed.id);
  });

  it("is safe to run twice", async () => {
    await expect(purgeAccount(crypto.randomUUID())).resolves.toBeUndefined();
  });

  it("refuses to purge an account that wasn't marked for deletion", async () => {
    const user = await createUser("active");
    await expect(purgeAccount(user.id)).rejects.toThrow(/not marked for deletion/);
    expect(await authDb().user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });
});
