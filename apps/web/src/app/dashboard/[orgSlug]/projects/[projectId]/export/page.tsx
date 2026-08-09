import type { Metadata } from "next";

import { requireUser } from "@/lib/supabase/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ExportPanel } from "./export-panel";

export const metadata: Metadata = { title: "Export Studio" };

export default async function ExportStudioPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const [{ data: timelines }, { data: presets }, { data: jobs }] =
    await Promise.all([
      supabase
        .from("movie_timelines")
        .select("id, name")
        .eq("project_id", projectId)
        .order("name"),
      supabase
        .from("export_presets")
        .select("id, name, platform, width, height")
        .order("platform"),
      supabase
        .from("export_jobs")
        .select(
          "id, status, output_asset_url, error_message, created_at, timeline_id, preset_id",
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">
        Export a movie timeline to a real, verifiable platform format. Each
        export attempt composites that timeline&apos;s clips from their rendered
        source assets — with none rendered yet (no GPU infrastructure), exports
        honestly report that rather than fabricating a file.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Exports</CardTitle>
        </CardHeader>
        <CardContent>
          <ExportPanel
            orgSlug={orgSlug}
            projectId={projectId}
            timelines={timelines ?? []}
            presets={presets ?? []}
            initialJobs={jobs ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
