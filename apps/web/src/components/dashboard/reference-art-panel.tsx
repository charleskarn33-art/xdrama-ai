"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
  generateReferenceArt,
  type ReferenceArtJob,
} from "@/lib/reference-art/actions";
import type { ReferenceArtSubjectType } from "@/lib/validations/reference-art";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-secondary text-secondary-foreground",
  running: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  completed:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-secondary text-secondary-foreground",
};

export function ReferenceArtPanel({
  orgSlug,
  projectId,
  subjectType,
  subjectId,
  subjectName,
  description,
  initialWorkflowId,
  initialJobs,
}: {
  orgSlug: string;
  projectId: string;
  subjectType: ReferenceArtSubjectType;
  subjectId: string;
  subjectName: string;
  description: string;
  initialWorkflowId: string | null;
  initialJobs: ReferenceArtJob[];
}) {
  const pathname = usePathname();
  const [workflowId, setWorkflowId] = React.useState(initialWorkflowId);
  const [jobs, setJobs] = React.useState<ReferenceArtJob[]>(initialJobs);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!workflowId) {
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`reference_art:${workflowId}`)
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
            const row = payload.new as ReferenceArtJob;
            setJobs((prev) =>
              prev.some((j) => j.id === row.id) ? prev : [row, ...prev],
            );
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as ReferenceArtJob;
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

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    const result = await generateReferenceArt(orgSlug, {
      projectId,
      subjectType,
      subjectId,
      subjectName,
      description,
      path: pathname,
    });
    if (result.error !== null) {
      setError(result.error);
    } else {
      setWorkflowId(result.workflowId);
      setJobs((prev) =>
        prev.some((j) => j.id === result.job.id)
          ? prev.map((j) => (j.id === result.job.id ? result.job : j))
          : [result.job, ...prev],
      );
    }
    setIsGenerating(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Reference art</h3>
        <Button size="sm" disabled={isGenerating} onClick={handleGenerate}>
          {isGenerating
            ? "Starting..."
            : jobs.length > 0
              ? "Regenerate"
              : "Generate reference image"}
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
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[job.status] ?? ""}`}
              >
                {job.status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          No reference art generated yet.
        </p>
      )}

      {jobs
        .filter((job) => job.error_message)
        .map((job) => (
          <p
            key={job.id}
            className="text-muted-foreground border-t pt-2 text-xs"
          >
            <span className="font-mono">{job.id.slice(0, 8)}</span>:{" "}
            {job.error_message}
          </p>
        ))}
    </div>
  );
}
