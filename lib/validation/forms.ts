import { z } from "zod";

// Building blocks for parsing HTML form submissions with Zod (rule 4).
// Empty fields arrive as "", which we treat as "not set" (null).

/** FormData (or a plain object) to a plain object of strings. Files and repeated keys are dropped. */
export function formObject(input: unknown): Record<string, unknown> {
  if (input instanceof FormData) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of input.entries()) {
      if (typeof value === "string" && !Object.prototype.hasOwnProperty.call(out, key)) {
        Object.defineProperty(out, key, { value, enumerable: true, writable: true });
      }
    }
    return out;
  }
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export function optionalText(max: number) {
  return z.preprocess(blankToNull, z.string().trim().max(max, `Use ${max} characters or fewer.`).nullish()).transform((v) => v ?? null);
}

export function requiredText(max: number, message: string) {
  return z.string({ error: message }).trim().min(1, message).max(max, `Use ${max} characters or fewer.`);
}

/** Only http(s) links, so javascript: and data: URLs can never be stored. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const optionalUrl = z
  .preprocess(blankToNull, z.string().trim().max(2048, "That link is too long.").nullish())
  .transform((v) => v ?? null)
  .refine((v) => v === null || isHttpUrl(v), "Enter a full link that starts with https://");

export const requiredUrl = z
  .string({ error: "Enter a link." })
  .trim()
  .min(1, "Enter a link.")
  .max(2048, "That link is too long.")
  .refine(isHttpUrl, "Enter a full link that starts with https://");

export function optionalEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(blankToNull, z.enum(values).nullish()).transform((v) => v ?? null);
}

export const optionalMoney = z
  .preprocess(blankToNull, z.coerce.number({ error: "Enter a number." }).nonnegative("Use a positive number.").max(1e12, "That number is too big.").nullish())
  .transform((v) => v ?? null);

/** <input type="date"> value (YYYY-MM-DD) to a Date at midnight UTC. */
export const optionalDate = z
  .preprocess(blankToNull, z.iso.date("Enter a valid date.").nullish())
  .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null));

/** An ISO 8601 timestamp produced in the browser from the user's local time. */
export const optionalDateTime = z
  .preprocess(blankToNull, z.iso.datetime({ offset: true, error: "Enter a valid date and time." }).nullish())
  .transform((v) => (v ? new Date(v) : null));

export const uuidField = z.uuid("Something went wrong. Refresh the page and try again.");
export const optionalUuid = z.preprocess(blankToNull, uuidField.nullish()).transform((v) => v ?? null);
