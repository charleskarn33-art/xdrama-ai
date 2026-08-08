import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NewScriptForm } from "./new-script-form";

export const metadata: Metadata = { title: "New script" };

export default async function NewScriptPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>New script</CardTitle>
      </CardHeader>
      <CardContent>
        <NewScriptForm orgSlug={orgSlug} projectId={projectId} />
      </CardContent>
    </Card>
  );
}
