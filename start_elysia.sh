#!/bin/bash
# ELYSIA — Start Script (Linux)
# Ensure we're in the project root
cd "$(dirname "$0")" || exit 1

# Kill any ghost background processes holding ports
pkill -f "run_agent.py" 2>/dev/null || true
pkill -f "uvicorn desktop_agent.main:app" 2>/dev/null || true

echo "Starting ELYSIA..."
echo "=========================================================="

# 1. Start Python Agent Background Process
echo ">>> Starting Python Core Agent on Port 8765..."
./venv/bin/python run_agent.py &
PYTHON_PID=$!

sleep 2

# 2. Start Node server (and Vite Dev frontend)
echo ">>> Starting Node WebSocket Server & Vite Frontend..."
npm run dev &
NODE_PID=$!

echo ""
echo "=========================================================="
echo "ELYSIA is running!"
echo "Open your browser at: http://localhost:3000"
echo "Press Ctrl+C to stop everything."
echo "=========================================================="

trap "echo 'Stopping ELYSIA...'; kill $PYTHON_PID $NODE_PID 2>/dev/null; exit" SIGINT SIGTERM

wait
