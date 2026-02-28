"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6">
        <h1 className="text-lg font-bold">cms.abap34.com</h1>
        <p className="text-sm text-[var(--text-muted)]">
          ログインして記事を管理
        </p>
        <button
          onClick={() => signIn("github", { callbackUrl: "/" })}
          className="w-full border border-[var(--border)] px-4 py-2.5 text-sm hover:bg-[var(--bg-hover)] transition-colors"
        >
          GitHub でログイン
        </button>
      </div>
    </div>
  );
}
