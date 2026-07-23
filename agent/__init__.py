"""ELYSIA Desktop Control Agent.

A local FastAPI service exposing JARVIS-style desktop automation tools that
ELYSIA's Node bridge (server.ts) calls over HTTP. This module package only
hosts tool code; run with:

    uvicorn agent.server:app --host 127.0.0.1 --port 8765
"""

__version__ = "1.0.0"
