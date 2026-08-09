"use client";

import * as React from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { WorkflowGraph, WorkflowNodeType } from "@/lib/validations/workflows";
import { Button } from "@/components/ui/button";
import { XDramaNode, type XDramaNodeData, type XDramaNode as XDramaNodeT } from "./xdrama-node";
import { NodeInspector } from "./node-inspector";
import { NodePalette, NODE_TYPE_DRAG_KEY } from "./node-palette";

const nodeTypes = { xdramaNode: XDramaNode };

function graphToFlow(graph: WorkflowGraph): { nodes: XDramaNodeT[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: "xdramaNode" as const,
      position: n.position,
      data: { nodeType: n.type, label: n.label ?? n.type, config: n.config },
    })),
    edges: graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

function flowToGraph(nodes: XDramaNodeT[], edges: Edge[]): WorkflowGraph {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      label: n.data.label,
      position: n.position,
      config: n.data.config,
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

let nextNodeSeq = 1;
function newNodeId() {
  nextNodeSeq += 1;
  return `node-${Date.now()}-${nextNodeSeq}`;
}

function newNodeData(nodeType: WorkflowNodeType): XDramaNodeData {
  return {
    nodeType,
    label: nodeType === "model_task" ? "New task" : nodeType,
    config: nodeType === "model_task" ? { taskType: "", params: {} } : { key: "" },
  };
}

// This is the AI Workflow Engine's editor (built in Module 8) plus
// Module 15's additions: a draggable node palette instead of toolbar
// buttons being the only way to add a node, and an onSave callback
// instead of a hardcoded save action — so the same canvas now backs
// both project workflows (dashboard/.../workflows/[id]) and platform
// workflow templates (admin/templates/[id]).
function WorkflowEditorInner({
  initialGraph,
  onSave,
  saveLabel,
}: {
  initialGraph: WorkflowGraph;
  onSave: (graph: WorkflowGraph) => Promise<{ error: string | null }>;
  saveLabel: string;
}) {
  const initial = React.useMemo(() => graphToFlow(initialGraph), [initialGraph]);
  const [nodes, setNodes, onNodesChange] = useNodesState<XDramaNodeT>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const { screenToFlowPosition } = useReactFlow();

  const onConnect = React.useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, id: `edge-${Date.now()}` }, eds)),
    [setEdges],
  );

  function addNode(nodeType: WorkflowNodeType, position?: { x: number; y: number }) {
    const id = newNodeId();
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "xdramaNode",
        position: position ?? { x: 100 + nds.length * 40, y: 100 + nds.length * 40 },
        data: newNodeData(nodeType),
      },
    ]);
  }

  function onDragOver(event: React.DragEvent) {
    if (event.dataTransfer.types.includes(NODE_TYPE_DRAG_KEY)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  }

  function onDrop(event: React.DragEvent) {
    const nodeType = event.dataTransfer.getData(NODE_TYPE_DRAG_KEY) as WorkflowNodeType | "";
    if (!nodeType) {
      return;
    }
    event.preventDefault();
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNode(nodeType, position);
  }

  function updateNodeData(nodeId: string, patch: Partial<XDramaNodeData>) {
    setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)));
  }

  function deleteNode(nodeId: string) {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    const graph = flowToGraph(nodes, edges);
    const result = await onSave(graph);
    if (result.error) {
      setSaveError(result.error);
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="flex h-[600px] rounded-md border">
      <NodePalette />
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 border-b p-2">
          <Button type="button" variant="outline" size="sm" onClick={() => addNode("input")}>
            + Input
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addNode("model_task")}
          >
            + Model task
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addNode("output")}>
            + Output
          </Button>
          <div className="flex-1" />
          {saveError && <p className="text-destructive text-xs">{saveError}</p>}
          {saved && <p className="text-xs text-emerald-600 dark:text-emerald-400">Saved.</p>}
          <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : saveLabel}
          </Button>
        </div>
        <div className="flex-1" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      </div>
      {selectedNode && (
        <NodeInspector
          key={selectedNode.id}
          node={selectedNode}
          onChange={updateNodeData}
          onDelete={deleteNode}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}

export function WorkflowEditor(props: {
  initialGraph: WorkflowGraph;
  onSave: (graph: WorkflowGraph) => Promise<{ error: string | null }>;
  saveLabel?: string;
}) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner {...props} saveLabel={props.saveLabel ?? "Save"} />
    </ReactFlowProvider>
  );
}
