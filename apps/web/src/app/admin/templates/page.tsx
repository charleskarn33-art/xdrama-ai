import type { Metadata } from "next";
import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/supabase/session";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Workflow Templates" };

const CATEGORY_LABEL: Record<string, string> = {
  movie: "Movie",
  trailer: "Trailer",
  commercial: "Commercial",
  music_video: "Music Video",
  animation: "Animation",
};

export default async function AdminTemplatesPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: templates } = await supabase
    .from("workflow_templates")
    .select("id, slug, name, description, category, graph")
    .order("category")
    .order("name");

  const categories = Array.from(
    new Set((templates ?? []).map((t) => t.category)),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Workflow Templates
          </h1>
          <p className="text-muted-foreground text-sm">
            The platform-wide catalog of starter graphs. Cloning a template
            into a project (Module 8) copies its <code>graph</code> as-is —
            edit a template here with the same node-based Workflow Builder
            used for project workflows.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/templates/new">New template</Link>
        </Button>
      </div>

      {categories.length === 0 && (
        <p className="text-muted-foreground text-sm">No templates yet.</p>
      )}

      {categories.map((category) => (
        <div key={category} className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">
            {CATEGORY_LABEL[category] ?? category}
          </h2>
          <div className="flex flex-col gap-3">
            {(templates ?? [])
              .filter((t) => t.category === category)
              .map((template) => {
                const graph = template.graph as { nodes?: unknown[] } | null;
                const nodeCount = Array.isArray(graph?.nodes)
                  ? graph.nodes.length
                  : 0;
                return (
                  <Link key={template.id} href={`/admin/templates/${template.id}`}>
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardHeader className="flex-row items-start justify-between space-y-0">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {template.name}
                            <span className="text-muted-foreground text-xs font-normal">
                              {template.slug}
                            </span>
                          </CardTitle>
                          <CardDescription>
                            {template.description || "No description"}
                          </CardDescription>
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {nodeCount} node{nodeCount === 1 ? "" : "s"}
                        </span>
                      </CardHeader>
                    </Card>
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
