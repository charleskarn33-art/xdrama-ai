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

export const metadata: Metadata = { title: "Props" };

export default async function PropsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const { data: props } = await supabase
    .from("props")
    .select("id, name, description")
    .eq("project_id", projectId)
    .order("name");

  const basePath = `/dashboard/${orgSlug}/projects/${projectId}/props`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Reusable objects this project&apos;s scenes call for.
        </p>
        <Button asChild>
          <Link href={`${basePath}/new`}>New prop</Link>
        </Button>
      </div>

      {props && props.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {props.map((prop) => (
            <Link key={prop.id} href={`${basePath}/${prop.id}`}>
              <Card className="hover:bg-secondary/40 h-full transition-colors">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{prop.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {prop.description || "No description"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No props yet</CardTitle>
            <CardDescription>
              Add your first prop to start building the world.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
