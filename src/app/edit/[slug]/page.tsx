"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { PostEditor } from "@/components/PostEditor";

interface PostData {
  title: string;
  date: string;
  tag: string[];
  description: string;
  ogp_url: string;
  featured: boolean;
  body: string;
  sha: string;
}

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/posts/${slug}.md`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSave = async (saveData: {
    slug: string;
    title: string;
    date: string;
    tag: string[];
    description: string;
    ogp_url: string;
    featured: boolean;
    content: string;
    sha?: string;
  }) => {
    const res = await fetch(`/api/posts/${slug}.md`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sha: saveData.sha,
        title: saveData.title,
        date: saveData.date,
        tag: saveData.tag,
        description: saveData.description,
        ogp_url: saveData.ogp_url,
        featured: saveData.featured,
        body: saveData.content,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`Error: ${err.error}`);
      return;
    }

    router.push("/");
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-sm text-[var(--text-muted)]">loading...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-[var(--bg)] border-b border-[var(--border)] backdrop-blur-sm bg-opacity-90 px-4 py-3 flex items-center">
        <button
          onClick={() => router.back()}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] mr-3"
        >
          ← back
        </button>
        <h1 className="font-bold text-sm truncate">{data?.title || slug}</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        {data && (
          <PostEditor
            initialData={data}
            slug={slug}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}
