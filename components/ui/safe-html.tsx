import { createElement, type ReactNode } from "react";
import { load } from "cheerio";
import type { AnyNode } from "domhandler";
import { sanitizeRichHtml } from "@/lib/html/sanitize";

// Renders stored HTML WITHOUT dangerouslySetInnerHTML: the HTML is sanitised
// again, then rebuilt as React elements from a fixed allow-list, so React
// escapes every text node and only http(s)/mailto links survive.

const BLOCK_CLASSES: Record<string, string> = {
  p: "mb-3",
  ul: "mb-3 list-disc pl-6",
  ol: "mb-3 list-decimal pl-6",
  li: "mb-1",
  h2: "mb-2 mt-4 text-lg font-bold",
  h3: "mb-2 mt-4 font-bold",
  h4: "mb-2 mt-3 font-semibold",
  blockquote: "mb-3 border-l-2 border-border pl-4 text-secondary",
  hr: "my-4 border-border",
};
const ALLOWED = new Set(["p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u", "h2", "h3", "h4", "blockquote", "a", "hr"]);

function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function toReact(node: AnyNode, key: number): ReactNode {
  if (node.type === "text") return "data" in node ? node.data : null;
  if (node.type !== "tag" || !("name" in node)) return null;
  const name = node.name.toLowerCase();
  const children = node.children.map((child, i) => toReact(child, i));
  if (!ALLOWED.has(name)) return children;
  if (name === "a") {
    const href = safeHref(node.attribs.href);
    if (!href) return children;
    return createElement(
      "a",
      { key, href, target: "_blank", rel: "noopener noreferrer nofollow", className: "text-primary underline" },
      ...children,
    );
  }
  // eslint-disable-next-line security/detect-object-injection -- `name` is checked against the ALLOWED set
  const className = BLOCK_CLASSES[name];
  if (name === "br" || name === "hr") return createElement(name, { key, className });
  return createElement(name, { key, className }, ...children);
}

export function SafeHtml({ html, className }: { html: string; className?: string }) {
  const $ = load(sanitizeRichHtml(html), null, false);
  const nodes = $.root().contents().toArray();
  return <div className={className}>{nodes.map((n, i) => toReact(n, i))}</div>;
}
