import type { ReactNode } from "react";
import Link from "next/link";

import { requireUser } from "@/lib/supabase/session";
import { requireOrgMembership } from "@/lib/supabase/orgs";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { buildNavItems, SidebarNav } from "@/components/dashboard/sidebar-nav";
import { UserMenu } from "@/components/dashboard/user-menu";

export default async function OrgDashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase, user } = await requireUser();

  await requireOrgMembership(supabase, user.id, orgSlug);

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, is_platform_admin")
      .eq("id", user.id)
      .single(),
    supabase
      .from("organization_members")
      .select("role, organizations(id, name, slug)")
      .eq("user_id", user.id),
  ]);

  const organizations = (memberships ?? [])
    .map((membership) => membership.organizations)
    .filter((org) => org !== null);

  const navItems = buildNavItems(orgSlug);

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="bg-card hidden w-60 shrink-0 flex-col border-r p-4 md:flex">
        <div className="mb-6">
          <OrgSwitcher organizations={organizations} currentSlug={orgSlug} />
        </div>
        <SidebarNav items={navItems} />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            XDrama AI Studio
          </Link>
          <UserMenu
            fullName={profile?.full_name ?? null}
            email={profile?.email ?? user.email ?? ""}
            isPlatformAdmin={profile?.is_platform_admin ?? false}
          />
        </header>

        <main className="flex flex-1 flex-col px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
