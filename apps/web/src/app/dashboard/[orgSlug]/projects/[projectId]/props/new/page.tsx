import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NewPropForm } from "./new-prop-form";

export const metadata: Metadata = { title: "New prop" };

export default async function NewPropPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>New prop</CardTitle>
      </CardHeader>
      <CardContent>
        <NewPropForm orgSlug={orgSlug} projectId={projectId} />
      </CardContent>
    </Card>
  );
}
