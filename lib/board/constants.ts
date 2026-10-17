// Shared by server and client: option lists for job fields (D2, D4).

export const WORK_TYPES = ["REMOTE", "HYBRID", "ONSITE"] as const;
export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "OTHER"] as const;
export const SALARY_PERIODS = ["HOURLY", "MONTHLY", "YEARLY"] as const;
export const CURRENCIES = [
  "KES", "USD", "GBP", "EUR", "AED", "SAR", "CAD", "AUD", "UGX", "TZS", "RWF", "NGN", "GHS", "ZAR", "EGP", "INR", "CHF", "JPY", "QAR",
] as const;
export const CONTACT_RELATIONSHIPS = ["RECRUITER", "HIRING_MANAGER", "REFERRER", "INTERVIEWER", "OTHER"] as const;
export const TASK_KINDS = ["TASK", "FOLLOW_UP", "INTERVIEW"] as const;
export const INTERVIEW_TYPES = ["PHONE", "VIDEO", "ONSITE", "ASSESSMENT"] as const;

export const LABELS: Record<string, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ONSITE: "On-site",
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  OTHER: "Other",
  HOURLY: "per hour",
  MONTHLY: "per month",
  YEARLY: "per year",
  RECRUITER: "Recruiter",
  HIRING_MANAGER: "Hiring manager",
  REFERRER: "Referrer",
  INTERVIEWER: "Interviewer",
  TASK: "Task",
  FOLLOW_UP: "Follow-up",
  INTERVIEW: "Interview",
  PHONE: "Phone",
  VIDEO: "Video",
  ASSESSMENT: "Assessment",
};

export function label(value: string | null | undefined): string {
  if (!value) return "";
  return Object.prototype.hasOwnProperty.call(LABELS, value) ? (LABELS[value as keyof typeof LABELS] ?? value) : value;
}

/** Default stage names (seeded by prisma/rls.sql). */
export const STAGE = {
  WISHLIST: "Wishlist",
  APPLIED: "Applied",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
} as const;

/** H1: a "response" is a move past Applied. */
export const RESPONSE_STAGES: readonly string[] = [STAGE.INTERVIEW, STAGE.OFFER, STAGE.REJECTED];

export const SORTS = {
  position: "Board order",
  updated: "Last updated",
  created: "Newest first",
  excitement: "Most exciting",
  deadline: "Deadline soonest",
  company: "Company A to Z",
} as const;
export type SortKey = keyof typeof SORTS;

export const FOLLOW_UP_DAYS = 7;

// Stage colours as classes: inline style attributes are blocked by the CSP.
const STAGE_COLOR_CLASSES: Record<string, string> = {
  "#8A8FA3": "bg-stage-wishlist",
  "#3D3BD4": "bg-stage-applied",
  "#F2B54A": "bg-stage-interview",
  "#1F7A4D": "bg-stage-offer",
  "#B4443A": "bg-stage-rejected",
};

export function stageColorClass(color: string): string {
  const key = color.toUpperCase();
  return Object.prototype.hasOwnProperty.call(STAGE_COLOR_CLASSES, key) ? (STAGE_COLOR_CLASSES[key] ?? "bg-secondary") : "bg-secondary";
}
