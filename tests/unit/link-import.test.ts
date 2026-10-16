import { describe, expect, it } from "vitest";
import { isBlockedIp } from "@/lib/fetcher/ip";
import { checkUrl, FetchBlockedError, resolveSafe, safeFetch } from "@/lib/fetcher";
import { jobBoardFromUrl, parseJobPage } from "@/lib/parser/job-posting";

describe("C2 SSRF guard: blocked addresses", () => {
  it("blocks private, loopback, link-local, metadata and reserved IPv4", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1"]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("blocks IPv6 loopback, ULA, link-local and IPv4-mapped private addresses", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:169.254.169.254", "64:ff9b::a00:1", "2002:7f00:1::1"]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("allows ordinary public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "41.90.64.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  it("refuses anything that isn't an IP address", () => {
    expect(isBlockedIp("localhost")).toBe(true);
    expect(isBlockedIp("")).toBe(true);
  });
});

describe("C2 SSRF guard: URLs", () => {
  it("only allows http and https on ports 80 and 443", () => {
    for (const bad of ["file:///etc/passwd", "gopher://x.test", "ftp://x.test", "http://x.test:8080/", "https://x.test:22/", "http://user:pw@x.test/", "not a url"]) {
      expect(() => checkUrl(bad), bad).toThrow(FetchBlockedError);
    }
    expect(checkUrl("https://jobs.example.com/1").hostname).toBe("jobs.example.com");
    expect(checkUrl("http://jobs.example.com:80/1").hostname).toBe("jobs.example.com");
  });

  it("blocks private IP literals and local names before any DNS lookup", () => {
    for (const bad of ["http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest/meta-data/", "http://localhost/", "http://db.internal/", "http://printer.local/", "http://0x7f000001/", "http://2130706433/"]) {
      expect(() => checkUrl(bad), bad).toThrow(FetchBlockedError);
    }
  });

  it("refuses a host whose DNS answer is private", async () => {
    await expect(resolveSafe("localhost")).rejects.toThrow(FetchBlockedError);
  });

  it("C2 acceptance: a blocked URL gives a clear message for manual entry", async () => {
    await expect(safeFetch("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(/private/);
    await expect(safeFetch("http://10.0.0.5/jobs")).rejects.toThrow(/private/);
  });
});

const JSON_LD_PAGE = `<!doctype html><html><head><title>Ignored title</title>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"x"},{
  "@type":"JobPosting","title":"Senior Backend Engineer","hiringOrganization":{"@type":"Organization","name":"Acme &amp; Co"},
  "jobLocation":{"@type":"Place","address":{"addressLocality":"Nairobi","addressRegion":"Nairobi County","addressCountry":"KE"}},
  "employmentType":["FULL_TIME"],"jobLocationType":"TELECOMMUTE","validThrough":"2026-11-30T23:59:00+03:00",
  "baseSalary":{"@type":"MonetaryAmount","currency":"KES","value":{"@type":"QuantitativeValue","minValue":250000,"maxValue":400000,"unitText":"MONTH"}},
  "description":"<p>Build APIs.</p>\\u003cscript\\u003ealert(1)\\u003c/script\\u003e<img src=x onerror=alert(1)><a href=\\"javascript:alert(1)\\">x</a><a href=\\"https://acme.test\\">site</a>"
}]}</script></head><body></body></html>`;

describe("C2: job page parser", () => {
  it("reads schema.org JobPosting JSON-LD first", () => {
    const job = parseJobPage(JSON_LD_PAGE, "https://www.linkedin.com/jobs/view/1");
    expect(job.source).toBe("json-ld");
    expect(job.title).toBe("Senior Backend Engineer");
    expect(job.companyName).toBe("Acme & Co");
    expect(job.location).toBe("Nairobi, Nairobi County");
    expect(job.country).toBe("KE");
    expect(job.workType).toBe("REMOTE");
    expect(job.employmentType).toBe("FULL_TIME");
    expect(job.salaryMin).toBe(250000);
    expect(job.salaryMax).toBe(400000);
    expect(job.salaryCurrency).toBe("KES");
    expect(job.salaryPeriod).toBe("MONTHLY");
    expect(job.deadline).toBe("2026-11-30");
    expect(job.jobBoardName).toBe("LinkedIn");
  });

  it("C3/XSS: the saved description is sanitised", () => {
    const html = parseJobPage(JSON_LD_PAGE, "https://x.test").descriptionHtml ?? "";
    expect(html).toContain("<p>Build APIs.</p>");
    expect(html).toContain('href="https://acme.test"');
    expect(html).not.toMatch(/script|onerror|javascript:|<img/i);
  });

  it("falls back to Open Graph and meta tags", () => {
    const page = `<html><head><meta property="og:title" content="Data Analyst"><meta property="og:site_name" content="Fuzu">
      <meta name="description" content="Analyse <b>data</b> & report"></head></html>`;
    const job = parseJobPage(page, "https://www.fuzu.com/job/1");
    expect(job.source).toBe("meta");
    expect(job.title).toBe("Data Analyst");
    expect(job.companyName).toBe("Fuzu");
    expect(job.descriptionHtml).toBe("<p>Analyse data &amp; report</p>");
  });

  it("survives broken JSON-LD", () => {
    const job = parseJobPage(`<script type="application/ld+json">{not json</script><title>Ops Lead</title>`, "https://x.test");
    expect(job.title).toBe("Ops Lead");
  });

  it("names common job boards", () => {
    expect(jobBoardFromUrl("https://ke.indeed.com/viewjob?jk=1")).toBe("Indeed");
    expect(jobBoardFromUrl("https://boards.greenhouse.io/acme/jobs/1")).toBe("Greenhouse");
    expect(jobBoardFromUrl("https://careers.acme.test/1")).toBe("careers.acme.test");
  });
});
