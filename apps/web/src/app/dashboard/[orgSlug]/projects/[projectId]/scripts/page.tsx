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

export const metadata: Metadata = { title: "Scripts" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  final: "Final",
};

export default async function ScriptsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const { data: scripts } = await supabase
    .from("scripts")
    .select("id, title, status, updated_at")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  const basePath = `/dashboard/${orgSlug}/projects/${projectId}/scripts`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Drafts and treatments this project&apos;s scenes will be built from.
        </p>
        <Button asChild>
          <Link href={`${basePath}/new`}>New script</Link>
        </Button>
      </div>

      {scripts && scripts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scripts.map((script) => (
            <Link key={script.id} href={`${basePath}/${script.id}`}>
              <Card className="h-full transition-colors hover:bg-secondary/40">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{script.title}</CardTitle>
                  <CardDescription>
                    <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-1 text-xs font-medium">
                      {STATUS_LABEL[script.status] ?? script.status}
                    </span>
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No scripts yet</CardTitle>
            <CardDescription>
              Write your first draft to start turning this project into a movie.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
