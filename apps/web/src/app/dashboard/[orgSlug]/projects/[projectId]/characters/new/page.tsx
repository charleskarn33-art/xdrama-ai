import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NewCharacterForm } from "./new-character-form";

export const metadata: Metadata = { title: "New character" };

export default async function NewCharacterPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>New character</CardTitle>
      </CardHeader>
      <CardContent>
        <NewCharacterForm orgSlug={orgSlug} projectId={projectId} />
      </CardContent>
    </Card>
  );
}
