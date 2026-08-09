"use client";

import { WORKFLOW_NODE_TYPES, type WorkflowNodeType } from "@/lib/validations/workflows";
import { TYPE_LABEL } from "./xdrama-node";

// The drag data key both this palette and the canvas's onDrop handler
// agree on. Namespaced so it doesn't collide with drag events from
// anything else on the page.
export const NODE_TYPE_DRAG_KEY = "application/xdrama-node-type";

const TYPE_HINT: Record<WorkflowNodeType, string> = {
  input: "A value the workflow starts from",
  model_task: "An AI Router-dispatched generation step",
  output: "A value the workflow produces",
};

export function NodePalette() {
  return (
    <div className="bg-card flex w-48 shrink-0 flex-col gap-2 border-r p-3">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Drag onto canvas
      </h3>
      {WORKFLOW_NODE_TYPES.map((nodeType) => (
        <div
          key={nodeType}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(NODE_TYPE_DRAG_KEY, nodeType);
            event.dataTransfer.effectAllowed = "move";
          }}
          className="bg-secondary/60 hover:bg-secondary cursor-grab rounded-md border px-3 py-2 text-sm active:cursor-grabbing"
        >
          <div className="font-medium">{TYPE_LABEL[nodeType]}</div>
          <div className="text-muted-foreground text-xs">{TYPE_HINT[nodeType]}</div>
        </div>
      ))}
    </div>
  );
}
