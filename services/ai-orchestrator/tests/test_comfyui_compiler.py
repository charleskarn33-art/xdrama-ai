from app.workflows.comfyui_compiler import compile_to_comfyui
from app.workflows.graph import WorkflowGraph

LINEAR_GRAPH = {
    "nodes": [
        {"id": "script", "type": "input", "config": {"key": "script"}},
        {
            "id": "generate",
            "type": "model_task",
            "config": {"taskType": "movie", "params": {"seed": 42}},
        },
        {"id": "video", "type": "output", "config": {"key": "video"}},
    ],
    "edges": [
        {"id": "e1", "source": "script", "target": "generate"},
        {"id": "e2", "source": "generate", "target": "video"},
    ],
}


def test_compiles_every_node() -> None:
    graph = WorkflowGraph.model_validate(LINEAR_GRAPH)

    compiled = compile_to_comfyui(graph)

    assert set(compiled.keys()) == {"script", "generate", "video"}


def test_input_and_output_nodes_get_placeholder_class_types() -> None:
    graph = WorkflowGraph.model_validate(LINEAR_GRAPH)

    compiled = compile_to_comfyui(graph)

    assert compiled["script"]["class_type"] == "XDrama.Input"
    assert compiled["script"]["inputs"]["key"] == "script"
    assert compiled["video"]["class_type"] == "XDrama.Output"
    assert compiled["video"]["inputs"]["key"] == "video"


def test_model_task_node_carries_its_task_type_and_params() -> None:
    graph = WorkflowGraph.model_validate(LINEAR_GRAPH)

    compiled = compile_to_comfyui(graph)

    assert compiled["generate"]["class_type"] == "XDrama.ModelTask.movie"
    assert compiled["generate"]["inputs"]["params"] == {"seed": 42}


def test_edges_become_comfyui_style_node_id_output_index_links() -> None:
    graph = WorkflowGraph.model_validate(LINEAR_GRAPH)

    compiled = compile_to_comfyui(graph)

    # "generate" has one upstream source: "script", output slot 0.
    assert compiled["generate"]["inputs"]["input_0"] == ["script", 0]
    # "video" has one upstream source: "generate".
    assert compiled["video"]["inputs"]["input_0"] == ["generate", 0]
    # "script" has no upstream sources.
    assert not any(key.startswith("input_") for key in compiled["script"]["inputs"])


def test_a_node_with_multiple_upstream_sources_gets_multiple_links() -> None:
    graph = WorkflowGraph.model_validate(
        {
            "nodes": [
                {"id": "a", "type": "input", "config": {}},
                {"id": "b", "type": "input", "config": {}},
                {"id": "c", "type": "output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "source": "a", "target": "c"},
                {"id": "e2", "source": "b", "target": "c"},
            ],
        }
    )

    compiled = compile_to_comfyui(graph)

    links = sorted(
        tuple(v) for k, v in compiled["c"]["inputs"].items() if k.startswith("input_")
    )
    assert links == [("a", 0), ("b", 0)]
