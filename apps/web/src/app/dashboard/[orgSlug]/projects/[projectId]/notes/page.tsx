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

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const { data: notes } = await supabase
    .from("story_bible_notes")
    .select("id, title, content")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  const basePath = `/dashboard/${orgSlug}/projects/${projectId}/notes`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          World history, lore, and anything else that doesn&apos;t fit a character,
          location, or timeline entry.
        </p>
        <Button asChild>
          <Link href={`${basePath}/new`}>New note</Link>
        </Button>
      </div>

      {notes && notes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <Link key={note.id} href={`${basePath}/${note.id}`}>
              <Card className="h-full transition-colors hover:bg-secondary/40">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{note.title}</CardTitle>
                  <CardDescription className="line-clamp-3">
                    {note.content || "No content"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No notes yet</CardTitle>
            <CardDescription>
              Capture world history, magic systems, factions — anything worth
              remembering.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
