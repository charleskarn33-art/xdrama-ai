"use client";

import * as React from "react";

import { updateWorkflow } from "@/app/dashboard/[orgSlug]/projects/[projectId]/workflows/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RenameWorkflowForm({
  orgSlug,
  projectId,
  workflowId,
  name,
}: {
  orgSlug: string;
  projectId: string;
  workflowId: string;
  name: string;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [value, setValue] = React.useState(name);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(name);
          setIsEditing(true);
        }}
        className="hover:text-primary text-xl font-semibold transition-colors"
        title="Rename workflow"
      >
        {name}
      </button>
    );
  }

  async function onSave() {
    setIsSaving(true);
    setError(null);
    const result = await updateWorkflow(orgSlug, projectId, {
      workflowId,
      name: value,
    });
    if (result.error) {
      setError(result.error);
      setIsSaving(false);
    } else {
      setIsEditing(false);
      setIsSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 max-w-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") setIsEditing(false);
        }}
      />
      <Button type="button" size="sm" disabled={isSaving} onClick={onSave}>
        {isSaving ? "Saving..." : "Save"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isSaving}
        onClick={() => setIsEditing(false)}
      >
        Cancel
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
