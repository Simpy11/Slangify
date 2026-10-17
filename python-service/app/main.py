import logging
import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.routes.processing import router as processing_router

logger = logging.getLogger("slangify-python")

app = FastAPI(
    title="Slangify Python Service",
    description="Internal contextual slang translation service powered by Gemini.",
    version="1.0.0",
)


@app.middleware("http")
async def request_diagnostics(request: Request, call_next):
    started = time.monotonic()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        logger.warning("AI layer=fastapi duration_ms=%s http_status=%s",
                       round((time.monotonic() - started) * 1000), status)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, _error: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"success": False, "message": "Invalid request data."},
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(_request: Request, error: Exception) -> JSONResponse:
    logger.error("Unhandled processing error (%s)", type(error).__name__)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal processing service error."},
    )


@app.exception_handler(HTTPException)
async def http_error_handler(_request: Request, error: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"success": False, "message": str(error.detail)},
    )


@app.get("/")
async def service_info() -> dict[str, str]:
    return {
        "service": "slangify-python",
        "message": "FastAPI processing infrastructure is running.",
    }


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "slangify-python", "provider": {"name": "gemini", "model": GEMINI_MODEL, "configured": bool(GEMINI_API_KEY)}}


app.include_router(processing_router)
