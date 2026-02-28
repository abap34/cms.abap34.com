"use client";

import Link from "next/link";

interface Post {
  path: string;
  slug: string;
  title: string;
  date: string;
  tag: string[];
  description: string;
  featured: boolean;
}

export function PostList({ posts }: { posts: Post[] }) {
  return (
    <div className="space-y-1">
      {posts.map((post) => (
        <Link
          key={post.slug}
          href={`/edit/${post.slug}`}
          className="block border-b border-[var(--border)] py-3 hover:bg-[var(--bg-hover)] transition-colors px-1"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold truncate">
                {post.title}
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
    </div>
  );
}
