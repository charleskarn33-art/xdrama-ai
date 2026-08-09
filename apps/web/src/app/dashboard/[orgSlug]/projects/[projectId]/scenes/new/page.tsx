import type { Metadata } from "next";

import { requireUser } from "@/lib/supabase/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NewSceneForm } from "./new-scene-form";

export const metadata: Metadata = { title: "New scene" };

export default async function NewScenePage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const [{ data: scripts }, { data: locations }] = await Promise.all([
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
  ]);

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>New scene</CardTitle>
      </CardHeader>
      <CardContent>
        <NewSceneForm
          orgSlug={orgSlug}
          projectId={projectId}
          scripts={scripts ?? []}
          locations={locations ?? []}
        />
      </CardContent>
    </Card>
  );
}
