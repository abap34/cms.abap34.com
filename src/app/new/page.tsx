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
    sha?: string;
    draft?: boolean;
    branch?: string;
  }): Promise<{ sha?: string; branch?: string } | void> => {
    const slug = data.draft ? `wip_${data.slug}` : data.slug;

    if (data.sha && data.branch) {
      // Already saved once — update on branch
      const res = await fetch(`/api/posts/${slug}.md`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sha: data.sha,
          title: data.title,
          date: data.date,
          tag: data.tag,
          description: data.description,
          ogp_url: data.ogp_url,
          featured: data.featured,
          body: data.content,
          branch: data.branch,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.error}`);
        return;
      }
      const result = await res.json();
      return { sha: result.sha, branch: data.branch };
    }

    // First save — creates branch + file
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, slug }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`Error: ${err.error}`);
      return;
    }

    const result = await res.json();
    return { sha: result.sha, branch: result.branch };
  };

  const handlePublish = async (data: {
    slug: string;
    title: string;
    branch?: string;
  }) => {
    if (!data.branch) {
      alert("Save first before publishing");
      return;
    }

    const slug = data.slug;
    const res = await fetch(`/api/posts/${slug}.md/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch: data.branch,
        title: `Add: ${data.title}`,
      }),
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
        <PostEditor onSave={handleSave} onPublish={handlePublish} />
      </div>
    </div>
  );
}
