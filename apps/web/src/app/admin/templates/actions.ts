"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/lib/supabase/session";
import type { Json } from "@/lib/supabase/types";
import {
  createWorkflowTemplateSchema,
  deleteWorkflowTemplateSchema,
  updateWorkflowTemplateGraphSchema,
  updateWorkflowTemplateSchema,
  type CreateWorkflowTemplateInput,
  type UpdateWorkflowTemplateInput,
} from "@/lib/validations/workflow-templates";
import type { WorkflowGraph } from "@/lib/validations/workflows";

export type ActionResult = { error: string } | { error: null };

const BASE_PATH = "/admin/templates";

// A single starter node, not a placeholder — passes validate_workflow_graph()
// as-is, and is exactly what a user would see first when opening the
// Workflow Builder to build out a new template from scratch.
const STARTER_GRAPH = {
  nodes: [
    {
      id: "input",
      type: "input",
      label: "Input",
      position: { x: 0, y: 0 },
      config: { key: "input" },
    },
  ],
  edges: [],
};

export async function createWorkflowTemplate(
  input: CreateWorkflowTemplateInput,
): Promise<ActionResult> {
  const parsed = createWorkflowTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requirePlatformAdmin();
  const { data: template, error } = await supabase
    .from("workflow_templates")
    .insert({
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category,
      graph: STARTER_GRAPH as unknown as Json,
    })
    .select("id")
    .single();

  if (error || !template) {
    return { error: error?.message ?? "Could not create template" };
  }

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}/${template.id}`);
}

export async function updateWorkflowTemplate(
  input: UpdateWorkflowTemplateInput,
): Promise<ActionResult> {
  const parsed = updateWorkflowTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase
    .from("workflow_templates")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category,
    })
    .eq("id", parsed.data.templateId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${BASE_PATH}/${parsed.data.templateId}`);
  return { error: null };
}

// Takes just a graph — the shape Module 15's shared WorkflowEditor's
// onSave prop expects. The template detail page (a Server Component)
// passes this down via `updateWorkflowTemplateGraph.bind(null,
// templateId)`, the documented pattern for handing a Client Component a
// Server Action pre-bound with extra arguments.
export async function updateWorkflowTemplateGraph(
  templateId: string,
  graph: WorkflowGraph,
): Promise<ActionResult> {
  const parsed = updateWorkflowTemplateGraphSchema.safeParse({ templateId, graph });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase
    .from("workflow_templates")
    // zod's `config: z.record(z.string(), z.unknown())` can't statically
    // prove JSON-serializability the way the generated `Json` type
    // demands, even though validate_workflow_graph() re-validates the
    // actual shape in Postgres (see the equivalent cast in the Module 8
    // workflows actions).
    .update({ graph: parsed.data.graph as unknown as Json })
    .eq("id", parsed.data.templateId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${BASE_PATH}/${parsed.data.templateId}`);
  return { error: null };
}

export async function deleteWorkflowTemplate(templateId: string): Promise<ActionResult> {
  const parsed = deleteWorkflowTemplateSchema.safeParse({ templateId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const { supabase } = await requirePlatformAdmin();
  const { error, count } = await supabase
    .from("workflow_templates")
    .delete({ count: "exact" })
    .eq("id", parsed.data.templateId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "You don't have permission to delete this template." };
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}
