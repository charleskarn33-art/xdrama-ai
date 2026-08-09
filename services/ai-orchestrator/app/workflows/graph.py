from typing import Any, Literal

from pydantic import BaseModel, Field

NodeType = Literal["input", "model_task", "output"]


class GraphCycleError(ValueError):
    pass


class WorkflowNodePosition(BaseModel):
    x: float = 0
    y: float = 0


class WorkflowNode(BaseModel):
    id: str
    type: NodeType
    label: str | None = None
    position: WorkflowNodePosition = Field(default_factory=WorkflowNodePosition)
    config: dict[str, Any] = Field(default_factory=dict)


class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str


class WorkflowGraph(BaseModel):
    """Mirrors the jsonb shape stored in workflow_templates.graph /
    workflows.graph, validated a second time (already validated by the
    validate_workflow_graph() Postgres trigger at write time) — this
    service never trusts that a jsonb blob it reads matches its own
    expectations without checking."""

    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]


def topological_order(graph: WorkflowGraph) -> list[str]:
    """Kahn's algorithm. Raises GraphCycleError if the graph isn't a DAG
    — defense in depth; the database already rejects cyclic graphs at
    write time (see validate_workflow_graph() in the Module 8 migration),
    so this should never actually fire in practice, but the compiler
    needs a real execution order regardless, and can't safely assume the
    data it's compiling was validated by the exact code path it thinks."""
    in_degree = {node.id: 0 for node in graph.nodes}
    adjacency: dict[str, list[str]] = {node.id: [] for node in graph.nodes}

    for edge in graph.edges:
        adjacency[edge.source].append(edge.target)
        in_degree[edge.target] += 1

    queue = sorted(node_id for node_id, degree in in_degree.items() if degree == 0)
    order: list[str] = []

    while queue:
        current = queue.pop(0)
        order.append(current)
        for neighbor in sorted(adjacency[current]):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)
        queue.sort()

    if len(order) != len(graph.nodes):
        raise GraphCycleError("Workflow graph contains a cycle")

    return order
