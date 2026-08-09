import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { EditTimelineForm } from "./edit-timeline-form";
import { AddClipForm, type AvailableShot } from "./add-clip-form";
import { ClipRow, type ClipRowData } from "./clip-row";

export const metadata: Metadata = { title: "Timeline" };

export default async function TimelineDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string; timelineId: string }>;
}) {
  const { orgSlug, projectId, timelineId } = await params;
  const { supabase } = await requireUser();

  const [{ data: timeline }, { data: scenes }, { data: clips }] =
    await Promise.all([
      supabase
        .from("movie_timelines")
        .select("id, name, description")
        .eq("id", timelineId)
        .eq("project_id", projectId)
        .single(),
      supabase.from("scenes").select("id, title").eq("project_id", projectId),
      supabase
        .from("timeline_clips")
        .select(
          "id, clip_order, transition_in, trim_start_seconds, trim_end_seconds, source_render_job_id, shot:shots(id, shot_order, description, scene_id)",
        )
        .eq("timeline_id", timelineId)
        .order("clip_order")
        .order("created_at"),
    ]);

  if (!timeline) {
    notFound();
  }

  const sceneTitleById = new Map((scenes ?? []).map((s) => [s.id, s.title]));
  const sceneIds = (scenes ?? []).map((s) => s.id);

  // `.in()` with an empty array matches nothing predictably in Postgrest,
  // but skip the query entirely rather than rely on that.
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

  const clipRows: ClipRowData[] = (clips ?? [])
    .filter(
      (c): c is typeof c & { shot: NonNullable<typeof c.shot> } =>
        c.shot !== null,
    )
    .map((c) => ({
      clipId: c.id,
      clipOrder: c.clip_order,
      transitionIn: c.transition_in,
      trimStartSeconds: c.trim_start_seconds ?? undefined,
      trimEndSeconds: c.trim_end_seconds ?? undefined,
      sceneTitle: sceneTitleById.get(c.shot.scene_id) ?? "Unknown scene",
      shotOrder: c.shot.shot_order,
      shotDescription: c.shot.description,
      hasSourceRender: c.source_render_job_id !== null,
    }));

  const nextClipOrder = (clips?.at(-1)?.clip_order ?? 0) + 1;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{timeline.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <EditTimelineForm
            orgSlug={orgSlug}
            projectId={projectId}
            timeline={{
              timelineId: timeline.id,
              name: timeline.name,
              description: timeline.description ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clips</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {clipRows.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {clipRows.map((clip) => (
                <li key={clip.clipId}>
                  <ClipRow
                    orgSlug={orgSlug}
                    projectId={projectId}
                    timelineId={timelineId}
                    clip={clip}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No clips yet.</p>
          )}

          <AddClipForm
            orgSlug={orgSlug}
            projectId={projectId}
            timelineId={timelineId}
            nextClipOrder={nextClipOrder}
            availableShots={availableShots}
          />
        </CardContent>
      </Card>
    </div>
  );
}
