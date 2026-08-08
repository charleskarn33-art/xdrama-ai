import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { EditCharacterForm } from "./edit-character-form";
import { RelationshipsPanel, type RelationshipRow } from "./relationships-panel";

export const metadata: Metadata = { title: "Character" };

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string; characterId: string }>;
}) {
  const { orgSlug, projectId, characterId } = await params;
  const { supabase } = await requireUser();

  const [{ data: character }, { data: otherCharacters }, { data: outgoing }, { data: incoming }] =
    await Promise.all([
      supabase
        .from("characters")
        .select("id, name, description, appearance, personality, voice_description")
        .eq("id", characterId)
        .eq("project_id", projectId)
        .single(),
      supabase
        .from("characters")
        .select("id, name")
        .eq("project_id", projectId)
        .neq("id", characterId)
        .order("name"),
      supabase
        .from("character_relationships")
        .select("id, relationship_type, description, related_character:characters!character_relationships_related_character_id_fkey(name)")
        .eq("character_id", characterId),
      supabase
        .from("character_relationships")
        .select("id, relationship_type, description, character:characters!character_relationships_character_id_fkey(name)")
        .eq("related_character_id", characterId),
    ]);

  if (!character) {
    notFound();
  }

  const relationships: RelationshipRow[] = [
    ...(outgoing ?? []).map((r) => ({
      id: r.id,
      otherCharacterName: r.related_character?.name ?? "Unknown",
      relationshipType: r.relationship_type,
      description: r.description,
    })),
    ...(incoming ?? []).map((r) => ({
      id: r.id,
      otherCharacterName: r.character?.name ?? "Unknown",
      relationshipType: r.relationship_type,
      description: r.description,
    })),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{character.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <EditCharacterForm
            orgSlug={orgSlug}
            projectId={projectId}
            character={{
              characterId: character.id,
              name: character.name,
              description: character.description ?? "",
              appearance: character.appearance ?? "",
              personality: character.personality ?? "",
              voiceDescription: character.voice_description ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relationships</CardTitle>
        </CardHeader>
        <CardContent>
          <RelationshipsPanel
            orgSlug={orgSlug}
            projectId={projectId}
            characterId={characterId}
            relationships={relationships}
            otherCharacters={otherCharacters ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
