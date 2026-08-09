"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { XDramaNode } from "./xdrama-node";

export function NodeInspector({
  node,
  onChange,
  onDelete,
  onClose,
}: {
  node: XDramaNode;
  onChange: (nodeId: string, patch: Partial<XDramaNode["data"]>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}) {
  const [paramsText, setParamsText] = React.useState(() =>
    JSON.stringify(node.data.config.params ?? {}, null, 2),
  );
  const [paramsError, setParamsError] = React.useState<string | null>(null);

  function applyParams(text: string) {
    setParamsText(text);
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      setParamsError(null);
      onChange(node.id, { config: { ...node.data.config, params: parsed } });
    } catch {
      setParamsError("Invalid JSON");
    }
  }

  return (
    <div className="bg-card flex w-72 shrink-0 flex-col gap-4 border-l p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Node</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="node-label">Label</Label>
        <Input
          id="node-label"
          value={node.data.label}
          onChange={(e) => onChange(node.id, { label: e.target.value })}
        />
      </div>

      {(node.data.nodeType === "input" || node.data.nodeType === "output") && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="node-key">Key</Label>
          <Input
            id="node-key"
            value={
              typeof node.data.config.key === "string"
                ? node.data.config.key
                : ""
            }
            onChange={(e) =>
              onChange(node.id, {
                config: { ...node.data.config, key: e.target.value },
              })
            }
          />
        </div>
      )}

      {node.data.nodeType === "model_task" && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="node-task-type">Task type</Label>
            <Input
              id="node-task-type"
              placeholder="movie, fast_draft, character_consistency..."
              value={
                typeof node.data.config.taskType === "string"
                  ? node.data.config.taskType
                  : ""
              }
              onChange={(e) =>
                onChange(node.id, {
                  config: { ...node.data.config, taskType: e.target.value },
                })
              }
            />
            <p className="text-muted-foreground text-xs">
              Matches a routing_rules.task_type (see the AI Router).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="node-params">Params (JSON)</Label>
            <Textarea
              id="node-params"
              rows={6}
              className="font-mono text-xs"
              value={paramsText}
              onChange={(e) => applyParams(e.target.value)}
            />
            {paramsError && (
              <p className="text-destructive text-xs">{paramsError}</p>
            )}
          </div>
        </>
      )}

      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive mt-auto"
        onClick={() => onDelete(node.id)}
      >
        Delete node
      </Button>
    </div>
  );
}
