from collections import defaultdict
from typing import Any

from app.workflows.graph import WorkflowGraph, topological_order

ComfyUIPrompt = dict[str, dict[str, Any]]


def compile_to_comfyui(graph: WorkflowGraph) -> ComfyUIPrompt:
    """Compiles our internal workflow graph into ComfyUI's own prompt-API
    JSON shape: a flat dict of {node_id: {"class_type": ..., "inputs":
    {...}}}, with upstream links expressed as ComfyUI's own [node_id,
    output_index] pairs. This is ComfyUI's real, stable, publicly
    documented submission format — not something invented for this
    project.

    What *is* a placeholder: the `class_type` string for `model_task`
    nodes (`XDrama.ModelTask.<task_type>`). Real ComfyUI class_type names
    are the class names of whatever custom-node Python packages are
    installed on a given render node (e.g. a community "ComfyUI-Wan2.2"
    package's node classes) — that's real infrastructure knowledge this
    project doesn't have without a render node to introspect, and
    guessing at specific third-party class names would mean building
    against an interface no one has verified exists. Mapping task types
    to real class_type names is real-infrastructure follow-up work, not
    something buildable today (see docs/08-module-8-ai-workflow-engine.md).
    """
    order = topological_order(graph)
    nodes_by_id = {node.id: node for node in graph.nodes}

    upstream: dict[str, list[str]] = defaultdict(list)
    for edge in graph.edges:
        upstream[edge.target].append(edge.source)

    compiled: ComfyUIPrompt = {}

    for node_id in order:
        node = nodes_by_id[node_id]
        inputs: dict[str, Any] = {
            f"input_{i}": [source_id, 0]
            for i, source_id in enumerate(sorted(upstream[node_id]))
        }

        if node.type == "input":
            class_type = "XDrama.Input"
            inputs["key"] = node.config.get("key")
        elif node.type == "output":
            class_type = "XDrama.Output"
            inputs["key"] = node.config.get("key")
        else:
            task_type = node.config.get("taskType", "unknown")
            class_type = f"XDrama.ModelTask.{task_type}"
            inputs["params"] = node.config.get("params", {})

        compiled[node_id] = {"class_type": class_type, "inputs": inputs}

    return compiled
