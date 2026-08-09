import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/supabase/session";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Scenes" };

export default async function ScenesPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const { data: scenes } = await supabase
    .from("scenes")
    .select("id, title, description, scene_order")
    .eq("project_id", projectId)
    .order("scene_order")
    .order("created_at");

  const basePath = `/dashboard/${orgSlug}/projects/${projectId}/scenes`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Scene-by-scene visual plan, broken into shots.
        </p>
        <Button asChild>
          <Link href={`${basePath}/new`}>New scene</Link>
        </Button>
      </div>

      {scenes && scenes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scenes.map((scene) => (
            <Link key={scene.id} href={`${basePath}/${scene.id}`}>
              <Card className="hover:bg-secondary/40 h-full transition-colors">
                <CardHeader>
                  <CardTitle className="line-clamp-1">
                    {scene.scene_order}. {scene.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {scene.description || "No description"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No scenes yet</CardTitle>
            <CardDescription>
              Add your first scene to start storyboarding.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
