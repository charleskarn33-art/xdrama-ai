import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
import { getReferenceArtData } from "@/lib/reference-art/fetch";
import { ReferenceArtPanel } from "@/components/dashboard/reference-art-panel";
import { SHOT_TYPES, type UpdateShotInput } from "@/lib/validations/storyboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { EditShotForm } from "./edit-shot-form";
import { ShotCharactersPanel } from "./shot-characters-panel";

export const metadata: Metadata = { title: "Shot" };

export default async function ShotDetailPage({
  params,
}: {
  params: Promise<{
    orgSlug: string;
    projectId: string;
    sceneId: string;
    shotId: string;
  }>;
}) {
  const { orgSlug, projectId, sceneId, shotId } = await params;
  const { supabase } = await requireUser();

  const [
    { data: shot },
    { data: tagged },
    { data: allCharacters },
    referenceArt,
  ] = await Promise.all([
    supabase
      .from("shots")
      .select(
        "id, shot_order, shot_type, description, duration_seconds, project_id",
      )
      .eq("id", shotId)
      .eq("scene_id", sceneId)
      .single(),
    supabase
      .from("shot_characters")
      .select("character_id, character:characters(id, name)")
      .eq("shot_id", shotId),
    supabase
      .from("characters")
      .select("id, name")
      .eq("project_id", projectId)
      .order("name"),
    getReferenceArtData(supabase, "shot", shotId),
  ]);

  if (!shot || shot.project_id !== projectId) {
    notFound();
  }

  const knownShotType = SHOT_TYPES.find((t) => t === shot.shot_type);
  const shotType: UpdateShotInput["shotType"] = knownShotType ?? "";

  const taggedCharacters = (tagged ?? [])
    .map((t) => t.character)
    .filter((c): c is { id: string; name: string } => c !== null);
  const taggedIds = new Set(taggedCharacters.map((c) => c.id));
  const availableCharacters = (allCharacters ?? []).filter(
    (c) => !taggedIds.has(c.id),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Shot {shot.shot_order}</CardTitle>
        </CardHeader>
        <CardContent>
          <EditShotForm
            orgSlug={orgSlug}
            projectId={projectId}
            sceneId={sceneId}
            shot={{
              shotId: shot.id,
              shotOrder: shot.shot_order,
              shotType,
              description: shot.description,
              durationSeconds: shot.duration_seconds ?? undefined,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Characters in shot</CardTitle>
        </CardHeader>
        <CardContent>
          <ShotCharactersPanel
            orgSlug={orgSlug}
            projectId={projectId}
            sceneId={sceneId}
            shotId={shotId}
            taggedCharacters={taggedCharacters}
            availableCharacters={availableCharacters}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Storyboard frame</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferenceArtPanel
            orgSlug={orgSlug}
            projectId={projectId}
            subjectType="shot"
            subjectId={shotId}
            subjectName={`Shot ${shot.shot_order}`}
            description={shot.description}
            initialWorkflowId={referenceArt.workflowId}
            initialJobs={referenceArt.jobs}
          />
        </CardContent>
      </Card>
    </div>
  );
}
