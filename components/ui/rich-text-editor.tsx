"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, Underline } from "lucide-react";
import { cn } from "@/lib/utils";

// D9: rich text notes. The editor's HTML is posted in a hidden field and the
// server runs it through the same allow-list as job descriptions, so the
// editor is a convenience, never a trust boundary.

type Props = { name: string; label: string; error?: string; placeholder?: string };

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-lg text-secondary hover:bg-ground hover:text-text focus-visible:outline-2 focus-visible:outline-primary",
        active && "bg-ground text-primary",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const chain = () => editor.chain().focus();
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1 border-b border-border p-1">
      <ToolButton label="Bold" active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()}><Bold className="size-4" aria-hidden /></ToolButton>
      <ToolButton label="Italic" active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()}><Italic className="size-4" aria-hidden /></ToolButton>
      <ToolButton label="Underline" active={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()}><Underline className="size-4" aria-hidden /></ToolButton>
      <ToolButton label="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}><Heading2 className="size-4" aria-hidden /></ToolButton>
      <ToolButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()}><List className="size-4" aria-hidden /></ToolButton>
      <ToolButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()}><ListOrdered className="size-4" aria-hidden /></ToolButton>
      <ToolButton label="Quote" active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()}><Quote className="size-4" aria-hidden /></ToolButton>
      <ToolButton
        label="Link"
        active={editor.isActive("link")}
        onClick={() => {
          const current = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link address (https://...)", current ?? "https://");
          if (url === null) return;
          if (url.trim() === "" || url.trim() === "https://") chain().extendMarkRange("link").unsetLink().run();
          else if (/^(https?:\/\/|mailto:)/i.test(url.trim())) chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
        }}
      >
        <Link2 className="size-4" aria-hidden />
      </ToolButton>
    </div>
  );
}

export function RichTextEditor({ name, label, error, placeholder }: Props) {
  const labelId = useId();
  const errorId = `${labelId}-error`;
  const [html, setHtml] = useState("");
  const wrapper = useRef<HTMLDivElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    // The CSP has no 'unsafe-inline' for styles; our CSS covers the editor.
    injectCSS: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"], defaultProtocol: "https" },
      }),
    ],
    editorProps: {
      attributes: {
        "aria-labelledby": labelId,
        "aria-multiline": "true",
        role: "textbox",
        ...(error ? { "aria-invalid": "true", "aria-describedby": errorId } : {}),
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
        class: "rich-text min-h-32 px-3 py-2 text-base text-text outline-none",
      },
    },
    onUpdate: ({ editor: e }) => setHtml(e.isEmpty ? "" : e.getHTML()),
  });

  // ActionForm clears the form after a successful save; clear the editor too.
  useEffect(() => {
    const form = wrapper.current?.closest("form");
    if (!form || !editor) return;
    const clear = () => {
      editor.commands.clearContent(true);
      setHtml("");
    };
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, [editor]);

  return (
    <div ref={wrapper} className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-semibold text-text">
        {label}
      </span>
      <div
        className={cn(
          "rounded-xl border bg-surface focus-within:outline-2 focus-within:outline-primary",
          error ? "border-danger" : "border-border",
        )}
      >
        {editor ? <Toolbar editor={editor} /> : null}
        <EditorContent editor={editor} />
      </div>
      <input type="hidden" name={name} value={html} />
      <input type="hidden" name="format" value="html" />
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
