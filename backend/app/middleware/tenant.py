"""
Tenant Middleware - Request context & security headers
"""
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Add request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        request.state.start_time = time.time()

        response = await call_next(request)

        # Security headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        process_time = time.time() - request.state.start_time
        response.headers["X-Process-Time"] = f"{process_time:.3f}"

        return response
