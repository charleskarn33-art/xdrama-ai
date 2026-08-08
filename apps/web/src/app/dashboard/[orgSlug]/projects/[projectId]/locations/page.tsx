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

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, description")
    .eq("project_id", projectId)
    .order("name");

  const basePath = `/dashboard/${orgSlug}/projects/${projectId}/locations`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Reusable places this project&apos;s scenes are set in.
        </p>
        <Button asChild>
          <Link href={`${basePath}/new`}>New location</Link>
        </Button>
      </div>

      {locations && locations.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <Link key={location.id} href={`${basePath}/${location.id}`}>
              <Card className="h-full transition-colors hover:bg-secondary/40">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{location.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {location.description || "No description"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No locations yet</CardTitle>
            <CardDescription>
              Add your first location to start building the world.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
