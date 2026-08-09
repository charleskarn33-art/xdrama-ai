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

export const metadata: Metadata = { title: "Music Studio" };

export default async function MusicStudioPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const { data: tracks } = await supabase
    .from("music_tracks")
    .select("id, name, description")
    .eq("project_id", projectId)
    .order("name");

  const basePath = `/dashboard/${orgSlug}/projects/${projectId}/music`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Background score and music for this project&apos;s scenes.
        </p>
        <Button asChild>
          <Link href={`${basePath}/new`}>New track</Link>
        </Button>
      </div>

      {tracks && tracks.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track) => (
            <Link key={track.id} href={`${basePath}/${track.id}`}>
              <Card className="hover:bg-secondary/40 h-full transition-colors">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{track.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {track.description || "No description"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No tracks yet</CardTitle>
            <CardDescription>
              Add a track to start scoring this project.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
