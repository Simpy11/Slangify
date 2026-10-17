import os
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

# Load the service file before either main.py or gemini.py imports these settings.
ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_FILE, encoding="utf-8-sig")
_file_values = dotenv_values(ENV_FILE, encoding="utf-8-sig")


def _setting(name: str, default: str = "") -> str:
    # A populated deployment variable wins; an empty inherited variable must not
    # shadow a valid value in the service's .env file.
    return os.getenv(name, "").strip() or (_file_values.get(name) or "").strip() or default


GEMINI_API_KEY = _setting("GEMINI_API_KEY")
GEMINI_MODEL = _setting("GEMINI_MODEL", "gemini-flash-latest").removeprefix("models/")
def _timeout_seconds() -> float:
    import math
    try:
        value = float(_setting("GEMINI_TIMEOUT_SECONDS", "45"))
    except ValueError:
        raise ValueError("GEMINI_TIMEOUT_SECONDS must be a positive number") from None
    if not math.isfinite(value) or value <= 0:
        raise ValueError("GEMINI_TIMEOUT_SECONDS must be a positive number")
    return value


GEMINI_TIMEOUT_SECONDS = _timeout_seconds()
