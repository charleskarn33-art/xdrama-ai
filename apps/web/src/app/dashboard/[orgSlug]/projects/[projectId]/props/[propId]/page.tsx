import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
import { getReferenceArtData } from "@/lib/reference-art/fetch";
import { ReferenceArtPanel } from "@/components/dashboard/reference-art-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { EditPropForm } from "./edit-prop-form";

export const metadata: Metadata = { title: "Prop" };

export default async function PropDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string; propId: string }>;
}) {
  const { orgSlug, projectId, propId } = await params;
  const { supabase } = await requireUser();

  const [{ data: prop }, referenceArt] = await Promise.all([
    supabase
      .from("props")
      .select("id, name, description, appearance")
      .eq("id", propId)
      .eq("project_id", projectId)
      .single(),
    getReferenceArtData(supabase, "prop", propId),
  ]);

  if (!prop) {
    notFound();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{prop.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <EditPropForm
            orgSlug={orgSlug}
            projectId={projectId}
            prop={{
              propId: prop.id,
              name: prop.name,
              description: prop.description ?? "",
              appearance: prop.appearance ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reference art</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferenceArtPanel
            orgSlug={orgSlug}
            projectId={projectId}
            subjectType="prop"
            subjectId={propId}
            subjectName={prop.name}
            description={[prop.appearance, prop.description]
              .filter(Boolean)
              .join("\n\n")}
            initialWorkflowId={referenceArt.workflowId}
            initialJobs={referenceArt.jobs}
          />
        </CardContent>
      </Card>
    </div>
  );
}
