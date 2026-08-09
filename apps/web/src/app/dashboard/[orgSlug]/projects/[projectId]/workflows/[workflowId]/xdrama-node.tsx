import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { cn } from "@/lib/utils";
import type { WorkflowNodeType } from "@/lib/validations/workflows";

export type XDramaNodeData = {
  nodeType: WorkflowNodeType;
  label: string;
  config: Record<string, unknown>;
};

export type XDramaNode = Node<XDramaNodeData, "xdramaNode">;

const TYPE_STYLE: Record<WorkflowNodeType, string> = {
  input: "border-blue-400 dark:border-blue-600",
  model_task: "border-primary",
  output: "border-emerald-400 dark:border-emerald-600",
};

const TYPE_LABEL: Record<WorkflowNodeType, string> = {
  input: "Input",
  model_task: "Model task",
  output: "Output",
};

export function XDramaNode({ data, selected }: NodeProps<XDramaNode>) {
  return (
    <div
      className={cn(
        "bg-card min-w-40 rounded-md border-2 px-3 py-2 shadow-sm",
        TYPE_STYLE[data.nodeType],
        selected && "ring-ring ring-2 ring-offset-2",
      )}
    >
      {data.nodeType !== "input" && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-muted-foreground"
        />
      )}
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {TYPE_LABEL[data.nodeType]}
      </div>
      <div className="text-sm font-medium">{data.label}</div>
      {data.nodeType === "model_task" &&
        typeof data.config.taskType === "string" && (
          <div className="text-muted-foreground mt-1 text-xs">
            task: {data.config.taskType}
          </div>
        )}
      {data.nodeType !== "output" && (
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-muted-foreground"
        />
      )}
    </div>
  );
}
