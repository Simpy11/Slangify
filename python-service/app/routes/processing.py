import logging
import math

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.processing import ProcessRequest, ProcessResponse
from app.services.gemini import AiServiceError, translate_slang

router = APIRouter(prefix="/api", tags=["processing"])


@router.post("/process", response_model=ProcessResponse)
async def process_text(payload: ProcessRequest) -> ProcessResponse:
    try:
        result = await translate_slang(payload.text)
    except AiServiceError as error:
        # Log only our own codes/status; never credentials, prompts, or provider bodies.
        logging.getLogger("slangify-python").warning("AI request failed code=%s status=%s", error.code, error.status_code)
        headers = {"Retry-After": str(max(1, math.ceil(error.retry_after)))} if error.retry_after is not None else {}
        return JSONResponse(status_code=error.status_code, headers=headers, content={"success": False, "code": error.code, "message": str(error)})

    return ProcessResponse(
        success=True,
        source="ai",
        original=payload.text,
        **result.model_dump(),
    )
