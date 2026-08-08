import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NewLocationForm } from "./new-location-form";

export const metadata: Metadata = { title: "New location" };

export default async function NewLocationPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>New location</CardTitle>
      </CardHeader>
      <CardContent>
        <NewLocationForm orgSlug={orgSlug} projectId={projectId} />
      </CardContent>
    </Card>
  );
}
