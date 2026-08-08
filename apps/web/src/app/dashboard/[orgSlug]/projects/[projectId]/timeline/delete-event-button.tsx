"use client";

import * as React from "react";

import { deleteTimelineEvent } from "@/app/dashboard/[orgSlug]/projects/[projectId]/timeline/actions";
import { Button } from "@/components/ui/button";

export function DeleteEventButton({
  orgSlug,
  projectId,
  eventId,
}: {
  orgSlug: string;
  projectId: string;
  eventId: string;
}) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isDeleting}
      onClick={async () => {
        setIsDeleting(true);
        await deleteTimelineEvent(orgSlug, projectId, eventId);
      }}
    >
      Remove
    </Button>
  );
}
