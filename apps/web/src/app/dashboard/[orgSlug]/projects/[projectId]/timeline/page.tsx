import type { Metadata } from "next";

import { requireUser } from "@/lib/supabase/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NewEventForm } from "./new-event-form";
import { DeleteEventButton } from "./delete-event-button";

export const metadata: Metadata = { title: "Timeline" };

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const { data: events } = await supabase
    .from("timeline_events")
    .select("id, title, description, in_story_date, event_order")
    .eq("project_id", projectId)
    .order("event_order", { ascending: true });

  const nextOrder = events && events.length > 0
    ? Math.max(...events.map((e) => e.event_order)) + 1
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Add event</CardTitle>
        </CardHeader>
        <CardContent>
          <NewEventForm orgSlug={orgSlug} projectId={projectId} nextOrder={nextOrder} />
        </CardContent>
      </Card>

      {events && events.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="bg-secondary flex items-start justify-between gap-4 rounded-md px-4 py-3"
            >
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{event.title}</span>
                  {event.in_story_date && (
                    <span className="text-muted-foreground text-xs">
                      {event.in_story_date}
                    </span>
                  )}
                </div>
                {event.description && (
                  <p className="text-muted-foreground text-sm">{event.description}</p>
                )}
              </div>
              <DeleteEventButton orgSlug={orgSlug} projectId={projectId} eventId={event.id} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground text-sm">No timeline events yet.</p>
      )}
    </div>
  );
}
