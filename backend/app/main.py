import logging

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import CORS_ORIGINS, VERSION

logger = logging.getLogger("gesturemusic.api")

api = FastAPI(title="GestureMusic Audio Analysis API", version=VERSION,
              description="Monophonic pitch transcription for synchronized Kodály sign playback.")
api.include_router(router)


@api.exception_handler(HTTPException)
async def api_http_error(_: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": "REQUEST_ERROR", "message": str(exc.detail)}})


@api.exception_handler(Exception)
async def unexpected_error(_: Request, exc: Exception):
    logger.exception("unhandled_api_error", exc_info=exc)
    return JSONResponse(status_code=500, content={"error": {"code": "INTERNAL_ERROR", "message": "Analysis failed unexpectedly. Please retry."}})


# Keep CORS outside FastAPI's ServerErrorMiddleware as well. That ensures the
# browser receives CORS headers even when an unexpected exception becomes a 500.
app = CORSMiddleware(api, allow_origins=CORS_ORIGINS, allow_methods=["GET", "POST"],
                     allow_headers=["*"])
