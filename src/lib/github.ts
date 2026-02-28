const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const OWNER = "abap34";
const REPO = "abap34.com";
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;

function headers() {
  return {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  };
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: string;
}

// ---------------------------------------------------------------------------
// In-memory cache (survives across requests in the same serverless instance)
// ---------------------------------------------------------------------------
interface PostsCache {
  posts: { file: GitHubFile; content: string }[];
  treeSha: string;
  timestamp: number;
}

let postsCache: PostsCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateCache() {
  postsCache = null;
}

// ---------------------------------------------------------------------------
// listPostsWithContent — 1~2 API calls instead of N+1
//
//   1) GET /repos/.../git/trees/main   (recursive)  — 1 call
//      → filters posts/*.md, gets each blob sha
//   2) If cache treeSha matches → return cached (0 additional calls)
//      Otherwise, fetch all blobs in parallel via Blob API
//      BUT: Trees API already gives us sha, and Contents API for a
//      directory already returns content for files <1MB. So we use
//      the Git Blob API which returns base64 content.
//
// Net result: page load = 1 call (tree) + 0 if cached, N if cold.
//             With TTL=5min, typical usage is 1 call per 5 minutes.
// ---------------------------------------------------------------------------
export async function listPostsWithContent(): Promise<
  { file: GitHubFile; content: string }[]
> {
  // Fetch the tree to get current state
  const treeRes = await fetch(
    `${API_BASE}/git/trees/main?recursive=1`,
    { headers: headers(), cache: "no-store" }
  );
  if (!treeRes.ok) {
    throw new Error(`GitHub API error: ${treeRes.status} ${await treeRes.text()}`);
  }
  const treeData = await treeRes.json();
  const treeSha: string = treeData.sha;

  // If cache is fresh and tree hasn't changed, return cached
  if (
    postsCache &&
    postsCache.treeSha === treeSha &&
    Date.now() - postsCache.timestamp < CACHE_TTL_MS
  ) {
    return postsCache.posts;
  }

  // Filter to posts/*.md
  const mdEntries: { path: string; sha: string; size: number }[] =
    treeData.tree.filter(
      (e: { path: string; type: string }) =>
        e.type === "blob" &&
        e.path.startsWith("posts/") &&
        e.path.endsWith(".md") &&
        !e.path.includes("/", 6) // only top-level in posts/
    );

  // Fetch blob contents in parallel
  const posts = await Promise.all(
    mdEntries.map(async (entry) => {
      const blobRes = await fetch(`${API_BASE}/git/blobs/${entry.sha}`, {
        headers: headers(),
        cache: "no-store",
      });
      if (!blobRes.ok) {
        throw new Error(`GitHub Blob API error: ${blobRes.status}`);
      }
      const blob = await blobRes.json();
      const content = Buffer.from(blob.content, "base64").toString("utf-8");
      const name = entry.path.split("/").pop()!;
      return {
        file: {
          name,
          path: entry.path,
          sha: entry.sha,
          size: entry.size,
          type: "file",
        },
        content,
      };
    })
  );

  postsCache = { posts, treeSha, timestamp: Date.now() };
  return posts;
}

// ---------------------------------------------------------------------------
// Single file operations (used by edit page & writes)
// ---------------------------------------------------------------------------
export async function getPost(
  path: string
): Promise<{ content: string; sha: string }> {
  // Try cache first
  if (postsCache) {
    const cached = postsCache.posts.find((p) => p.file.path === path);
    if (cached) {
      return { content: cached.content, sha: cached.file.sha };
    }
  }

  const res = await fetch(`${API_BASE}/contents/${path}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { content, sha: data.sha };
}

export async function createPost(
  path: string,
  content: string,
  message?: string
): Promise<{ sha: string; commitSha: string }> {
  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message || `Add ${path}`,
      content: Buffer.from(content).toString("base64"),
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
  invalidateCache();
  const data = await res.json();
  return { sha: data.content.sha, commitSha: data.commit.sha };
}

export async function updatePost(
  path: string,
  content: string,
  sha: string,
  message?: string
): Promise<{ sha: string; commitSha: string }> {
  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message || `Update ${path}`,
      content: Buffer.from(content).toString("base64"),
      sha,
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
  invalidateCache();
  const data = await res.json();
  return { sha: data.content.sha, commitSha: data.commit.sha };
}

export async function uploadFile(
  path: string,
  base64Content: string,
  message?: string
): Promise<{ sha: string; commitSha: string }> {
  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message || `Upload ${path}`,
      content: base64Content,
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
  invalidateCache();
  const data = await res.json();
  return { sha: data.content.sha, commitSha: data.commit.sha };
}

export async function deletePost(
  path: string,
  sha: string,
  message?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: "DELETE",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message || `Delete ${path}`,
      sha,
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
  invalidateCache();
}
