import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPost, updatePost } from "@/lib/github";
import {
  parseFrontMatter,
  generateFrontMatter,
  slugFromPath,
} from "@/lib/frontmatter";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const filePath = `posts/${path}`;
  const { content, sha } = await getPost(filePath);
  const { meta, body } = parseFrontMatter(content);

  return NextResponse.json({
    path: filePath,
    slug: slugFromPath(filePath),
    sha,
    ...meta,
    body,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const filePath = `posts/${path}`;
  const reqBody = await request.json();
  const {
    sha,
    title,
    date,
    tag,
    description,
    ogp_url,
    featured,
    body,
  } = reqBody;

  if (!sha) {
    return NextResponse.json({ error: "sha is required" }, { status: 400 });
  }

  const slug = slugFromPath(filePath);
  const markdown = generateFrontMatter(
    { title, date, tag, description, ogp_url, featured },
    body || "",
    slug
  );

  const result = await updatePost(
    filePath,
    markdown,
    sha,
    `Update post: ${title}`
  );

  return NextResponse.json({ path: filePath, ...result });
}
