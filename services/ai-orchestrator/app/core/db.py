from typing import Any

from fastapi import HTTPException, status
from supabase import AsyncClient


async def get_row_or_404(
    supabase: AsyncClient, table: str, row_id: str, select: str = "*"
) -> dict[str, Any]:
    """Fetches a single row by id through the caller's own RLS grants, so
    an unknown or not-yours id 404s naturally rather than needing a
    separate ownership check."""
    response = await supabase.table(table).select(select).eq("id", row_id).maybe_single().execute()
    data = response.data if response else None
    if not isinstance(data, dict):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{table[:-1]} not found")
    return data
