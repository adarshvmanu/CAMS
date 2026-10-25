#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== CAMS Studio Launcher ==="

# Locate Python 3.10 - 3.12
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
    exit 1
fi

echo "Using Python: $PYTHON_BIN ($($PYTHON_BIN --version))"

if [ ! -d ".venv" ]; then
    echo "Creating virtual environment in .venv..."
    "$PYTHON_BIN" -m venv .venv
fi

VENV_PYTHON="$SCRIPT_DIR/.venv/bin/python3"
VENV_PIP="$SCRIPT_DIR/.venv/bin/pip"

if [ -f "requirements.txt" ]; then
    "$VENV_PIP" install -q -r requirements.txt
fi

DASHBOARD_URL="http://localhost:3000"
(sleep 1.5 && (open "$DASHBOARD_URL" 2>/dev/null || xdg-open "$DASHBOARD_URL" 2>/dev/null || true)) &

echo "Starting unified CAMS Studio live engine..."
exec "$VENV_PYTHON" server.py "$@"
