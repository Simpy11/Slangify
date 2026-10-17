from pathlib import Path

from dotenv import dotenv_values
import pytest

import app.config as config


def test_env_path_is_absolute_and_service_local():
    assert config.ENV_FILE.is_absolute()
    assert config.ENV_FILE == Path(config.__file__).resolve().parents[1] / ".env"


@pytest.mark.parametrize("inherited", ["", "   "])
def test_empty_environment_does_not_shadow_file(monkeypatch, inherited):
    monkeypatch.setenv("GEMINI_API_KEY", inherited)
    monkeypatch.setattr(config, "_file_values", {"GEMINI_API_KEY": "test-file-key"})
    assert config._setting("GEMINI_API_KEY") == "test-file-key"


def test_nonempty_environment_wins(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-deployment-key")
    monkeypatch.setattr(config, "_file_values", {"GEMINI_API_KEY": "test-file-key"})
    assert config._setting("GEMINI_API_KEY") == "test-deployment-key"


def test_empty_file_is_not_configured(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(config, "_file_values", {"GEMINI_API_KEY": "   "})
    assert not config._setting("GEMINI_API_KEY")


def test_bom_file_loads_from_another_working_directory(monkeypatch, tmp_path):
    env_file = tmp_path / "service.env"
    env_file.write_text("GEMINI_API_KEY=test-bom-key\n", encoding="utf-8-sig")
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    monkeypatch.chdir(elsewhere)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(config, "_file_values", dotenv_values(env_file, encoding="utf-8-sig"))
    assert config._setting("GEMINI_API_KEY") == "test-bom-key"


@pytest.mark.parametrize("value", ["0", "-1", "nan", "inf", "invalid"])
def test_invalid_timeout_fails_clearly_without_exposing_settings(monkeypatch, value):
    monkeypatch.setenv("GEMINI_TIMEOUT_SECONDS", value)
    with pytest.raises(ValueError, match="GEMINI_TIMEOUT_SECONDS must be a positive number"):
        config._timeout_seconds()


def test_timeout_is_configurable(monkeypatch):
    monkeypatch.setenv("GEMINI_TIMEOUT_SECONDS", "46")
    assert config._timeout_seconds() == 46
