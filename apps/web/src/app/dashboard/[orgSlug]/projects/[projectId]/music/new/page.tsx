import type { Metadata } from "next";

import { requireUser } from "@/lib/supabase/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NewMusicTrackForm } from "./new-music-track-form";

export const metadata: Metadata = { title: "New track" };

export default async function NewMusicTrackPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const { data: scenes } = await supabase
    .from("scenes")
    .select("id, title")
    .eq("project_id", projectId)
    .order("scene_order");

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>New track</CardTitle>
      </CardHeader>
      <CardContent>
        <NewMusicTrackForm
          orgSlug={orgSlug}
          projectId={projectId}
          scenes={scenes ?? []}
        />
      </CardContent>
    </Card>
  );
}
