"""A minimal fake implementing only the query-builder chain this codebase
actually calls (table/select/update/eq/in_/maybe_single/execute/rpc), so
tests don't depend on mocking supabase-py's internals."""

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
        self._eq_filters: dict[str, Any] = {}
        self._in_filters: dict[str, list[Any]] = {}
        self._single = False

    def select(self, *_args: Any, **_kwargs: Any) -> FakeQuery:
        self._action = "select"
        return self

    def update(self, payload: dict[str, Any]) -> FakeQuery:
        self._action = "update"
        self._payload = payload
        return self

    def eq(self, column: str, value: Any) -> FakeQuery:
        self._eq_filters[column] = value
        return self

    def in_(self, column: str, values: list[Any]) -> FakeQuery:
        self._in_filters[column] = list(values)
        return self

    def maybe_single(self) -> FakeQuery:
        self._single = True
        return self

    def _matches(self, row: dict[str, Any]) -> bool:
        for column, value in self._eq_filters.items():
            if column == "id":
                continue  # handled by dict-key lookup in execute(), below
            if row.get(column) != value:
                return False
        for column, values in self._in_filters.items():
            if column == "id":
                continue
            if row.get(column) not in values:
                return False
        return True

    async def execute(self) -> FakeResponse:
        # Rows are stored keyed by id (fixtures don't always duplicate
        # "id" inside the row dict itself, e.g. a workflows fixture keyed
        # by workflow id with only {"graph": ...}), so an "id" filter
        # looks up by dict key rather than by a row field.
        if "id" in self._eq_filters:
            row = self._table.rows.get(self._eq_filters["id"])
            candidates = [row] if row is not None else []
        elif "id" in self._in_filters:
            candidates = [
                self._table.rows[i] for i in self._in_filters["id"] if i in self._table.rows
            ]
        else:
            candidates = list(self._table.rows.values())

        matching = [row for row in candidates if self._matches(row)]

        if self._action == "update" and self._payload is not None:
            for row in matching:
                row.update(self._payload)
                self._table.update_calls.append((row.get("id"), dict(self._payload)))

        if self._single:
            return FakeResponse(matching[0] if matching else None)
        return FakeResponse(matching)


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
