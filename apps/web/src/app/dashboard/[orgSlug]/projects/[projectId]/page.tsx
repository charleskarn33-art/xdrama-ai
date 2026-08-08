import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
import { requireOrgMembership } from "@/lib/supabase/orgs";
import { Card, CardContent } from "@/components/ui/card";

import { EditProjectForm } from "./edit-project-form";

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase, user } = await requireUser();
  const { org, role } = await requireOrgMembership(supabase, user.id, orgSlug);

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, status, created_by")
    .eq("id", projectId)
    .eq("org_id", org.id)
    .single();

  if (!project) {
    notFound();
  }

  const canDelete =
    project.created_by === user.id || role === "owner" || role === "admin";

  return (
    <Card className="w-full max-w-lg">
      <CardContent className="pt-6">
        <EditProjectForm
          orgSlug={orgSlug}
          canDelete={canDelete}
          project={{
            projectId: project.id,
            name: project.name,
            description: project.description ?? "",
            status: project.status,
          }}
        />
      </CardContent>
    </Card>
  );
}
