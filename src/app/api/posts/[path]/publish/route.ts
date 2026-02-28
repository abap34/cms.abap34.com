import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPR, mergePR, deleteBranch, invalidateCache } from "@/lib/github";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await params; // consume params

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { branch, title } = body;
  if (!branch) {
    return NextResponse.json(
      { error: "branch is required" },
      { status: 400 }
    );
  }

  try {
    const prTitle = title || `Publish: ${branch}`;
    const prNumber = await createPR(branch, prTitle);
    await mergePR(prNumber);
    await deleteBranch(branch);
    invalidateCache();
    return NextResponse.json({ merged: true, prNumber });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
