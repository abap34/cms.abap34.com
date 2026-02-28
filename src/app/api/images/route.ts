import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFile } from "@/lib/github";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const slug = formData.get("slug") as string | null;

  if (!file || !slug) {
    return NextResponse.json(
      { error: "file and slug are required" },
      { status: 400 }
    );
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "slug must be alphanumeric (hyphens and underscores allowed)" },
      { status: 400 }
    );
  }

  const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `posts/${slug}/${filename}`;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    await uploadFile(path, base64, `Upload image: ${filename}`);
    const url = `https://abap34.com/posts/${slug}/${filename}`;
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
