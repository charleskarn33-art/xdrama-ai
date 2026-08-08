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

export const metadata: Metadata = { title: "Characters" };

export default async function CharactersPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const { data: characters } = await supabase
    .from("characters")
    .select("id, name, description")
    .eq("project_id", projectId)
    .order("name");

  const basePath = `/dashboard/${orgSlug}/projects/${projectId}/characters`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Reusable characters this project&apos;s cast is built from.
        </p>
        <Button asChild>
          <Link href={`${basePath}/new`}>New character</Link>
        </Button>
      </div>

      {characters && characters.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <Link key={character.id} href={`${basePath}/${character.id}`}>
              <Card className="h-full transition-colors hover:bg-secondary/40">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{character.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {character.description || "No description"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No characters yet</CardTitle>
            <CardDescription>
              Add your first character to start building the cast.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
