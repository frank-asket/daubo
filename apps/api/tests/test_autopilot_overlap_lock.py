import pytest

from app.services import me_autopilot_helpers as helpers


class _FakeRedis:
    def __init__(self, store: dict[str, str]):
        self.store = store

    async def set(self, key: str, value: str, ex: int, nx: bool):
        if nx and key in self.store:
            return False
        self.store[key] = value
        return True

    async def get(self, key: str):
        return self.store.get(key)

    async def delete(self, key: str):
        self.store.pop(key, None)

    async def aclose(self):
        return None


@pytest.mark.asyncio
async def test_overlap_lock_acquire_and_release(monkeypatch: pytest.MonkeyPatch):
    store: dict[str, str] = {}
    monkeypatch.setattr(helpers, "redis_from_url", lambda *args, **kwargs: _FakeRedis(store))
    token = await helpers.acquire_autopilot_overlap_lock("redis://test", "u_1")
    assert token is not None
    token2 = await helpers.acquire_autopilot_overlap_lock("redis://test", "u_1")
    assert token2 is None
    await helpers.release_autopilot_overlap_lock("redis://test", "u_1", token)
    token3 = await helpers.acquire_autopilot_overlap_lock("redis://test", "u_1")
    assert token3 is not None
