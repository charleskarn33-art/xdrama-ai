import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { EditSceneForm } from "./edit-scene-form";
import { NewShotForm } from "./new-shot-form";

export const metadata: Metadata = { title: "Scene" };

const SHOT_TYPE_LABEL: Record<string, string> = {
  wide: "Wide",
  medium: "Medium",
  close_up: "Close-up",
  extreme_close_up: "Extreme close-up",
  pov: "POV",
  over_the_shoulder: "Over the shoulder",
  aerial: "Aerial",
};

export default async function SceneDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string; sceneId: string }>;
}) {
  const { orgSlug, projectId, sceneId } = await params;
  const { supabase } = await requireUser();

  const [
    { data: scene },
    { data: scripts },
    { data: locations },
    { data: shots },
  ] = await Promise.all([
    supabase
      .from("scenes")
      .select("id, title, description, scene_order, script_id, location_id")
      .eq("id", sceneId)
      .eq("project_id", projectId)
      .single(),
    supabase
      .from("scripts")
      .select("id, title")
      .eq("project_id", projectId)
      .order("title"),
    supabase
      .from("locations")
      .select("id, name")
      .eq("project_id", projectId)
      .order("name"),
    supabase
      .from("shots")
      .select("id, shot_order, shot_type, description, duration_seconds")
      .eq("scene_id", sceneId)
      .order("shot_order")
      .order("created_at"),
  ]);

  if (!scene) {
    notFound();
  }

  const basePath = `/dashboard/${orgSlug}/projects/${projectId}/scenes/${sceneId}`;
  const nextShotOrder = (shots?.at(-1)?.shot_order ?? 0) + 1;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{scene.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <EditSceneForm
            orgSlug={orgSlug}
            projectId={projectId}
            scene={{
              sceneId: scene.id,
              title: scene.title,
              description: scene.description ?? "",
              sceneOrder: scene.scene_order,
              scriptId: scene.script_id ?? "",
              locationId: scene.location_id ?? "",
            }}
            scripts={scripts ?? []}
            locations={locations ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shots</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {shots && shots.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {shots.map((shot) => (
                <li key={shot.id}>
                  <Link
                    href={`${basePath}/shots/${shot.id}`}
                    className="bg-secondary/40 hover:bg-secondary flex flex-col gap-1 rounded-md px-3 py-2 text-sm transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{shot.shot_order}.</span>
                      {shot.shot_type && (
                        <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-normal">
                          {SHOT_TYPE_LABEL[shot.shot_type] ?? shot.shot_type}
                        </span>
                      )}
                      {shot.duration_seconds && (
                        <span className="text-muted-foreground text-xs">
                          {shot.duration_seconds}s
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground line-clamp-2">
                      {shot.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No shots yet.</p>
          )}

          <NewShotForm
            orgSlug={orgSlug}
            projectId={projectId}
            sceneId={sceneId}
            nextShotOrder={nextShotOrder}
          />
        </CardContent>
      </Card>
    </div>
  );
}
