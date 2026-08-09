import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePlatformAdmin } from "@/lib/supabase/session";
import { workflowGraphSchema } from "@/lib/validations/workflows";
import type { TemplateCategory } from "@/lib/validations/workflow-templates";
import { WorkflowEditor } from "@/components/workflow-editor/workflow-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { updateWorkflowTemplateGraph } from "../actions";
import { EditTemplateForm } from "./edit-template-form";

export const metadata: Metadata = { title: "Workflow template" };

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const { supabase } = await requirePlatformAdmin();

  const { data: template } = await supabase
    .from("workflow_templates")
    .select("id, slug, name, description, category, graph")
    .eq("id", templateId)
    .single();

  if (!template) {
    notFound();
  }

  const graphResult = workflowGraphSchema.safeParse(template.graph);
  const initialGraph = graphResult.success
    ? graphResult.data
    : { nodes: [], edges: [] };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{template.name}</h1>
          <p className="text-muted-foreground text-sm">{template.slug}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <EditTemplateForm
            template={{
              templateId: template.id,
              name: template.name,
              description: template.description ?? "",
              category: template.category as TemplateCategory,
            }}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium">Graph</h2>
        <WorkflowEditor
          initialGraph={initialGraph}
          onSave={updateWorkflowTemplateGraph.bind(null, template.id)}
        />
      </div>
    </div>
  );
}
