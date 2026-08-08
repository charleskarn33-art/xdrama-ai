import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NewNoteForm } from "./new-note-form";

export const metadata: Metadata = { title: "New note" };

export default async function NewNotePage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>New note</CardTitle>
      </CardHeader>
      <CardContent>
        <NewNoteForm orgSlug={orgSlug} projectId={projectId} />
      </CardContent>
    </Card>
  );
}
