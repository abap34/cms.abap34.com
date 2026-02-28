"use client";

import { useState } from "react";
import Link from "next/link";

interface Post {
  path: string;
  slug: string;
  title: string;
  date: string;
  tag: string[];
  description: string;
  featured: boolean;
  draft: boolean;
  editing: boolean;
}

type Filter = "all" | "published" | "drafts";

export function PostList({ posts }: { posts: Post[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = posts.filter((post) => {
    if (filter === "published") return !post.draft;
    if (filter === "drafts") return post.draft;
    return true;
  });

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "all" },
    { key: "published", label: "published" },
    { key: "drafts", label: "drafts" },
  ];

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`text-xs px-2.5 py-1 border transition-colors ${
              filter === t.key
                ? "border-[var(--text)] text-[var(--text)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {filtered.map((post) => (
          <Link
            key={post.slug}
            href={`/edit/${post.slug}`}
            className="block border-b border-[var(--border)] py-3 hover:bg-[var(--bg-hover)] transition-colors px-1"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold truncate">
                  {post.title}
                  {post.draft && (
                    <span className="ml-2 text-xs font-normal text-amber-600 border border-amber-400 px-1.5 py-0.5 align-middle">
                      draft
                    </span>
                  )}
                  {post.editing && (
                    <span className="ml-2 text-xs font-normal text-blue-500 border border-blue-400 px-1.5 py-0.5 align-middle">
                      editing
                    </span>
                  )}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">{post.date}</p>
                {post.description && (
                  <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                    {post.description}
                  </p>
                )}
                {post.tag.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {post.tag.map((t) => (
                      <span
                        key={t}
                        className="text-xs bg-[var(--tag-bg)] text-[var(--text-muted)] px-2 py-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {post.featured && (
                <span className="text-xs text-[var(--accent)] shrink-0">
                  *
                </span>
              )}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] py-4">no posts</p>
        )}
      </div>
    </div>
  );
}
