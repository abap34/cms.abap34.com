"use client";

import { useRouter } from "next/navigation";
import { PostEditor } from "@/components/PostEditor";

export default function NewPostPage() {
  const router = useRouter();

  const handleSave = async (data: {
    slug: string;
    title: string;
    date: string;
    tag: string[];
    description: string;
    ogp_url: string;
    featured: boolean;
    content: string;
  }) => {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`Error: ${err.error}`);
      return;
    }

    router.push("/");
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-[var(--bg)] border-b border-[var(--border)] backdrop-blur-sm bg-opacity-90 px-4 py-3 flex items-center">
        <button
          onClick={() => router.back()}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] mr-3"
        >
          ← back
        </button>
        <h1 className="font-bold text-sm">new post</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <PostEditor onSave={handleSave} />
      </div>
    </div>
  );
}
