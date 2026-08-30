"use client";

import * as React from "react";

import { createAndDispatchRenderJob } from "@/app/dashboard/[orgSlug]/projects/[projectId]/workflows/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type RenderJob = {
  id: string;
  status: string;
  stage: string | null;
  error_message: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-secondary text-secondary-foreground",
  running: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  completed:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-secondary text-secondary-foreground",
};

export function RenderPanel({
  orgSlug,
  projectId,
  workflowId,
  initialJobs,
}: {
  orgSlug: string;
  projectId: string;
  workflowId: string;
  initialJobs: RenderJob[];
}) {
  const [jobs, setJobs] = React.useState<RenderJob[]>(initialJobs);
  const [isDispatching, setIsDispatching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`render_jobs:${workflowId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "render_jobs",
          filter: `workflow_id=eq.${workflowId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as RenderJob;
            setJobs((prev) => [row, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as RenderJob;
            setJobs((prev) =>
              prev.map((job) => (job.id === row.id ? row : job)),
            );
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workflowId]);

  async function handleRender() {
    setIsDispatching(true);
    setError(null);
    const result = await createAndDispatchRenderJob(orgSlug, {
      projectId,
      workflowId,
    });
    if (result.error) {
      setError(result.error);
    }
    setIsDispatching(false);
  }

  const jobsWithErrors = jobs.filter((job) => job.error_message);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Render jobs</h3>
        <Button size="sm" disabled={isDispatching} onClick={handleRender}>
          {isDispatching ? "Starting..." : "Render"}
        </Button>
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      {jobs.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="bg-secondary/40 flex items-center justify-between rounded-md px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground font-mono text-xs">
                {job.id.slice(0, 8)}
              </span>
              <span className="flex items-center gap-1.5">
                {job.status === "running" && job.stage && (
                  <span className="text-muted-foreground text-xs italic">
                    {job.stage.replace(/_/g, " ")}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[job.status] ?? ""}`}
                >
                  {job.status}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No render jobs yet.</p>
      )}

      {jobsWithErrors.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-2">
          {jobsWithErrors.map((job) => (
            <p key={job.id} className="text-muted-foreground text-xs">
              <span className="font-mono">{job.id.slice(0, 8)}</span>:{" "}
              {job.error_message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
