import type { Metadata } from "next";

import { requireUser } from "@/lib/supabase/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NewVoiceLineForm, type AvailableShot } from "./new-voice-line-form";

export const metadata: Metadata = { title: "New voice line" };

export default async function NewVoiceLinePage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const [{ data: characters }, { data: scenes }] = await Promise.all([
    supabase
      .from("characters")
      .select("id, name")
      .eq("project_id", projectId)
      .order("name"),
    supabase.from("scenes").select("id, title").eq("project_id", projectId),
  ]);

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
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>New voice line</CardTitle>
      </CardHeader>
      <CardContent>
        <NewVoiceLineForm
          orgSlug={orgSlug}
          projectId={projectId}
          characters={characters ?? []}
          availableShots={availableShots}
        />
      </CardContent>
    </Card>
  );
}
