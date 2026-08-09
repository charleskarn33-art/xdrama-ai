from typing import Any, cast

import redis.asyncio as redis

from app.core.config import get_settings

_QUEUE_KEY = "xdrama:render_jobs:queue"


def _client() -> redis.Redis:
    settings = get_settings()
    # redis-py's own type stubs share signatures between the sync and
    # async clients, so `from_url` and the calls below type-check as
    # `Awaitable[X] | X` even on the async client — a known upstream
    # imprecision, not an actual runtime ambiguity here.
    return cast(
        redis.Redis,
        redis.from_url(settings.redis_url, decode_responses=True),  # type: ignore[no-untyped-call]
    )


async def enqueue_render_job(job_id: str) -> None:
    client = _client()
    try:
        await cast(Any, client.lpush(_QUEUE_KEY, job_id))
    finally:
        await client.aclose()


async def dequeue_render_job(timeout: int = 1) -> str | None:
    """Blocks up to `timeout` seconds waiting for a job, then returns None
    if the queue stayed empty.

    Nothing runs this continuously yet — see app/api/render_jobs.py's
    dispatch endpoint, which enqueues and immediately dequeues inline
    (proving the round-trip actually works) rather than assuming a
    persistent worker process. A real deployment would run this in a
    long-lived worker loop (a separate process, or a Trigger.dev job)
    once there's actual GPU work for it to hand off — building that
    worker now, with nothing for it to do, would be infrastructure
    without a job.
    """
    client = _client()
    try:
        result = await cast(Any, client.brpop([_QUEUE_KEY], timeout=timeout))
        if result is None:
            return None
        _, job_id = result
        return cast(str, job_id)
    finally:
        await client.aclose()
