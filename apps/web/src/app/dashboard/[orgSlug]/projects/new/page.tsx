import type { Metadata } from "next";

import { requireUser } from "@/lib/supabase/session";
import { requireOrgMembership } from "@/lib/supabase/orgs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { NewProjectForm } from "./new-project-form";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase, user } = await requireUser();
  const { org } = await requireOrgMembership(supabase, user.id, orgSlug);

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>New project</CardTitle>
        <CardDescription>in {org.name}</CardDescription>
      </CardHeader>
      <CardContent>
        <NewProjectForm orgId={org.id} orgSlug={orgSlug} />
      </CardContent>
    </Card>
  );
}
