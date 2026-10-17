from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.processing import AiTranslation, DetectedSlang
from app.services.gemini import AiServiceError

client = TestClient(app)


@pytest.fixture
def ai_result(monkeypatch: pytest.MonkeyPatch) -> AsyncMock:
    result = AiTranslation(
        translation="He saw the message but did not reply.",
        explanation="This describes being left without a response.",
        detectedSlang=[DetectedSlang(term="left on read", meaning="A message was seen without a reply")],
    )
    mock = AsyncMock(return_value=result)
    monkeypatch.setattr("app.routes.processing.translate_slang", mock)
    return mock


def test_health_without_provider_key() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["provider"]["name"] == "gemini"
    assert isinstance(response.json()["provider"]["configured"], bool)
    assert "key" not in response.json()["provider"]


def test_process_returns_structured_ai_result(ai_result: AsyncMock) -> None:
    response = client.post("/api/process", json={"text": "Bro left me on read"})
    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "source": "ai",
        "original": "Bro left me on read",
        "translation": "He saw the message but did not reply.",
        "explanation": "This describes being left without a response.",
        "detectedSlang": [{"term": "left on read", "meaning": "A message was seen without a reply"}],
    }
    ai_result.assert_awaited_once_with("Bro left me on read")


def test_process_trims_input(ai_result: AsyncMock) -> None:
    response = client.post("/api/process", json={"text": "  Explain delulu  "})
    assert response.status_code == 200
    assert response.json()["original"] == "Explain delulu"
    ai_result.assert_awaited_once_with("Explain delulu")


@pytest.mark.parametrize("payload", [{}, {"text": ""}, {"text": "   "}, {"text": "x" * 2001}])
def test_process_rejects_invalid_input(payload: dict) -> None:
    response = client.post("/api/process", json=payload)
    assert response.status_code == 422
    assert response.json() == {"success": False, "message": "Invalid request data."}


def test_missing_provider_key_returns_controlled_error(monkeypatch: pytest.MonkeyPatch) -> None:
    mock = AsyncMock(side_effect=AiServiceError("AI processing is not configured.", 503))
    monkeypatch.setattr("app.routes.processing.translate_slang", mock)
    response = client.post("/api/process", json={"text": "unknown slang"})
    assert response.status_code == 503
    assert response.json() == {"success": False, "code": "AI_PROVIDER_UNAVAILABLE", "message": "AI processing is not configured."}
