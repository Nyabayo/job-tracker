import sanitizeHtml from "sanitize-html";
import { escapeHtml } from "@/lib/html/escape";

// Section 7: every stored HTML snippet (job descriptions, notes) goes through
// this allow-list first. Scripts, styles, event handlers, iframes, images and
// every attribute except a link's href are removed.

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u", "h2", "h3", "h4", "blockquote", "a", "hr"],
  allowedAttributes: { a: ["href"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  // Turn headings the page used for its own layout into our smaller ones.
  transformTags: { h1: "h2", h5: "h4", h6: "h4", div: "p", section: "p", article: "p" },
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "embed", "svg", "math", "template"],
};

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}

/** Plain text (D9 notes) to safe HTML paragraphs. */
export function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    // Every paragraph is escaped before it is wrapped.
    // nosemgrep: html-in-template-string
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** True when the HTML has visible text, not just empty tags. */
export function htmlHasText(html: string): boolean {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim().length > 0;
}
