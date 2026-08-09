import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
import { getReferenceArtData } from "@/lib/reference-art/fetch";
import { ReferenceArtPanel } from "@/components/dashboard/reference-art-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { EditVoiceLineForm } from "./edit-voice-line-form";
import type { AvailableShot } from "../new/new-voice-line-form";

export const metadata: Metadata = { title: "Voice line" };

export default async function VoiceLineDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string; voiceLineId: string }>;
}) {
  const { orgSlug, projectId, voiceLineId } = await params;
  const { supabase } = await requireUser();

  const [
    { data: voiceLine },
    { data: characters },
    { data: scenes },
    referenceArt,
  ] = await Promise.all([
    supabase
      .from("voice_lines")
      .select("id, text, line_order, character_id, shot_id")
      .eq("id", voiceLineId)
      .eq("project_id", projectId)
      .single(),
    supabase
      .from("characters")
      .select("id, name")
      .eq("project_id", projectId)
      .order("name"),
    supabase.from("scenes").select("id, title").eq("project_id", projectId),
    getReferenceArtData(supabase, "voice_line", voiceLineId),
  ]);

  if (!voiceLine) {
    notFound();
  }

  const sceneTitleById = new Map((scenes ?? []).map((s) => [s.id, s.title]));
  const sceneIds = (scenes ?? []).map((s) => s.id);

  const { data: shots } =
    sceneIds.length > 0
      ? await supabase
          .from("shots")
          .select("id, shot_order, description, scene_id")
          .in("scene_id", sceneIds)
          .order("shot_order")
      : { data: [] };

  const availableShots: AvailableShot[] = (shots ?? []).map((shot) => ({
    id: shot.id,
    sceneTitle: sceneTitleById.get(shot.scene_id) ?? "Unknown scene",
    shotOrder: shot.shot_order,
    description: shot.description,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Voice line</CardTitle>
        </CardHeader>
        <CardContent>
          <EditVoiceLineForm
            orgSlug={orgSlug}
            projectId={projectId}
            voiceLine={{
              voiceLineId: voiceLine.id,
              text: voiceLine.text,
              lineOrder: voiceLine.line_order,
              characterId: voiceLine.character_id ?? "",
              shotId: voiceLine.shot_id ?? "",
            }}
            characters={characters ?? []}
            availableShots={availableShots}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voice audio</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferenceArtPanel
            orgSlug={orgSlug}
            projectId={projectId}
            subjectType="voice_line"
            subjectId={voiceLineId}
            subjectName={voiceLine.text.slice(0, 60)}
            description={voiceLine.text}
            initialWorkflowId={referenceArt.workflowId}
            initialJobs={referenceArt.jobs}
            title="Voice audio"
            generateLabel="audio"
            emptyLabel="No audio generated yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
