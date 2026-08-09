import type { ReactNode } from "react";
import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/supabase/session";
import { AdminNav } from "@/components/dashboard/admin-nav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            XDrama AI Studio
          </Link>
          <span className="text-muted-foreground text-sm">Platform Admin</span>
          <AdminNav />
        </div>
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Back to dashboard
        </Link>
      </header>
      <main className="flex flex-1 flex-col px-6 py-8">{children}</main>
    </div>
  );
}
