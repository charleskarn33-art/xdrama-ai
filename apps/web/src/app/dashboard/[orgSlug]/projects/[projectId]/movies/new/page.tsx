import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NewTimelineForm } from "./new-timeline-form";

export const metadata: Metadata = { title: "New timeline" };

export default async function NewTimelinePage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>New timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <NewTimelineForm orgSlug={orgSlug} projectId={projectId} />
      </CardContent>
    </Card>
  );
}
