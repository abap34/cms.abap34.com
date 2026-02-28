import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listPostsWithContent, createPost } from "@/lib/github";
import {
  parseFrontMatter,
  generateFrontMatter,
  slugFromPath,
} from "@/lib/frontmatter";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const filesWithContent = await listPostsWithContent();

    const posts = filesWithContent.map(({ file, content }) => {
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
      };
    });

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
    const result = await createPost(path, markdown, `Add post: ${title}`);
    return NextResponse.json({ path, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
