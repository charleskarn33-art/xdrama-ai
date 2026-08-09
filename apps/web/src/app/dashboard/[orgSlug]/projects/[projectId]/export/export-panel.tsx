"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createAndDispatchExportJob,
  type ExportJob,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/export/actions";
import {
  createExportJobSchema,
  type CreateExportJobInput,
} from "@/lib/validations/export-studio";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "none";

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-secondary text-secondary-foreground",
  running: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  completed:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-secondary text-secondary-foreground",
};

export function ExportPanel({
  orgSlug,
  projectId,
  timelines,
  presets,
  initialJobs,
}: {
  orgSlug: string;
  projectId: string;
  timelines: { id: string; name: string }[];
  presets: {
    id: string;
    name: string;
    platform: string;
    width: number;
    height: number;
  }[];
  initialJobs: ExportJob[];
}) {
  const [jobs, setJobs] = React.useState(initialJobs);
  const [error, setError] = React.useState<string | null>(null);

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<CreateExportJobInput>({
    resolver: zodResolver(createExportJobSchema),
    defaultValues: {
      projectId,
      timelineId: timelines[0]?.id ?? "",
      presetId: presets[0]?.id ?? "",
    },
  });

  async function onSubmit(data: CreateExportJobInput) {
    setError(null);
    const result = await createAndDispatchExportJob(orgSlug, data);
    if (result.error !== null) {
      setError(result.error);
    } else {
      setJobs((prev) => [result.job, ...prev]);
    }
  }

  const timelineName = (id: string) =>
    timelines.find((t) => t.id === id)?.name ?? "Unknown timeline";
  const presetName = (id: string | null) =>
    id
      ? (presets.find((p) => p.id === id)?.name ?? "Unknown preset")
      : "No preset";

  if (timelines.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Create a timeline in Movie Composer before exporting.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-wrap items-end gap-3"
        noValidate
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Timeline</span>
          <Controller
            control={control}
            name="timelineId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timelines.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Format</span>
          <Controller
            control={control}
            name="presetId"
            render={({ field }) => (
              <Select
                value={field.value || NONE}
                onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No preset</SelectItem>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.width}×{p.height})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Exporting..." : "Export"}
        </Button>
      </form>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {jobs.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="bg-secondary/40 flex flex-col gap-1 rounded-md px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {timelineName(job.timeline_id)} — {presetName(job.preset_id)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[job.status] ?? ""}`}
                >
                  {job.status}
                </span>
              </div>
              <span className="text-muted-foreground font-mono text-xs">
                {new Date(job.created_at).toLocaleString()}
              </span>
              {job.error_message && (
                <p className="text-muted-foreground text-xs">
                  {job.error_message}
                </p>
              )}
              {job.output_asset_url && (
                <a
                  href={job.output_asset_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs underline underline-offset-4"
                >
                  Download
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No export attempts yet.</p>
      )}
    </div>
  );
}
