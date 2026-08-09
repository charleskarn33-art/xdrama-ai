"use client";

import * as React from "react";

import { deleteWorkflow } from "@/app/dashboard/[orgSlug]/projects/[projectId]/workflows/actions";
import { Button } from "@/components/ui/button";

export function DeleteWorkflowButton({
  orgSlug,
  projectId,
  workflowId,
}: {
  orgSlug: string;
  projectId: string;
  workflowId: string;
}) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {error && <p className="text-destructive text-xs">{error}</p>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        disabled={isDeleting}
        onClick={async () => {
          setIsDeleting(true);
          setError(null);
          const result = await deleteWorkflow(orgSlug, projectId, workflowId);
          if (result.error) {
            setError(result.error);
            setIsDeleting(false);
          }
        }}
      >
        {isDeleting ? "Deleting..." : "Delete workflow"}
      </Button>
    </div>
  );
}
