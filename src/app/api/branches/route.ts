import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listCmsBranches } from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const branches = await listCmsBranches();
    // Extract slug from branch name: "cms/my-slug" -> "my-slug"
    const slugs = branches.map((b) => b.replace(/^cms\//, ""));
    return NextResponse.json({ branches, slugs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
