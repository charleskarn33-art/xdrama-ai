import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { EditNoteForm } from "./edit-note-form";

export const metadata: Metadata = { title: "Note" };

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string; noteId: string }>;
}) {
  const { orgSlug, projectId, noteId } = await params;
  const { supabase } = await requireUser();

  const { data: note } = await supabase
    .from("story_bible_notes")
    .select("id, title, content")
    .eq("id", noteId)
    .eq("project_id", projectId)
    .single();

  if (!note) {
    notFound();
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>{note.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <EditNoteForm
          orgSlug={orgSlug}
          projectId={projectId}
          note={{
            noteId: note.id,
            title: note.title,
            content: note.content ?? "",
          }}
        />
      </CardContent>
    </Card>
  );
}
