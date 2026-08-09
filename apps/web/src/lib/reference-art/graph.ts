import type { WorkflowGraph } from "@/lib/validations/workflows";
import type { ReferenceArtSubjectType } from "@/lib/validations/reference-art";

// Maps each Story Bible subject type to the routing_rules.task_type its
// reference-art workflow's model_task node targets (see the Module 9
// migration's seed insert).
export const REFERENCE_ART_TASK_TYPE: Record<ReferenceArtSubjectType, string> =
  {
    character: "character_reference_image",
    location: "environment_concept_art",
    prop: "prop_render",
  };

// The reference-art graph is intentionally the same minimal
// input -> model_task -> output shape as every Module 8 template — this
// is not a new kind of workflow, just one built from code instead of a
// stored template, since its params are the subject's own text rather
// than something a user fills in a form for.
export function buildReferenceArtGraph(
  subjectType: ReferenceArtSubjectType,
  description: string,
): WorkflowGraph {
  return {
    nodes: [
      {
        id: "description",
        type: "input",
        label: "Description",
        position: { x: 0, y: 0 },
        config: { key: "description", value: description },
      },
      {
        id: "generate",
        type: "model_task",
        label: "Generate reference image",
        position: { x: 260, y: 0 },
        config: {
          taskType: REFERENCE_ART_TASK_TYPE[subjectType],
          params: { description },
        },
      },
      {
        id: "image",
        type: "output",
        label: "Reference Image",
        position: { x: 520, y: 0 },
        config: { key: "image" },
      },
    ],
    edges: [
      { id: "e1", source: "description", target: "generate" },
      { id: "e2", source: "generate", target: "image" },
    ],
  };
}
