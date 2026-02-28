import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPost, updatePost, createPost, deletePost } from "@/lib/github";
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

  try {
    const { content, sha } = await getPost(filePath);
    const { meta, body } = parseFrontMatter(content);

    return NextResponse.json({
      path: filePath,
      slug: slugFromPath(filePath),
      sha,
      ...meta,
      body,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("404") ? 404 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
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

  let reqBody;
  try {
    reqBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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

  try {
    const result = await updatePost(
      filePath,
      markdown,
      sha,
      `Update post: ${title}`
    );
    return NextResponse.json({ path: filePath, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("409") ? 409 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const oldFilePath = `posts/${path}`;

  let reqBody;
  try {
    reqBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    newPath,
    sha,
    title,
    date,
    tag,
    description,
    ogp_url,
    featured,
    body,
  } = reqBody;

  if (!sha || !newPath) {
    return NextResponse.json(
      { error: "sha and newPath are required" },
      { status: 400 }
    );
  }

  const newFilePath = `posts/${newPath}`;
  const newSlug = slugFromPath(newFilePath);
  const markdown = generateFrontMatter(
    { title, date, tag, description, ogp_url, featured },
    body || "",
    newSlug
  );

  try {
    // Create the new file
    const result = await createPost(
      newFilePath,
      markdown,
      `Rename post: ${title}`
    );

    // Delete the old file
    await deletePost(oldFilePath, sha, `Remove old file: ${path}`);

    return NextResponse.json({ path: newFilePath, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
