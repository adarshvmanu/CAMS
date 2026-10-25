#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== CAMS One-Click Launcher ==="

# Check for Python 3.10 - 3.12
PYTHON_BIN=""
for candidate in python3.12 python3.11 python3.10 /opt/homebrew/bin/python3.12 /opt/homebrew/bin/python3.11 /opt/homebrew/bin/python3.10 python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
        VER=$("$candidate" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "")
        if [[ "$VER" =~ ^3\.(10|11|12)$ ]]; then
            PYTHON_BIN="$candidate"
            break
        fi
    fi
done

if [ -z "$PYTHON_BIN" ]; then
    echo "Error: Python 3.10, 3.11, or 3.12 is required for MediaPipe compatibility."
    echo "Found Python version: $(python3 --version 2>&1 || echo 'none')"
    echo "Please install Python 3.11 or 3.12 (e.g. brew install python@3.12 on macOS)."
    exit 1
fi

echo "Using Python: $PYTHON_BIN ($($PYTHON_BIN --version))"

# Create virtual environment if missing
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment in .venv..."
    "$PYTHON_BIN" -m venv .venv
fi

VENV_PYTHON="$SCRIPT_DIR/.venv/bin/python3"
VENV_PIP="$SCRIPT_DIR/.venv/bin/pip"

# Install requirements
if [ -f "requirements.txt" ]; then
    echo "Checking dependencies..."
    "$VENV_PIP" install -q -r requirements.txt
fi

# Cleanup on exit
SERVER_PID=""
cleanup() {
    echo ""
    echo "[CAMS] Shutting down..."
    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start server.py in background
echo "Starting CAMS web server on port 3000..."
"$VENV_PYTHON" server.py &
SERVER_PID=$!
sleep 1.5

# Open dashboard in browser
DASHBOARD_URL="http://localhost:3000"
echo "Opening dashboard: $DASHBOARD_URL"
if command -v open >/dev/null 2>&1; then
    open "$DASHBOARD_URL"
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$DASHBOARD_URL"
fi

# Start computer vision pipeline
echo "Launching CAMS CV pipeline..."
"$VENV_PYTHON" Integration.py "$@"
