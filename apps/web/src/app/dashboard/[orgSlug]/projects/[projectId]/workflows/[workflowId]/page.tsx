import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
import { workflowGraphSchema } from "@/lib/validations/workflows";

import { WorkflowEditor } from "./workflow-editor";
import { RenderPanel } from "./render-panel";
import { DeleteWorkflowButton } from "./delete-workflow-button";

export const metadata: Metadata = { title: "Workflow" };

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string; workflowId: string }>;
}) {
  const { orgSlug, projectId, workflowId } = await params;
  const { supabase } = await requireUser();

  const [{ data: workflow }, { data: jobs }] = await Promise.all([
    supabase
      .from("workflows")
      .select("id, name, graph")
      .eq("id", workflowId)
      .eq("project_id", projectId)
      .single(),
    supabase
      .from("render_jobs")
      .select("id, status, error_message, created_at")
      .eq("workflow_id", workflowId)
      .order("created_at", { ascending: false }),
  ]);

  if (!workflow) {
    notFound();
  }

  const graphResult = workflowGraphSchema.safeParse(workflow.graph);
  const initialGraph = graphResult.success
    ? graphResult.data
    : { nodes: [], edges: [] };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{workflow.name}</h1>
        <DeleteWorkflowButton
          orgSlug={orgSlug}
          projectId={projectId}
          workflowId={workflowId}
        />
      </div>

      <WorkflowEditor
        orgSlug={orgSlug}
        projectId={projectId}
        workflowId={workflowId}
        initialGraph={initialGraph}
      />

      <RenderPanel
        orgSlug={orgSlug}
        projectId={projectId}
        workflowId={workflowId}
        initialJobs={jobs ?? []}
      />
    </div>
  );
}
