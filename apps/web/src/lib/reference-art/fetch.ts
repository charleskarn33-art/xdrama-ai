import type { createClient } from "@/lib/supabase/server";
import type { ReferenceArtJob } from "@/lib/reference-art/actions";
import type { ReferenceArtSubjectType } from "@/lib/validations/reference-art";

// Shared by every Story Bible entity detail page (characters/locations/
// props) to load the data their <ReferenceArtPanel /> needs: at most one
// linked workflow per subject (see the migration's partial unique index)
// and that workflow's render job history.
export async function getReferenceArtData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subjectType: ReferenceArtSubjectType,
  subjectId: string,
): Promise<{ workflowId: string | null; jobs: ReferenceArtJob[] }> {
  const { data: workflow } = await supabase
    .from("workflows")
    .select("id")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .maybeSingle();

  if (!workflow) {
    return { workflowId: null, jobs: [] };
  }

  const { data: jobs } = await supabase
    .from("render_jobs")
    .select("id, status, error_message, created_at")
    .eq("workflow_id", workflow.id)
    .order("created_at", { ascending: false });

  return { workflowId: workflow.id, jobs: jobs ?? [] };
}
