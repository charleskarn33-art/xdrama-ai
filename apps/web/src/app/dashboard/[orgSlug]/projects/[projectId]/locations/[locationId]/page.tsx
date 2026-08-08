import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { EditLocationForm } from "./edit-location-form";

export const metadata: Metadata = { title: "Location" };

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string; locationId: string }>;
}) {
  const { orgSlug, projectId, locationId } = await params;
  const { supabase } = await requireUser();

  const { data: location } = await supabase
    .from("locations")
    .select("id, name, description")
    .eq("id", locationId)
    .eq("project_id", projectId)
    .single();

  if (!location) {
    notFound();
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>{location.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <EditLocationForm
          orgSlug={orgSlug}
          projectId={projectId}
          location={{
            locationId: location.id,
            name: location.name,
            description: location.description ?? "",
          }}
        />
      </CardContent>
    </Card>
  );
}
