import { load } from "cheerio";
import { sanitizeRichHtml, textToHtml } from "@/lib/html/sanitize";
import { CURRENCIES } from "@/lib/board/constants";

// C2: reads a job page. schema.org JobPosting JSON-LD first, then Open Graph
// and meta tags. Pure function of the HTML, so it is unit tested without any
// network access. Never executes anything from the page.

export type ParsedJob = {
  title: string | null;
  companyName: string | null;
  location: string | null;
  country: string | null;
  workType: "REMOTE" | null;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP" | "OTHER" | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: "HOURLY" | "MONTHLY" | "YEARLY" | null;
  deadline: string | null; // YYYY-MM-DD
  descriptionHtml: string | null;
  jobBoardName: string | null;
  source: "json-ld" | "meta" | "none";
};

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const isObj = (v: Json | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const get = (o: Obj | undefined, key: string): Json | undefined => (o && Object.prototype.hasOwnProperty.call(o, key) ? o[key] : undefined);

function text(v: Json | undefined, max = 200): string | null {
  if (typeof v === "string") {
    const t = load(v, null, false).text().replace(/\s+/g, " ").trim();
    return t ? t.slice(0, max) : null;
  }
  if (typeof v === "number") return String(v);
  if (isObj(v)) return text(get(v, "name"), max);
  if (Array.isArray(v)) return text(v[0], max);
  return null;
}

function num(v: Json | undefined): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[, ]/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function findPosting(node: Json | undefined, depth = 0): Obj | null {
  if (depth > 6 || node === undefined || node === null) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findPosting(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObj(node)) return null;
  const type = get(node, "@type");
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => t === "JobPosting")) return node;
  return findPosting(get(node, "@graph"), depth + 1);
}

const PERIODS: Record<string, ParsedJob["salaryPeriod"]> = { HOUR: "HOURLY", MONTH: "MONTHLY", YEAR: "YEARLY" };
const EMPLOYMENT: Record<string, ParsedJob["employmentType"]> = {
  FULL_TIME: "FULL_TIME", PART_TIME: "PART_TIME", CONTRACTOR: "CONTRACT", TEMPORARY: "CONTRACT", INTERN: "INTERNSHIP", OTHER: "OTHER",
};
const pick = <T,>(map: Record<string, T>, key: string): T | null => (Object.prototype.hasOwnProperty.call(map, key) ? (map[key] ?? null) : null);

const BOARDS: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$/, "LinkedIn"], [/(^|\.)indeed\./, "Indeed"], [/(^|\.)glassdoor\./, "Glassdoor"],
  [/(^|\.)brightermonday\./, "BrighterMonday"], [/(^|\.)fuzu\.com$/, "Fuzu"], [/(^|\.)myjobmag\./, "MyJobMag"],
  [/(^|\.)greenhouse\.io$/, "Greenhouse"], [/(^|\.)lever\.co$/, "Lever"], [/(^|\.)workable\.com$/, "Workable"],
  [/(^|\.)remoteok\./, "Remote OK"], [/(^|\.)weworkremotely\.com$/, "We Work Remotely"], [/(^|\.)ashbyhq\.com$/, "Ashby"],
];

export function jobBoardFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    for (const [re, name] of BOARDS) if (re.test(host)) return name;
    return host;
  } catch {
    return null;
  }
}

function isoDate(v: Json | undefined): string | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function parseJobPage(html: string, pageUrl: string): ParsedJob {
  const $ = load(html);
  const result: ParsedJob = {
    title: null, companyName: null, location: null, country: null, workType: null, employmentType: null, salaryMin: null,
    salaryMax: null, salaryCurrency: null, salaryPeriod: null, deadline: null, descriptionHtml: null,
    jobBoardName: jobBoardFromUrl(pageUrl), source: "none",
  };

  let posting: Obj | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (posting) return;
    try {
      posting = findPosting(JSON.parse($(el).text()) as Json);
    } catch {
      // Broken JSON-LD on the page: ignore it.
    }
  });

  if (posting) {
    const p: Obj = posting;
    result.source = "json-ld";
    result.title = text(get(p, "title"));
    result.companyName = text(get(p, "hiringOrganization"));
    const locations = get(p, "jobLocation");
    const loc = Array.isArray(locations) ? locations[0] : locations;
    const address = isObj(loc) ? get(loc, "address") : undefined;
    if (isObj(address)) {
      result.location = [text(get(address, "addressLocality")), text(get(address, "addressRegion"))].filter(Boolean).join(", ") || null;
      const country = text(get(address, "addressCountry"));
      result.country = country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null;
    }
    if (get(p, "jobLocationType") === "TELECOMMUTE") result.workType = "REMOTE";
    const employment = get(p, "employmentType");
    const firstEmployment = typeof employment === "string" ? employment : Array.isArray(employment) && typeof employment[0] === "string" ? employment[0] : null;
    if (firstEmployment) result.employmentType = pick(EMPLOYMENT, firstEmployment.toUpperCase());
    const salary = get(p, "baseSalary");
    if (isObj(salary)) {
      const currency = text(get(salary, "currency"));
      result.salaryCurrency = currency && (CURRENCIES as readonly string[]).includes(currency.toUpperCase()) ? currency.toUpperCase() : null;
      const value = get(salary, "value");
      if (isObj(value)) {
        result.salaryMin = num(get(value, "minValue")) ?? num(get(value, "value"));
        result.salaryMax = num(get(value, "maxValue")) ?? num(get(value, "value"));
        const unit = text(get(value, "unitText"));
        if (unit) result.salaryPeriod = pick(PERIODS, unit.toUpperCase());
      } else {
        result.salaryMin = result.salaryMax = num(value);
      }
    }
    result.deadline = isoDate(get(p, "validThrough"));
    const description = get(p, "description");
    if (typeof description === "string") result.descriptionHtml = sanitizeRichHtml(description).slice(0, 100_000) || null;
  }

  const meta = (name: string) =>
    $("meta")
      .filter((_, el) => el.attribs.property === name || el.attribs.name === name)
      .first()
      .attr("content")
      ?.trim() || null;
  if (!result.title) {
    const t = meta("og:title") ?? ($("title").first().text().trim() || null);
    result.title = t ? t.slice(0, 200) : null;
    if (result.title && result.source === "none") result.source = "meta";
  }
  if (!result.companyName) result.companyName = meta("og:site_name")?.slice(0, 200) ?? null;
  if (!result.descriptionHtml) {
    const d = meta("og:description") ?? meta("description");
    if (d) result.descriptionHtml = textToHtml(load(d, null, false).text().slice(0, 5_000)) || null;
  }
  return result;
}
