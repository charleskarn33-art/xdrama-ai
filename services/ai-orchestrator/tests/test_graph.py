import pytest

from app.workflows.graph import GraphCycleError, WorkflowGraph, topological_order

LINEAR_GRAPH = {
    "nodes": [
        {"id": "a", "type": "input", "config": {"key": "script"}},
        {"id": "b", "type": "model_task", "config": {"taskType": "movie"}},
        {"id": "c", "type": "output", "config": {"key": "video"}},
    ],
    "edges": [
        {"id": "e1", "source": "a", "target": "b"},
        {"id": "e2", "source": "b", "target": "c"},
    ],
}

DIAMOND_GRAPH = {
    "nodes": [
        {"id": "a", "type": "input", "config": {}},
        {"id": "b", "type": "model_task", "config": {"taskType": "x"}},
        {"id": "c", "type": "model_task", "config": {"taskType": "y"}},
        {"id": "d", "type": "output", "config": {}},
    ],
    "edges": [
        {"id": "e1", "source": "a", "target": "b"},
        {"id": "e2", "source": "a", "target": "c"},
        {"id": "e3", "source": "b", "target": "d"},
        {"id": "e4", "source": "c", "target": "d"},
    ],
}

CYCLIC_GRAPH = {
    "nodes": [
        {"id": "a", "type": "input", "config": {}},
        {"id": "b", "type": "output", "config": {}},
    ],
    "edges": [
        {"id": "e1", "source": "a", "target": "b"},
        {"id": "e2", "source": "b", "target": "a"},
    ],
}


def test_topological_order_respects_edges() -> None:
    graph = WorkflowGraph.model_validate(LINEAR_GRAPH)

    order = topological_order(graph)

    assert order.index("a") < order.index("b") < order.index("c")


def test_topological_order_handles_a_diamond() -> None:
    graph = WorkflowGraph.model_validate(DIAMOND_GRAPH)

    order = topological_order(graph)

    assert order.index("a") < order.index("b")
    assert order.index("a") < order.index("c")
    assert order.index("b") < order.index("d")
    assert order.index("c") < order.index("d")


def test_topological_order_is_deterministic() -> None:
    graph = WorkflowGraph.model_validate(DIAMOND_GRAPH)

    assert topological_order(graph) == topological_order(graph)


def test_topological_order_raises_on_a_cycle() -> None:
    graph = WorkflowGraph.model_validate(CYCLIC_GRAPH)

    with pytest.raises(GraphCycleError):
        topological_order(graph)
