import uuid

import pytest

from app.core.queue import dequeue_render_job, enqueue_render_job


@pytest.mark.asyncio
async def test_enqueue_then_dequeue_round_trips(redis_available: None) -> None:
    job_id = str(uuid.uuid4())

    await enqueue_render_job(job_id)
    dequeued = await dequeue_render_job(timeout=2)

    assert dequeued == job_id


@pytest.mark.asyncio
async def test_dequeue_times_out_on_an_empty_queue(redis_available: None) -> None:
    result = await dequeue_render_job(timeout=1)

    assert result is None


@pytest.mark.asyncio
async def test_queue_is_fifo(redis_available: None) -> None:
    first, second = str(uuid.uuid4()), str(uuid.uuid4())

    await enqueue_render_job(first)
    await enqueue_render_job(second)

    assert await dequeue_render_job(timeout=2) == first
    assert await dequeue_render_job(timeout=2) == second
