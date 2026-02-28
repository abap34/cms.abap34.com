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

interface GitHubTreeEntry {
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

interface CmsBranchPostsCache {
  sha: string;
  posts: { branch: string; file: GitHubFile; content: string }[];
  timestamp: number;
}

interface GitHubRef {
  ref: string;
  object: {
    sha: string;
  };
}

export interface CmsBranchRef {
  branch: string;
  sha: string;
}

let postsCache: PostsCache | null = null;
let cmsPostsCache: Record<string, CmsBranchPostsCache> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateCache() {
  postsCache = null;
}

// ---------------------------------------------------------------------------
// Branch operations
// ---------------------------------------------------------------------------

export async function getBranchSha(branch: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/git/ref/heads/${branch}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.object.sha;
}

export async function createBranch(
  branch: string,
  fromSha: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/git/refs`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: fromSha,
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
}

export async function getOrCreateBranch(
  slug: string
): Promise<{ branch: string; sha: string }> {
  const branch = `cms/${slug}`;
  const existing = await getBranchSha(branch);
  if (existing) {
    return { branch, sha: existing };
  }
  const mainSha = await getBranchSha("main");
  if (!mainSha) {
    throw new Error("Could not find main branch");
  }
  await createBranch(branch, mainSha);
  return { branch, sha: mainSha };
}

export async function createPR(
  branch: string,
  title: string,
  body?: string
): Promise<number> {
  const res = await fetch(`${API_BASE}/pulls`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      body: body || "",
      head: branch,
      base: "main",
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.number;
}

export async function mergePR(prNumber: number): Promise<void> {
  const res = await fetch(`${API_BASE}/pulls/${prNumber}/merge`, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      merge_method: "squash",
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
}

export async function deleteBranch(branch: string): Promise<void> {
  const res = await fetch(`${API_BASE}/git/refs/heads/${branch}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok && res.status !== 422) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
}

export async function listCmsBranchRefs(): Promise<CmsBranchRef[]> {
  const res = await fetch(
    `${API_BASE}/git/matching-refs/heads/cms/`,
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
  const data: GitHubRef[] = await res.json();
  return data.map((ref) => ({
    branch: ref.ref.replace("refs/heads/", ""),
    sha: ref.object.sha,
  }));
}

export async function listCmsBranches(): Promise<string[]> {
  const refs = await listCmsBranchRefs();
  return refs.map((ref) => ref.branch);
}

function isTopLevelPostMarkdown(path: string): boolean {
  return (
    path.startsWith("posts/") &&
    path.endsWith(".md") &&
    !path.includes("/", 6)
  );
}

async function getPostTree(
  ref: string
): Promise<{ treeSha: string; entries: GitHubTreeEntry[] }> {
  const treeRes = await fetch(
    `${API_BASE}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    { headers: headers(), cache: "no-store" }
  );
  if (!treeRes.ok) {
    throw new Error(`GitHub API error: ${treeRes.status} ${await treeRes.text()}`);
  }

  const treeData = await treeRes.json();
  const entries = treeData.tree.filter(
    (entry: GitHubTreeEntry) =>
      entry.type === "blob" && isTopLevelPostMarkdown(entry.path)
  );

  return { treeSha: treeData.sha, entries };
}

async function getBlobContent(sha: string): Promise<string> {
  const blobRes = await fetch(`${API_BASE}/git/blobs/${sha}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!blobRes.ok) {
    throw new Error(`GitHub Blob API error: ${blobRes.status}`);
  }

  const blob = await blobRes.json();
  return Buffer.from(blob.content, "base64").toString("utf-8");
}

async function hydratePosts(
  entries: GitHubTreeEntry[]
): Promise<{ file: GitHubFile; content: string }[]> {
  return Promise.all(
    entries.map(async (entry) => {
      const content = await getBlobContent(entry.sha);
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
}

// ---------------------------------------------------------------------------
// listPostsWithContent — 1~2 API calls instead of N+1
// ---------------------------------------------------------------------------
export async function listPostsWithContent(): Promise<
  { file: GitHubFile; content: string }[]
> {
  const { treeSha, entries } = await getPostTree("main");

  // If cache is fresh and tree hasn't changed, return cached
  if (
    postsCache &&
    postsCache.treeSha === treeSha &&
    Date.now() - postsCache.timestamp < CACHE_TTL_MS
  ) {
    return postsCache.posts;
  }

  const posts = await hydratePosts(entries);

  postsCache = { posts, treeSha, timestamp: Date.now() };
  return posts;
}

export async function listCmsPostsWithContent(
  branchRefs?: CmsBranchRef[]
): Promise<
  { branch: string; file: GitHubFile; content: string }[]
> {
  const branches = branchRefs || (await listCmsBranchRefs());
  const now = Date.now();
  const nextCache: Record<string, CmsBranchPostsCache> = {};

  const postsByBranch = await Promise.all(
    branches.map(async ({ branch, sha }) => {
      const cached = cmsPostsCache[branch];
      if (
        cached &&
        cached.sha === sha &&
        now - cached.timestamp < CACHE_TTL_MS
      ) {
        nextCache[branch] = cached;
        return cached.posts;
      }

      const { entries } = await getPostTree(branch);
      const posts = await hydratePosts(entries);
      const branchPosts = posts.map((post) => ({ branch, ...post }));
      nextCache[branch] = {
        sha,
        posts: branchPosts,
        timestamp: now,
      };
      return branchPosts;
    })
  );

  cmsPostsCache = nextCache;
  return postsByBranch.flat();
}

// ---------------------------------------------------------------------------
// Single file operations (used by edit page & writes)
// ---------------------------------------------------------------------------
export async function getPost(
  path: string,
  ref?: string
): Promise<{ content: string; sha: string }> {
  // Try cache first (only for main branch)
  if (!ref && postsCache) {
    const cached = postsCache.posts.find((p) => p.file.path === path);
    if (cached) {
      return { content: cached.content, sha: cached.file.sha };
    }
  }

  const url = ref
    ? `${API_BASE}/contents/${path}?ref=${ref}`
    : `${API_BASE}/contents/${path}`;
  const res = await fetch(url, {
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
  message?: string,
  branch?: string
): Promise<{ sha: string; commitSha: string }> {
  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message || `Add ${path}`,
      content: Buffer.from(content).toString("base64"),
      ...(branch && { branch }),
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
  message?: string,
  branch?: string
): Promise<{ sha: string; commitSha: string }> {
  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message || `Update ${path}`,
      content: Buffer.from(content).toString("base64"),
      sha,
      ...(branch && { branch }),
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
  message?: string,
  branch?: string
): Promise<{ sha: string; commitSha: string }> {
  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message || `Upload ${path}`,
      content: base64Content,
      ...(branch && { branch }),
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
  message?: string,
  branch?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: "DELETE",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message || `Delete ${path}`,
      sha,
      ...(branch && { branch }),
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
  invalidateCache();
}
