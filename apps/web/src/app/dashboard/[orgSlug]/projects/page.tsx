import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/supabase/session";
import { requireOrgMembership } from "@/lib/supabase/orgs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Projects" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
};

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase, user } = await requireUser();
  const { org } = await requireOrgMembership(supabase, user.id, orgSlug);

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description, status, updated_at")
    .eq("org_id", org.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">{org.name}</p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/${orgSlug}/projects/new`}>New project</Link>
        </Button>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/dashboard/${orgSlug}/projects/${project.id}`}>
              <Card className="h-full transition-colors hover:bg-secondary/40">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{project.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {project.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-1 text-xs font-medium">
                    {STATUS_LABEL[project.status] ?? project.status}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              Create your first project to start turning a script into a movie.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
