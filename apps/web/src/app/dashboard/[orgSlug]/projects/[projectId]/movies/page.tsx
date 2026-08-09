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

export const metadata: Metadata = { title: "Movie Composer" };

export default async function MovieTimelinesPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const { data: timelines } = await supabase
    .from("movie_timelines")
    .select("id, name, description, updated_at")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  const basePath = `/dashboard/${orgSlug}/projects/${projectId}/movies`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Assemble shots into an ordered edit — the sequence a future export
          renders from.
        </p>
        <Button asChild>
          <Link href={`${basePath}/new`}>New timeline</Link>
        </Button>
      </div>

      {timelines && timelines.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {timelines.map((timeline) => (
            <Link key={timeline.id} href={`${basePath}/${timeline.id}`}>
              <Card className="hover:bg-secondary/40 h-full transition-colors">
                <CardHeader>
                  <CardTitle className="line-clamp-1">
                    {timeline.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {timeline.description || "No description"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No timelines yet</CardTitle>
            <CardDescription>
              Start a timeline to begin assembling shots into an edit.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
