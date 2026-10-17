import json

import httpx
import pytest

import app.services.gemini as gemini
from app.services.gemini import AiServiceError


class FakeClient:
    def __init__(self, response=None, error=None, **_kwargs) -> None:
        self.response = response
        self.error = error
        self.request = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, url, **kwargs):
        self.request = (url, kwargs)
        if self.error:
            raise self.error
        return self.response


def generation_response(result: dict) -> httpx.Response:
    return httpx.Response(200, json={"candidates": [{
        "content": {"parts": [{"text": json.dumps(result)}]},
    }]})


@pytest.mark.asyncio
async def test_translates_with_one_structured_provider_request(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = FakeClient(response=generation_response({
        "translation": "He has no charm and was thoroughly defeated.",
        "explanation": "The sentence jokingly describes social failure.",
        "detectedSlang": [{"term": "rizz", "meaning": "charm"}],
    }))
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)

    result = await gemini.translate_slang("Bro has no rizz and got cooked")
    assert result.translation
    assert result.explanation
    assert result.detectedSlang[0].term == "rizz"
    assert fake.request[0] == gemini.GEMINI_URL
    options = fake.request[1]
    assert options["headers"]["x-goog-api-key"] == "test-key"
    assert options["json"]["generationConfig"]["responseMimeType"] == "application/json"
    assert "test-key" not in options["json"]["contents"][0]["parts"][0]["text"]


@pytest.mark.asyncio
async def test_missing_key_does_not_call_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "")
    with pytest.raises(AiServiceError, match="not configured") as error:
        await gemini.translate_slang("some slang")
    assert error.value.status_code == 503


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [401, 403, 429, 500])
async def test_provider_failures_are_safely_normalized(monkeypatch: pytest.MonkeyPatch, status: int) -> None:
    fake = FakeClient(response=httpx.Response(status, json={"error": {"message": "private provider details"}}))
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    with pytest.raises(AiServiceError) as error:
        await gemini.translate_slang("some slang")
    assert "private provider details" not in str(error.value)


@pytest.mark.asyncio
async def test_malformed_provider_output_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = FakeClient(response=generation_response({"translation": "missing required fields"}))
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    with pytest.raises(AiServiceError, match="unusable response"):
        await gemini.translate_slang("some slang")


@pytest.mark.asyncio
async def test_provider_timeout_is_controlled(monkeypatch: pytest.MonkeyPatch) -> None:
    request = httpx.Request("POST", gemini.GEMINI_URL)
    fake = FakeClient(error=httpx.ReadTimeout("timed out", request=request))
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    with pytest.raises(AiServiceError, match="timed out") as error:
        await gemini.translate_slang("some slang")
    assert error.value.status_code == 504


@pytest.mark.asyncio
@pytest.mark.parametrize("status,code,public_status", [(400, "AI_INVALID_REQUEST", 502), (401, "AI_AUTH_ERROR", 503), (403, "AI_AUTH_ERROR", 503), (404, "AI_MODEL_UNAVAILABLE", 503), (429, "AI_QUOTA_EXCEEDED", 429), (500, "AI_PROVIDER_UNAVAILABLE", 503)])
async def test_provider_error_codes(monkeypatch, status, code, public_status):
    fake = FakeClient(response=httpx.Response(status, json={"error": {"message": "private-key-private-details"}}))
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "private-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    with pytest.raises(AiServiceError) as error:
        await gemini.translate_slang("Bro has no rizz")
    assert error.value.code == code
    assert error.value.status_code == public_status
    assert "private" not in str(error.value)


@pytest.mark.asyncio
@pytest.mark.parametrize("text", ["Bro has no rizz", "Tere Bin Nahi Gujara Hai Sajani Ka Sahara Hai", "\u0907\u0938\u0915\u093e \u0915\u094d\u092f\u093e \u092e\u0924\u0932\u092c \u0939\u0948?"])
async def test_multilingual_content_uses_generate_content(monkeypatch, text):
    fake = FakeClient(response=generation_response({"translation": "Plain meaning", "explanation": "Context", "detectedSlang": []}))
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    await gemini.translate_slang(text)
    assert ":generateContent" in fake.request[0]
    assert fake.request[1]["json"]["contents"][0]["parts"][0]["text"] == text
    assert "Hindi" in fake.request[1]["json"]["systemInstruction"]["parts"][0]["text"]


@pytest.mark.asyncio
async def test_google_invalid_key_400_is_an_auth_failure(monkeypatch):
    fake = FakeClient(response=httpx.Response(400, json={"error": {"message": "private details", "details": [{"reason": "API_KEY_INVALID"}]}}))
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "private-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    with pytest.raises(AiServiceError) as error:
        await gemini.translate_slang("Bro has no rizz")
    assert error.value.code == "AI_AUTH_ERROR"
    assert "private" not in str(error.value)


@pytest.mark.asyncio
async def test_network_failure_is_safely_classified(monkeypatch):
    fake = FakeClient(error=httpx.ConnectError("private-network-details"))
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "private-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    with pytest.raises(AiServiceError) as error:
        await gemini.translate_slang("Bro has no rizz")
    assert error.value.code == "AI_NETWORK_ERROR"
    assert "private" not in str(error.value)


@pytest.fixture(autouse=True)
def no_real_backoff(monkeypatch):
    from unittest.mock import AsyncMock
    monkeypatch.setattr(gemini.asyncio, "sleep", AsyncMock())


@pytest.mark.asyncio
async def test_503_is_reported_without_duplicate_calls_or_leaking_key(monkeypatch, caplog):
    from unittest.mock import AsyncMock
    fake = FakeClient()
    fake.post = AsyncMock(return_value=httpx.Response(503, headers={"Retry-After": "2"},
        json={"error": {"status": "UNAVAILABLE", "message": "high demand test-key"}}))
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    with pytest.raises(AiServiceError) as error:
        await gemini.translate_slang("I am cooked")
    assert error.value.code == "AI_PROVIDER_UNAVAILABLE"
    assert error.value.retry_after == 2
    assert fake.post.await_count == 1
    assert "upstream_status=503" in caplog.text
    assert "duration_ms=" in caplog.text
    assert "test-key" not in caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [400, 401, 403, 404])
async def test_permanent_failures_never_retry(monkeypatch, status):
    from unittest.mock import AsyncMock
    fake = FakeClient()
    fake.post = AsyncMock(return_value=httpx.Response(status, json={"error": {"message": "rejected"}}))
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    with pytest.raises(AiServiceError):
        await gemini.translate_slang("some slang")
    assert fake.post.await_count == 1
    gemini.asyncio.sleep.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("status,headers,message,attempts", [
    (503, {}, "high demand", 1),
    (429, {}, "Too many requests", 1),
    (429, {}, "Quota exceeded limit: 0 perDay", 1),
    (503, {"Retry-After": "120"}, "high demand", 1),
])
async def test_retry_limits(monkeypatch, status, headers, message, attempts):
    from unittest.mock import AsyncMock
    fake = FakeClient()
    fake.post = AsyncMock(return_value=httpx.Response(status, headers=headers, json={"error": {"message": message}}))
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    with pytest.raises(AiServiceError):
        await gemini.translate_slang("some slang")
    assert fake.post.await_count == attempts


@pytest.mark.parametrize("payload", [[], {"candidates": None}, {"candidates": [None]},
    {"candidates": [{"finishReason": "MAX_TOKENS", "content": {"parts": [{"text": "{}"}]}}]}])
@pytest.mark.asyncio
async def test_bad_provider_shapes_are_controlled(monkeypatch, payload):
    from unittest.mock import AsyncMock
    fake = FakeClient()
    fake.post = AsyncMock(return_value=httpx.Response(200, json=payload))
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    with pytest.raises(AiServiceError) as error:
        await gemini.translate_slang("some slang")
    assert error.value.code == "AI_INVALID_RESPONSE"
    assert fake.post.await_count == 1


@pytest.mark.parametrize("headers,error,expected", [
    ({"Retry-After": "nan"}, {}, None),
    ({"Retry-After": "inf"}, {}, None),
    ({}, {"details": None}, None),
    ({}, {"details": [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "60s"}]}, 60),
])
def test_retry_after_parsing(headers, error, expected):
    assert gemini._retry_after(httpx.Response(503, headers=headers), error) == expected


@pytest.mark.asyncio
async def test_quota_is_not_replaced_by_a_retry_timeout(monkeypatch):
    from unittest.mock import AsyncMock
    fake = FakeClient()
    fake.post = AsyncMock(side_effect=[
        httpx.Response(429, headers={"Retry-After": "1"}, json={"error": {"message": "Quota exceeded"}}),
        httpx.ReadTimeout("would mask the quota error"),
    ])
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    with pytest.raises(AiServiceError) as error:
        await gemini.translate_slang("some slang")
    assert error.value.code == "AI_QUOTA_EXCEEDED"
    assert error.value.status_code == 429
    assert fake.post.await_count == 1


@pytest.mark.asyncio
async def test_total_deadline_bounds_a_slow_provider(monkeypatch):
    import asyncio
    # The autouse fixture mocks backoff sleep; use an independent pending future.
    async def slow_post(*args, **kwargs):
        await asyncio.Future()
    fake = FakeClient()
    fake.post = slow_post
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(gemini, "GEMINI_TIMEOUT_SECONDS", 0.02)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    with pytest.raises(AiServiceError) as error:
        await gemini.translate_slang("some slang")
    assert error.value.code == "AI_TIMEOUT"


@pytest.mark.asyncio
async def test_slow_success_within_deadline(monkeypatch):
    import asyncio
    from unittest.mock import AsyncMock
    fake = FakeClient()
    async def delayed_post(*args, **kwargs):
        loop = asyncio.get_running_loop()
        ready = loop.create_future()
        loop.call_later(0.01, ready.set_result, None)
        await ready
        return generation_response({"translation": "Meaning", "explanation": "Context", "detectedSlang": []})
    fake.post = AsyncMock(side_effect=delayed_post)
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: fake)
    assert (await gemini.translate_slang("some slang")).translation == "Meaning"
    assert fake.post.await_count == 1
