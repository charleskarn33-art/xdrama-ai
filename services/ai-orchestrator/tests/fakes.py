"""A minimal fake implementing only the query-builder chain this codebase
actually calls (table/select/update/eq/maybe_single/execute), so tests
don't depend on mocking supabase-py's internals."""

from __future__ import annotations

from typing import Any


class FakeResponse:
    def __init__(self, data: Any) -> None:
        self.data = data


class FakeQuery:
    def __init__(self, table: FakeTable) -> None:
        self._table = table
        self._action: str | None = None
        self._payload: dict[str, Any] | None = None
        self._filters: dict[str, Any] = {}

    def select(self, *_args: Any, **_kwargs: Any) -> FakeQuery:
        self._action = "select"
        return self

    def update(self, payload: dict[str, Any]) -> FakeQuery:
        self._action = "update"
        self._payload = payload
        return self

    def eq(self, column: str, value: Any) -> FakeQuery:
        self._filters[column] = value
        return self

    def maybe_single(self) -> FakeQuery:
        return self

    async def execute(self) -> FakeResponse:
        row_id = self._filters.get("id")
        row = self._table.rows.get(row_id)

        if self._action == "update" and row is not None and self._payload is not None:
            row.update(self._payload)
            self._table.update_calls.append((row_id, dict(self._payload)))

        return FakeResponse(row)


class FakeTable:
    def __init__(self, rows: dict[str, dict[str, Any]] | None = None) -> None:
        self.rows = rows or {}
        self.update_calls: list[tuple[str, dict[str, Any]]] = []

    def select(self, *args: Any, **kwargs: Any) -> FakeQuery:
        return FakeQuery(self).select(*args, **kwargs)

    def update(self, payload: dict[str, Any]) -> FakeQuery:
        return FakeQuery(self).update(payload)


class FakeRpc:
    def __init__(self, data: Any) -> None:
        self._data = data

    async def execute(self) -> FakeResponse:
        return FakeResponse(self._data)


class FakeSupabaseClient:
    def __init__(self) -> None:
        self._tables: dict[str, FakeTable] = {}
        # Preset per-function-name responses for .rpc() calls. Defaults
        # to the all-null composite shape select_model_for_task() returns
        # for real when nothing is eligible (see the Module 7 migration) —
        # tests that need an eligible model override this per test.
        self.rpc_responses: dict[str, Any] = {}

    def table(self, name: str) -> FakeTable:
        return self._tables.setdefault(name, FakeTable())

    def rpc(self, fn_name: str, _params: dict[str, Any]) -> FakeRpc:
        return FakeRpc(self.rpc_responses.get(fn_name, {"id": None}))
