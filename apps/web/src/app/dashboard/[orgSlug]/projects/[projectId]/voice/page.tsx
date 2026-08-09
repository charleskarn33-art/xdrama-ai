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

export const metadata: Metadata = { title: "Voice Studio" };

export default async function VoiceStudioPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const { data: voiceLines } = await supabase
    .from("voice_lines")
    .select("id, text, line_order, character:characters(name)")
    .eq("project_id", projectId)
    .order("line_order")
    .order("created_at");

  const basePath = `/dashboard/${orgSlug}/projects/${projectId}/voice`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Dialogue lines this project&apos;s characters speak.
        </p>
        <Button asChild>
          <Link href={`${basePath}/new`}>New voice line</Link>
        </Button>
      </div>

      {voiceLines && voiceLines.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {voiceLines.map((line) => (
            <Link key={line.id} href={`${basePath}/${line.id}`}>
              <Card className="hover:bg-secondary/40 h-full transition-colors">
                <CardHeader>
                  <CardTitle className="line-clamp-1">
                    {line.character?.name ?? "Unassigned"}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {line.text}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No voice lines yet</CardTitle>
            <CardDescription>
              Add dialogue for a character to start building the voice track.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
