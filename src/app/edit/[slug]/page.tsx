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

function getBranchCandidates(slug: string): string[] {
  const baseSlug = slug.replace(/^wip_/, "");
  const candidates = slug.startsWith("wip_")
    ? [`cms/${slug}`, `cms/${baseSlug}`]
    : [`cms/${slug}`];

  return Array.from(new Set(candidates));
}

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const wasDraft = slug.startsWith("wip_");
  const [data, setData] = useState<PostData | null>(null);
  const [branch, setBranch] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setBranch(undefined);

    const load = async () => {
      for (const candidate of getBranchCandidates(slug)) {
        const res = await fetch(`/api/posts/${slug}.md?branch=${candidate}`, {
          signal: controller.signal,
        });

        if (res.ok) {
          setBranch(candidate);
          setData(await res.json());
          return;
        }
      }

      const res = await fetch(`/api/posts/${slug}.md`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(res.status === 404 ? "post not found" : `${res.status}`);
      }

      setData(await res.json());
    };

    load()
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [slug, wasDraft]);

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
    draft?: boolean;
    branch?: string;
  }): Promise<{ sha?: string; branch?: string } | void> => {
    const isDraft = saveData.draft || false;
    const currentBranch = saveData.branch;

    // If no branch yet, create one via getOrCreateBranch (POST to /api/posts for new, or we need to create branch first)
    if (!currentBranch) {
      // Create branch by doing a save through POST /api/posts (which creates branch)
      // But for existing posts, we need to first create the branch, then update
      const baseSlug = wasDraft ? slug.replace(/^wip_/, "") : slug;
      const branchRes = await fetch(`/api/branches/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: baseSlug }),
      });

      let targetBranch: string;
      if (branchRes.ok) {
        const branchData = await branchRes.json();
        targetBranch = branchData.branch;
      } else {
        // Fallback: use main
        targetBranch = "main";
      }

      const draftChanged = wasDraft !== isDraft;
      if (draftChanged) {
        const newSlug = isDraft ? `wip_${slug.replace(/^wip_/, "")}` : slug.replace(/^wip_/, "");
        const res = await fetch(`/api/posts/${slug}.md`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newPath: `${newSlug}.md`,
            sha: saveData.sha,
            title: saveData.title,
            date: saveData.date,
            tag: saveData.tag,
            description: saveData.description,
            ogp_url: saveData.ogp_url,
            featured: saveData.featured,
            body: saveData.content,
            branch: targetBranch,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          alert(`Error: ${err.error}`);
          return;
        }
        const result = await res.json();
        return { sha: result.sha, branch: targetBranch };
      }

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
          branch: targetBranch,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.error}`);
        return;
      }
      const result = await res.json();
      return { sha: result.sha, branch: targetBranch };
    }

    // Already have a branch — update on it
    const draftChanged = wasDraft !== isDraft;
    if (draftChanged) {
      const newSlug = isDraft ? `wip_${slug.replace(/^wip_/, "")}` : slug.replace(/^wip_/, "");
      const res = await fetch(`/api/posts/${slug}.md`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPath: `${newSlug}.md`,
          sha: saveData.sha,
          title: saveData.title,
          date: saveData.date,
          tag: saveData.tag,
          description: saveData.description,
          ogp_url: saveData.ogp_url,
          featured: saveData.featured,
          body: saveData.content,
          branch: currentBranch,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.error}`);
        return;
      }
      const result = await res.json();
      return { sha: result.sha, branch: currentBranch };
    }

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
        branch: currentBranch,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(`Error: ${err.error}`);
      return;
    }
    const result = await res.json();
    return { sha: result.sha, branch: currentBranch };
  };

  const handlePublish = async (publishData: {
    slug: string;
    title: string;
    branch?: string;
  }) => {
    const targetBranch = publishData.branch;
    if (!targetBranch) {
      alert("Save first before publishing");
      return;
    }

    const res = await fetch(`/api/posts/${slug}.md/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch: targetBranch,
        title: `Update: ${publishData.title}`,
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

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          ← back
        </button>
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
        {branch && (
          <span className="ml-2 text-xs text-blue-500">editing</span>
        )}
      </header>
      <div className="flex-1 overflow-hidden">
        {data && (
          <PostEditor
            initialData={{ ...data, draft: wasDraft }}
            slug={slug}
            branch={branch}
            onSave={handleSave}
            onPublish={handlePublish}
          />
        )}
      </div>
    </div>
  );
}
