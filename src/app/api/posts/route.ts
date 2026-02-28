import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listPostsWithContent,
  listCmsBranchRefs,
  listCmsPostsWithContent,
  createPost,
  getOrCreateBranch,
} from "@/lib/github";
import {
  parseFrontMatter,
  generateFrontMatter,
  slugFromPath,
} from "@/lib/frontmatter";

function toPostSummary(
  file: { path: string; sha: string; name: string },
  content: string,
  options?: { draft?: boolean }
) {
  const { meta } = parseFrontMatter(content);

  return {
    path: file.path,
    slug: slugFromPath(file.path),
    sha: file.sha,
    title: meta.title || slugFromPath(file.path),
    date: meta.date || "",
    tag: meta.tag || [],
    description: meta.description || "",
    featured: meta.featured || false,
    draft: options?.draft ?? file.name.startsWith("wip_"),
    editing: false,
  };
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const branchRefs = await listCmsBranchRefs();
    const [publishedFiles, cmsFiles] = await Promise.all([
      listPostsWithContent(),
      listCmsPostsWithContent(branchRefs),
    ]);
    const branchSlugs = new Set(
      branchRefs.map(({ branch }) => branch.replace(/^cms\//, ""))
    );

    const publishedPosts = publishedFiles.map(({ file, content }) =>
      toPostSummary(file, content)
    );
    const publishedPaths = new Set(publishedPosts.map((post) => post.path));

    const unpublishedOnlyPosts = Array.from(
      new Map(
        cmsFiles
          .filter(({ file }) => !publishedPaths.has(file.path))
          .map(({ file, content }) => [
            file.path,
            { ...toPostSummary(file, content, { draft: true }), editing: true },
          ])
      ).values()
    );

    const posts = [...publishedPosts, ...unpublishedOnlyPosts].map((post) => ({
      ...post,
      editing:
        post.editing ||
        branchSlugs.has(post.slug) ||
        branchSlugs.has(post.slug.replace(/^wip_/, "")),
    }));

    posts.sort((a, b) => (a.date > b.date ? -1 : 1));

    return NextResponse.json(posts);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slug, title, date, tag, description, ogp_url, featured, content } =
    body;

  if (!slug || !title) {
    return NextResponse.json(
      { error: "slug and title are required" },
      { status: 400 }
    );
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "slug must be alphanumeric (hyphens and underscores allowed)" },
      { status: 400 }
    );
  }

  const path = `posts/${slug}.md`;
  const markdown = generateFrontMatter(
    { title, date, tag, description, ogp_url, featured },
    content || "",
    slug
  );

  try {
    const { branch } = await getOrCreateBranch(slug);
    const result = await createPost(path, markdown, `Add post: ${title}`, branch);
    return NextResponse.json({ path, branch, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
