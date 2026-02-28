"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { PostList } from "@/components/PostList";

interface Post {
  path: string;
  slug: string;
  title: string;
  date: string;
  tag: string[];
  description: string;
  featured: boolean;
  draft: boolean;
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/posts")
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(setPosts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 bg-[var(--bg)] border-b border-[var(--border)] backdrop-blur-sm bg-opacity-90">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-sm">cms.abap34.com</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/new")}
              className="text-sm border border-[var(--border)] px-3 py-1 hover:bg-[var(--bg-hover)] transition-colors"
            >
              + new
            </button>
            <button
              onClick={() => signOut()}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)] py-8">loading...</p>
        ) : error ? (
          <p className="text-sm text-red-500 py-8">error: {error}</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-8">no posts yet</p>
        ) : (
          <PostList posts={posts} />
        )}
      </main>
    </div>
  );
}
