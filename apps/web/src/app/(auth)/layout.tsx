import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        XDrama AI Studio
      </Link>
      {children}
    </main>
  );
}
