import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { sanitizeRichHtml, textToHtml } from "@/lib/html/sanitize";
import { SafeHtml } from "@/components/ui/safe-html";
import { cleanFileName, detectFileType } from "@/lib/documents/filetype";
import { csvCell } from "@/lib/export";
import { applicationsPerWeek, computeMetrics, funnel, weekStart, type MetricJob } from "@/lib/dashboard/metrics";

const XSS = [
  `<script>alert(1)</script>`,
  `<img src=x onerror=alert(1)>`,
  `<a href="javascript:alert(1)">x</a>`,
  `<a href="  JaVaScRiPt:alert(1)">x</a>`,
  `<svg onload=alert(1)>`,
  `<iframe src="https://evil.test"></iframe>`,
  `<p style="background:url(javascript:alert(1))" onclick="x()">hi</p>`,
  `<math><mi xlink:href="javascript:alert(1)">x</mi></math>`,
  `<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>`,
];

describe("XSS in notes and descriptions", () => {
  it("the sanitiser strips scripts, handlers, styles and unsafe links", () => {
    for (const payload of XSS) {
      const out = sanitizeRichHtml(payload);
      expect(out, payload).not.toMatch(/<script|onerror|onload|onclick|javascript:|<iframe|<svg|style=|data:/i);
    }
  });

  it("the renderer escapes text and keeps only safe links", () => {
    for (const payload of XSS) {
      const html = renderToStaticMarkup(createElement(SafeHtml, { html: payload }));
      expect(html, payload).not.toMatch(/<script|onerror|onload|onclick|javascript:|<iframe|<svg|style=|data:/i);
    }
    const html = renderToStaticMarkup(createElement(SafeHtml, { html: `<p>ok <a href="https://good.test">good</a></p>` }));
    expect(html).toContain('href="https://good.test/"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("notes are plain text: tags typed by the user show as text", () => {
    const html = textToHtml("Hello <script>alert(1)</script>\n\nSecond");
    expect(html).toBe("<p>Hello &lt;script&gt;alert(1)&lt;/script&gt;</p><p>Second</p>");
    const rendered = renderToStaticMarkup(createElement(SafeHtml, { html }));
    expect(rendered).toContain("&lt;script&gt;");
    expect(rendered).not.toContain("<script");
  });
});

describe("E1b: uploads are checked by their bytes", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(32).fill(0)]);
  it("accepts real PDF, PNG and JPG files", () => {
    expect(detectFileType(new TextEncoder().encode("%PDF-1.7\n..."))?.mime).toBe("application/pdf");
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe("image/png");
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
  });

  it("rejects an .exe renamed to .pdf, HTML, SVG and plain ZIPs", () => {
    expect(detectFileType(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull(); // MZ: Windows executable
    expect(detectFileType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectFileType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(detectFileType(new TextEncoder().encode("PK\u0003\u0004 just a zip"))).toBeNull();
  });

  it("accepts a DOCX but refuses a macro-enabled one", () => {
    const docx = new TextEncoder().encode("PK\u0003\u0004....[Content_Types].xml....word/document.xml");
    expect(detectFileType(docx)?.ext).toBe("docx");
    const docm = new TextEncoder().encode("PK\u0003\u0004....[Content_Types].xml....word/vbaProject.bin");
    expect(detectFileType(docm)).toBeNull();
  });

  it("cleans file names (no paths, quotes or control characters)", () => {
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName('C:\\Users\\me\\My "CV".pdf')).toBe("My CV.pdf");
    expect(cleanFileName("a\r\nb.pdf")).toBe("ab.pdf");
    expect(cleanFileName("")).toBe("file");
  });
});

describe("A6: CSV export", () => {
  it("makes spreadsheet formulas inert and quotes properly", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("Acme, Inc")).toBe('"Acme, Inc"');
    expect(csvCell(null)).toBe("");
  });
});

describe("H1: dashboard maths", () => {
  const day = (d: number) => new Date(Date.UTC(2026, 9, d));
  const job = (id: string, stageName: string, applied: number | null, response: number | null): MetricJob => ({
    id, stageName, dateSaved: day(1), dateApplied: applied ? day(applied) : null, firstResponseAt: response ? day(response) : null,
  });

  it("matches the spec definitions", () => {
    const jobs = [
      job("1", "Wishlist", null, null),
      job("2", "Applied", 2, null),
      job("3", "Applied", 3, null),
      job("4", "Interview", 2, 6),
      job("5", "Offer", 2, 4),
      job("6", "Rejected", 3, 13),
    ];
    const m = computeMetrics(jobs);
    expect(m.total).toBe(6);
    expect(m.applied).toBe(5);
    expect(m.active).toBe(3);
    expect(m.interviews).toBe(1);
    expect(m.offers).toBe(1);
    expect(m.rejections).toBe(1);
    expect(m.responseRate).toBe(60);
    expect(m.interviewRate).toBe(40);
    expect(m.offerRate).toBe(20);
    expect(m.avgDaysToFirstResponse).toBe(5.3);
  });

  it("H1 acceptance: 40 jobs across stages add up exactly", () => {
    const stages = ["Wishlist", "Applied", "Interview", "Offer", "Rejected"];
    const jobs = Array.from({ length: 40 }, (_, i) => job(String(i), stages[i % 5] as string, i % 5 === 0 ? null : 2, null));
    const m = computeMetrics(jobs);
    expect(m.total).toBe(40);
    expect(funnel(jobs, stages).reduce((a, s) => a + s.jobs, 0)).toBe(40);
    expect(m.applied).toBe(32);
    expect(m.responseRate).toBe(75);
  });

  it("has no division by zero", () => {
    expect(computeMetrics([]).responseRate).toBe(0);
    expect(computeMetrics([]).avgDaysToFirstResponse).toBeNull();
  });

  it("counts applications per week, filling empty weeks", () => {
    expect(weekStart(new Date("2026-10-15T10:00:00Z"))).toBe("2026-10-12");
    const weeks = applicationsPerWeek([job("a", "Applied", 1, null), job("b", "Applied", 15, null)], null, day(20));
    expect(weeks.map((w) => w.week)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]);
    expect(weeks.map((w) => w.applications)).toEqual([1, 0, 1, 0]);
  });
});
