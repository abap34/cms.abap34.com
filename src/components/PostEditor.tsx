"use client";

import { useState } from "react";
import { Preview } from "./Preview";

interface PostEditorProps {
  initialData?: {
    title: string;
    date: string;
    tag: string[];
    description: string;
    ogp_url: string;
    featured: boolean;
    body: string;
    sha?: string;
  };
  slug?: string;
  onSave: (data: {
    slug: string;
    title: string;
    date: string;
    tag: string[];
    description: string;
    ogp_url: string;
    featured: boolean;
    content: string;
    sha?: string;
  }) => Promise<void>;
}

export function PostEditor({ initialData, slug: initialSlug, onSave }: PostEditorProps) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [showMeta, setShowMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState(initialSlug || "");
  const [title, setTitle] = useState(initialData?.title || "");
  const [date, setDate] = useState(
    initialData?.date || new Date().toISOString().slice(0, 10).replace(/-/g, "/")
  );
  const [tagStr, setTagStr] = useState(
    initialData?.tag?.join(", ") || ""
  );
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [ogpUrl, setOgpUrl] = useState(initialData?.ogp_url || "");
  const [featured, setFeatured] = useState(initialData?.featured || false);
  const [body, setBody] = useState(initialData?.body || "");

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        slug,
        title,
        date,
        tag: tagStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        description,
        ogp_url: ogpUrl,
        featured,
        content: body,
        sha: initialData?.sha,
      });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full border border-[var(--border)] px-2 py-1.5 text-sm bg-[var(--bg)] focus:outline-none focus:border-[var(--accent)]";

  const metaFields = (
    <div className="space-y-3 p-3 border-b border-[var(--border)]">
      {!initialSlug && (
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlug(e.target.value)}
            className={inputClass}
            placeholder="my-post-slug"
          />
        </div>
      )}
      <div>
        <label className="block text-xs text-[var(--text-muted)] mb-1">title</label>
        <input
          type="text"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">date</label>
          <input
            type="text"
            value={date}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
            className={inputClass}
            placeholder="YYYY/MM/DD"
          />
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFeatured(e.target.checked)}
            />
            featured
          </label>
        </div>
      </div>
      <div>
        <label className="block text-xs text-[var(--text-muted)] mb-1">tags (comma separated)</label>
        <input
          type="text"
          value={tagStr}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTagStr(e.target.value)}
          className={inputClass}
          placeholder="tag1, tag2"
        />
      </div>
      <div>
        <label className="block text-xs text-[var(--text-muted)] mb-1">description</label>
        <input
          type="text"
          value={description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs text-[var(--text-muted)] mb-1">ogp url</label>
        <input
          type="text"
          value={ogpUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOgpUrl(e.target.value)}
          className={inputClass}
          placeholder="https://abap34.com/posts/slug/image.png"
        />
      </div>
    </div>
  );

  const editPanel = (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setShowMeta(!showMeta)}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          {showMeta ? "- metadata" : "+ metadata"}
        </button>
      </div>

      {showMeta && metaFields}

      <textarea
        value={body}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
        className="flex-1 w-full px-4 py-3 text-sm resize-none focus:outline-none bg-[var(--bg)]"
        style={{
          lineHeight: "2em",
          backgroundImage: [
            "repeating-linear-gradient(to bottom, var(--bg) 0px, var(--bg) calc(2em - 1px), transparent calc(2em - 1px), transparent 2em)",
            "repeating-linear-gradient(to right, #ddd 0px, #ddd 3px, transparent 3px, transparent 7px)",
          ].join(", "),
          backgroundAttachment: "local",
          backgroundPositionY: "calc(0.75rem - 3px)",
        }}
        placeholder="Write markdown here..."
        spellCheck={false}
      />
    </div>
  );

  const previewPanel = (
    <div className="flex-1 overflow-y-auto p-4">
      <Preview markdown={body} />
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Mobile: tab switcher */}
      <div className="flex border-b border-[var(--border)] bg-[var(--bg)] sticky top-0 z-10 lg:hidden">
        <button
          onClick={() => setTab("edit")}
          className={`flex-1 py-3 text-sm border-b-2 transition-colors ${
            tab === "edit"
              ? "border-[var(--text)] text-[var(--text)]"
              : "border-transparent text-[var(--text-muted)]"
          }`}
        >
          edit
        </button>
        <button
          onClick={() => setTab("preview")}
          className={`flex-1 py-3 text-sm border-b-2 transition-colors ${
            tab === "preview"
              ? "border-[var(--text)] text-[var(--text)]"
              : "border-transparent text-[var(--text-muted)]"
          }`}
        >
          preview
        </button>
      </div>

      {/* Desktop: side by side */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <div className="w-1/2 flex flex-col overflow-hidden">{editPanel}</div>
        <div className="w-1/2 overflow-y-auto border-l border-[var(--border)] p-4">
          <Preview markdown={body} />
        </div>
      </div>

      {/* Mobile: tab content */}
      <div className="lg:hidden flex-1 overflow-hidden flex flex-col">
        {tab === "edit" ? editPanel : previewPanel}
      </div>

      {/* Save button */}
      <div className="sticky bottom-0 bg-[var(--bg)] border-t border-[var(--border)] p-4">
        <button
          onClick={handleSave}
          disabled={saving || !slug || !title}
          className="w-full border border-[var(--text)] text-[var(--text)] py-2.5 text-sm hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? "saving..." : "save"}
        </button>
      </div>
    </div>
  );
}
