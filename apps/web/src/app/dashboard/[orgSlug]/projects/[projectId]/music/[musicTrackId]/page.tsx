import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
import { getReferenceArtData } from "@/lib/reference-art/fetch";
import { ReferenceArtPanel } from "@/components/dashboard/reference-art-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { EditMusicTrackForm } from "./edit-music-track-form";

export const metadata: Metadata = { title: "Music track" };

export default async function MusicTrackDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string; musicTrackId: string }>;
}) {
  const { orgSlug, projectId, musicTrackId } = await params;
  const { supabase } = await requireUser();

  const [{ data: track }, { data: scenes }, referenceArt] = await Promise.all([
    supabase
      .from("music_tracks")
      .select("id, name, description, scene_id")
      .eq("id", musicTrackId)
      .eq("project_id", projectId)
      .single(),
    supabase
      .from("scenes")
      .select("id, title")
      .eq("project_id", projectId)
      .order("scene_order"),
    getReferenceArtData(supabase, "music_track", musicTrackId),
  ]);

  if (!track) {
    notFound();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{track.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <EditMusicTrackForm
            orgSlug={orgSlug}
            projectId={projectId}
            track={{
              musicTrackId: track.id,
              name: track.name,
              description: track.description ?? "",
              sceneId: track.scene_id ?? "",
            }}
            scenes={scenes ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Track audio</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferenceArtPanel
            orgSlug={orgSlug}
            projectId={projectId}
            subjectType="music_track"
            subjectId={musicTrackId}
            subjectName={track.name}
            description={track.description ?? track.name}
            initialWorkflowId={referenceArt.workflowId}
            initialJobs={referenceArt.jobs}
            title="Track audio"
            generateLabel="audio"
            emptyLabel="No audio generated yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
