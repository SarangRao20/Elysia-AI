"""
ELYSIA Desktop Control Agent — FastAPI entrypoint.

Single dispatch endpoint POST /execute { tool, args } -> { result } | { error }.
ELYSIA's Node bridge (server.ts) calls this over HTTP on 127.0.0.1:8765.

    Run:
        uvicorn agent.server:app --host 127.0.0.1 --port 8765
    or:
        python -m agent.server
    """

    import uvicorn

    host = os.environ.get("ELYSIA_AGENT_HOST", "127.0.0.1")
    port = int(os.environ.get("ELYSIA_AGENT_PORT", "8765"))
    log.info("Launching uvicorn on %s:%d", host, port)
    uvicorn.run(
        "agent.server:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
