from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProcessRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=2000)

    @field_validator("text")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("text must not be empty")
        return normalized


class DetectedSlang(BaseModel):
    model_config = ConfigDict(extra="forbid")

    term: str = Field(min_length=1, max_length=100)
    meaning: str = Field(min_length=1, max_length=300)


class AiTranslation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    translation: str = Field(min_length=1, max_length=1000)
    explanation: str = Field(min_length=1, max_length=1500)
    detectedSlang: list[DetectedSlang] = Field(default_factory=list, max_length=8)

    @field_validator("translation", "explanation")
    @classmethod
    def require_meaningful_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("AI text must not be empty")
        return normalized


class ProcessResponse(AiTranslation):
    success: bool
    source: str
    original: str
