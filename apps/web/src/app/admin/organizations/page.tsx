import type { Metadata } from "next";

import { requirePlatformAdmin } from "@/lib/supabase/session";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Organizations" };

export default async function AdminOrganizationsPage() {
  const { supabase } = await requirePlatformAdmin();

  const [{ data: organizations }, { data: members }, { data: projects }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, slug, owner_id, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("organization_members").select("org_id"),
      supabase.from("projects").select("org_id"),
    ]);

  const ownerIds = Array.from(new Set((organizations ?? []).map((o) => o.owner_id)));
  const { data: owners } =
    ownerIds.length > 0
      ? await supabase.from("profiles").select("id, email, full_name").in("id", ownerIds)
      : { data: [] };
  const ownerById = new Map((owners ?? []).map((o) => [o.id, o]));

  const memberCountByOrg = new Map<string, number>();
  for (const row of members ?? []) {
    memberCountByOrg.set(row.org_id, (memberCountByOrg.get(row.org_id) ?? 0) + 1);
  }
  const projectCountByOrg = new Map<string, number>();
  for (const row of projects ?? []) {
    projectCountByOrg.set(row.org_id, (projectCountByOrg.get(row.org_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-muted-foreground text-sm">
          Every tenant on the platform, read-only. Member and project counts
          come from real queries against <code>organization_members</code>{" "}
          and <code>projects</code> — this deployment has no billing/plan
          data yet (see Module 16&apos;s doc for why), so that&apos;s
          deliberately not shown here.
        </p>
      </div>

      {(organizations ?? []).length === 0 && (
        <p className="text-muted-foreground text-sm">No organizations yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {(organizations ?? []).map((org) => {
          const owner = ownerById.get(org.owner_id);
          return (
            <Card key={org.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {org.name}
                    <span className="text-muted-foreground text-xs font-normal">
                      {org.slug}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Owner: {owner?.full_name || owner?.email || org.owner_id}
                  </CardDescription>
                </div>
                <div className="text-right text-sm">
                  <div>{memberCountByOrg.get(org.id) ?? 0} members</div>
                  <div>{projectCountByOrg.get(org.id) ?? 0} projects</div>
                  <div className="text-muted-foreground text-xs">
                    created {new Date(org.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
