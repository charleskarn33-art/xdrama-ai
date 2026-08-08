import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
import { requireOrgMembership } from "@/lib/supabase/orgs";
import { ProjectTabs } from "@/components/dashboard/project-tabs";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase, user } = await requireUser();
  const { org } = await requireOrgMembership(supabase, user.id, orgSlug);

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("org_id", org.id)
    .single();

  if (!project) {
    notFound();
  }

  const basePath = `/dashboard/${orgSlug}/projects/${projectId}`;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-muted-foreground text-sm">{org.name}</p>
      </div>
      <ProjectTabs basePath={basePath} />
      {children}
    </div>
  );
}
