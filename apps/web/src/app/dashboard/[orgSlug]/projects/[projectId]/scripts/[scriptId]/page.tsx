import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { EditScriptForm } from "./edit-script-form";

export const metadata: Metadata = { title: "Script" };

export default async function ScriptDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string; scriptId: string }>;
}) {
  const { orgSlug, projectId, scriptId } = await params;
  const { supabase } = await requireUser();

  const { data: script } = await supabase
    .from("scripts")
    .select("id, title, content, status")
    .eq("id", scriptId)
    .eq("project_id", projectId)
    .single();

  if (!script) {
    notFound();
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>{script.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <EditScriptForm
          orgSlug={orgSlug}
          projectId={projectId}
          script={{
            scriptId: script.id,
            title: script.title,
            content: script.content,
            status: script.status,
          }}
        />
      </CardContent>
    </Card>
  );
}
