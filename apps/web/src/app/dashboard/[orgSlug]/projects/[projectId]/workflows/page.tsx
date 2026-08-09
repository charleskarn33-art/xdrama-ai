import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/supabase/session";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { NewWorkflowForm } from "./new-workflow-form";

export const metadata: Metadata = { title: "Workflows" };

const CATEGORY_LABEL: Record<string, string> = {
  movie: "Movie",
  trailer: "Trailer",
  commercial: "Commercial",
  music_video: "Music Video",
  animation: "Animation",
};

export default async function WorkflowsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const [{ data: workflows }, { data: templates }] = await Promise.all([
    supabase
      .from("workflows")
      .select("id, name, updated_at")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("workflow_templates")
      .select("id, slug, name, description, category")
      .order("name"),
  ]);

  const basePath = `/dashboard/${orgSlug}/projects/${projectId}/workflows`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          This project&apos;s workflows.
        </p>
        {workflows && workflows.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workflows.map((wf) => (
              <Link key={wf.id} href={`${basePath}/${wf.id}`}>
                <Card className="hover:bg-secondary/40 h-full transition-colors">
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{wf.name}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No workflows yet</CardTitle>
              <CardDescription>
                Start from a template below, or come back once you have one.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium">Start from a template</h2>
          <p className="text-muted-foreground text-sm">
            Clones the template&apos;s graph into a new workflow you can
            customize.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(templates ?? []).map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {template.name}
                  <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-normal">
                    {CATEGORY_LABEL[template.category] ?? template.category}
                  </span>
                </CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <NewWorkflowForm
                orgSlug={orgSlug}
                projectId={projectId}
                templateId={template.id}
                defaultName={template.name}
              />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
