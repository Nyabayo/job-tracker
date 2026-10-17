import { describe, expect, it } from "vitest";
import { positionBetween, renumber, POSITION_STEP } from "@/lib/board/position";
import { groupTasks } from "@/lib/board/task-groups";
import { boardFilterSchema, contactSchema, jobSchema, moveJobSchema, tagsSchema, taskSchema } from "@/lib/validation/job";
import { formObject } from "@/lib/validation/forms";

describe("B2: card order inside a stage", () => {
  it("puts a dropped card between its neighbours", () => {
    expect(positionBetween(0, 1024)).toBe(512);
    expect(positionBetween(null, 0)).toBe(-POSITION_STEP);
    expect(positionBetween(2048, null)).toBe(2048 + POSITION_STEP);
    expect(positionBetween(null, null)).toBe(0);
  });

  it("asks for a renumber when the gap is used up", () => {
    expect(positionBetween(1, 1 + 1e-9)).toBeNull();
    expect(renumber(3)).toEqual([0, POSITION_STEP, 2 * POSITION_STEP]);
  });

  it("keeps order stable over many moves into the same gap", () => {
    let low = 0;
    const high = 1024;
    for (let i = 0; i < 30; i++) {
      const p = positionBetween(low, high);
      expect(p).not.toBeNull();
      expect(p as number).toBeGreaterThan(low);
      expect(p as number).toBeLessThan(high);
      low = p as number;
    }
  });
});

describe("C1, D1 to D6: job validation", () => {
  it("needs only a title and company", () => {
    const r = jobSchema.safeParse({ title: "Engineer", companyName: "Acme" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.companyUrl).toBeNull();
      expect(r.data.excitement).toBeNull();
    }
  });

  it("rejects missing title or company with clear messages", () => {
    const r = jobSchema.safeParse({ title: " ", companyName: "" });
    expect(r.success).toBe(false);
    const messages = r.error?.issues.map((i) => i.message) ?? [];
    expect(messages).toContain("Enter the job title.");
    expect(messages).toContain("Enter the company name.");
  });

  it("only accepts http(s) links, so javascript: URLs can't be stored", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,<script>", "ftp://x.test", "vbscript:x"]) {
      expect(jobSchema.safeParse({ title: "a", companyName: "b", jobPostUrl: url }).success).toBe(false);
    }
    expect(jobSchema.safeParse({ title: "a", companyName: "b", jobPostUrl: "https://jobs.example.com/1" }).success).toBe(true);
  });

  it("checks salary, rating, country and dates", () => {
    expect(jobSchema.safeParse({ title: "a", companyName: "b", salaryMin: "500", salaryMax: "100" }).success).toBe(false);
    expect(jobSchema.safeParse({ title: "a", companyName: "b", excitement: "6" }).success).toBe(false);
    expect(jobSchema.safeParse({ title: "a", companyName: "b", country: "Kenya" }).success).toBe(false);
    expect(jobSchema.safeParse({ title: "a", companyName: "b", deadline: "2026-02-31x" }).success).toBe(false);
    const ok = jobSchema.parse({ title: "a", companyName: "b", country: "ke", salaryMin: "1000", salaryCurrency: "KES", deadline: "2026-11-01" });
    expect(ok.country).toBe("KE");
    expect(ok.salaryMin).toBe(1000);
    expect(ok.deadline?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("refuses ids that aren't UUIDs", () => {
    expect(moveJobSchema.safeParse({ jobId: "1", stageId: "2" }).success).toBe(false);
    expect(moveJobSchema.safeParse({ jobId: crypto.randomUUID(), stageId: crypto.randomUUID(), aboveId: "", belowId: "" }).success).toBe(true);
  });
});

describe("D8, F1, G1: detail validation", () => {
  it("splits, trims and de-duplicates tags", () => {
    const r = tagsSchema.parse({ jobId: crypto.randomUUID(), tags: " remote, fintech ,remote,, referral " });
    expect(r.tags).toEqual(["remote", "fintech", "referral"]);
  });

  it("validates contact email, phone and LinkedIn link", () => {
    const jobId = crypto.randomUUID();
    expect(contactSchema.safeParse({ jobId, name: "Amina", email: "not-an-email" }).success).toBe(false);
    expect(contactSchema.safeParse({ jobId, name: "Amina", phone: "<script>" }).success).toBe(false);
    expect(contactSchema.safeParse({ jobId, name: "Amina", linkedinUrl: "javascript:alert(1)" }).success).toBe(false);
    const ok = contactSchema.parse({ jobId, name: "Amina", email: "Amina@Example.com", phone: "+254 700 000000" });
    expect(ok.email).toBe("amina@example.com");
    expect(ok.relationship).toBe("OTHER");
  });

  it("accepts ISO due and reminder times only", () => {
    expect(taskSchema.safeParse({ title: "Call", dueAt: "tomorrow" }).success).toBe(false);
    const ok = taskSchema.parse({ title: "Call", dueAt: "2026-10-20T06:00:00.000Z", kind: "INTERVIEW", interviewType: "VIDEO" });
    expect(ok.dueAt?.toISOString()).toBe("2026-10-20T06:00:00.000Z");
  });
});

describe("B6: board filters from the URL", () => {
  it("ignores anything invalid instead of trusting it", () => {
    const f = boardFilterSchema.parse({ stage: "'; drop table jobs", rating: "9", workType: "MOON", sort: "nope", country: "ke", q: "  dev " });
    expect(f.stage).toBeUndefined();
    expect(f.rating).toBeUndefined();
    expect(f.workType).toBeUndefined();
    expect(f.sort).toBeUndefined();
    expect(f.country).toBe("KE");
    expect(f.q).toBe("dev");
  });
});

describe("Form parsing", () => {
  it("never lets a field named __proto__ pollute objects", () => {
    const fd = new FormData();
    fd.append("__proto__", "polluted");
    fd.append("title", "a");
    const obj = formObject(fd);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(obj)).toBe(Object.prototype);
    expect(obj.title).toBe("a");
  });
});

describe("G4: task groups", () => {
  it("sorts tasks into Overdue, Today, Upcoming and Completed", () => {
    const now = new Date(2026, 9, 16, 12, 0);
    const at = (d: number, h: number) => new Date(2026, 9, d, h, 0);
    const g = groupTasks(
      [
        { id: "a", dueAt: at(15, 9), completedAt: null },
        { id: "b", dueAt: at(16, 9), completedAt: null },
        { id: "c", dueAt: at(16, 18), completedAt: null },
        { id: "d", dueAt: at(17, 9), completedAt: null },
        { id: "e", dueAt: null, completedAt: null },
        { id: "f", dueAt: at(1, 9), completedAt: at(2, 9) },
      ],
      now,
    );
    expect(g.overdue.map((t) => t.id)).toEqual(["a"]);
    expect(g.today.map((t) => t.id)).toEqual(["b", "c"]);
    expect(g.upcoming.map((t) => t.id)).toEqual(["d", "e"]);
    expect(g.completed.map((t) => t.id)).toEqual(["f"]);
  });
});
