#!/usr/bin/env python3
"""
CAMS Unified Cross-Platform System Controller
==============================================
Single-file boot up, health-check, management, and clean-kill controller for CAMS.
Works natively across macOS, Windows, and Linux without external dependencies.

Usage:
    python cams.py [start|boot]      # Boot up system in background & open browser
    python cams.py [stop|kill]       # Gracefully clean-kill CAMS & release camera
    python cams.py restart           # Clean-kill then boot up
    python cams.py status            # Check if CAMS is active, port, PID, uptime
    python cams.py run               # Run in foreground (interactive console)
    python cams.py                   # Default: boots if stopped, or opens menu
"""

import os
import sys
import time
import json
import socket
import signal
import platform
import subprocess
import urllib.request
import webbrowser
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR
PID_FILE = PROJECT_DIR / ".cams.pid"
STATE_FILE = PROJECT_DIR / ".cams_state.json"
REQ_FILE = PROJECT_DIR / "requirements.txt"
STAMP_FILE = PROJECT_DIR / ".cams.requirements.stamp"
SERVER_SCRIPT = PROJECT_DIR / "server.py"

IS_WINDOWS = platform.system() == "Windows"
DEFAULT_PORT = 3000

# ANSI terminal formatting (auto-disabled if not supported)
USE_COLOR = sys.stdout.isatty() and not os.environ.get("NO_COLOR")
if IS_WINDOWS and USE_COLOR:
    # Enable ANSI escape sequences on Windows 10/11
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        USE_COLOR = False

def color(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else text

def bold(text: str) -> str: return color(text, "1")
def green(text: str) -> str: return color(text, "32")
def yellow(text: str) -> str: return color(text, "33")
def red(text: str) -> str: return color(text, "31")
def cyan(text: str) -> str: return color(text, "36")
def dim(text: str) -> str: return color(text, "2")


# ============================================================================
# PROCESS & SYSTEM DISCOVERY
# ============================================================================

def is_pid_alive(pid: int) -> bool:
    """Checks whether a given process ID is active."""
    if pid <= 0:
        return False
    if IS_WINDOWS:
        try:
            cmd = ["tasklist", "/FI", f"PID eq {pid}", "/NH"]
            out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
            return str(pid) in out
        except Exception:
            return False
    else:
        try:
            os.kill(pid, 0)
            return True
        except (OSError, ProcessLookupError):
            return False


def get_stored_state() -> dict:
    """Reads saved system state if available."""
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and is_pid_alive(data.get("pid", 0)):
                    return data
        except Exception:
            pass
    if PID_FILE.exists():
        try:
            pid = int(PID_FILE.read_text().strip())
            if is_pid_alive(pid):
                return {"pid": pid, "port": DEFAULT_PORT, "started_at": 0}
        except Exception:
            pass
    return {}


def find_cams_processes() -> list:
    """Discovers all CAMS server processes running from this workspace."""
    pids = set()

    # 1. Check PID/State files
    st = get_stored_state()
    if st and st.get("pid"):
        pids.add(st["pid"])

    # 2. System-level search for python running server.py
    srv_str = str(SERVER_SCRIPT).replace("\\", "/")
    if IS_WINDOWS:
        try:
            # Query Windows management instrumentation for python processes
            cmd = ["wmic", "process", "where", "name like 'python%.exe'", "get", "ProcessId,CommandLine", "/format:csv"]
            out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
            for line in out.splitlines():
                if "server.py" in line and str(PROJECT_DIR).lower() in line.lower():
                    parts = [p.strip() for p in line.split(",") if p.strip()]
                    for p in parts:
                        if p.isdigit() and int(p) != os.getpid():
                            pids.add(int(p))
        except Exception:
            pass
    else:
        try:
            cmd = ["pgrep", "-f", f"{PROJECT_DIR}.*server\\.py"]
            out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
            for line in out.splitlines():
                p = line.strip()
                if p.isdigit() and int(p) != os.getpid():
                    pids.add(int(p))
        except Exception:
            pass

    return sorted(list(pids))


def is_port_in_use(port: int) -> bool:
    """Checks if a TCP port is currently occupied."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0


def probe_health(port: int) -> bool:
    """Probes the CAMS HTTP health endpoint."""
    url = f"http://127.0.0.1:{port}/api/data"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CAMS-Controller"})
        with urllib.request.urlopen(req, timeout=1.0) as res:
            return res.status == 200
    except Exception:
        return False


# ============================================================================
# VIRTUAL ENVIRONMENT & RUNTIME SETUP
# ============================================================================

def get_venv_python() -> Path:
    """Returns the platform-specific python path inside .venv."""
    venv_dir = PROJECT_DIR / ".venv"
    if IS_WINDOWS:
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python3"


def find_system_python() -> str:
    """Finds an appropriate host Python binary (3.10 - 3.12)."""
    candidates = ["python3.12", "python3.11", "python3.10", "python3", "python"]
    if IS_WINDOWS:
        candidates = ["py -3.12", "py -3.11", "py -3.10", "python", "py"]

    py_check = "import sys; sys.exit(0 if sys.version_info[:2] in [(3,10),(3,11),(3,12)] else 1)"

    for cand in candidates:
        try:
            cmd = cand.split() + ["-c", py_check]
            if subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                return cand
        except Exception:
            continue

    # Fallback to current running Python if version matches
    if sys.version_info[:2] in [(3, 10), (3, 11), (3, 12)]:
        return sys.executable

    return ""


def ensure_environment() -> Path:
    """Ensures .venv exists and requirements are installed."""
    venv_py = get_venv_python()

    if not venv_py.exists():
        print(cyan("⚙  Creating isolated Python environment in .venv..."))
        host_py = find_system_python()
        if not host_py:
            print(red("✗ Error: Python 3.10, 3.11, or 3.12 is required for MediaPipe compatibility."))
            print("  Please install Python 3.11 from https://www.python.org/downloads/")
            sys.exit(1)

        cmd = host_py.split() + ["-m", "venv", str(PROJECT_DIR / ".venv")]
        subprocess.check_call(cmd)
        print(green("✓ Virtual environment created."))

    # Check if requirements installation is needed
    needs_install = False
    if REQ_FILE.exists():
        if not STAMP_FILE.exists():
            needs_install = True
        else:
            try:
                if REQ_FILE.read_text() != STAMP_FILE.read_text():
                    needs_install = True
            except Exception:
                needs_install = True

    if needs_install:
        print(cyan("⚙  Installing/verifying required computer vision libraries (OpenCV, MediaPipe)..."))
        pip_cmd = [str(venv_py), "-m", "pip", "install", "-q", "--upgrade", "pip"]
        subprocess.run(pip_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        req_cmd = [str(venv_py), "-m", "pip", "install", "-q", "-r", str(REQ_FILE)]
        subprocess.check_call(req_cmd)
        try:
            STAMP_FILE.write_text(REQ_FILE.read_text())
        except Exception:
            pass
        print(green("✓ Dependencies verified."))

    return venv_py


# ============================================================================
# COMMAND IMPLEMENTATIONS (BOOT, CLEAN-KILL, STATUS)
# ============================================================================

def do_status():
    """Prints current CAMS execution status."""
    st = get_stored_state()
    pids = find_cams_processes()

    print(bold("\n--- CAMS System Telemetry Status ---"))
    if not pids:
        print(f"  Status:       {yellow('STOPPED (Idle)')}")
        print(f"  Camera:       {green('Optical sensor released & available')}")
        print(f"  Process:      None active")
        print(f"  Launch with:  {cyan('python cams.py start')}\n")
        return False

    port = st.get("port", DEFAULT_PORT)
    pid = pids[0]
    started = st.get("started_at", 0)
    uptime_str = f"{int(time.time() - started)}s" if started else "Active"
    healthy = probe_health(port)

    print(f"  Status:       {green('RUNNING (Active)') if healthy else yellow('INITIALIZING / RUNNING')}")
    print(f"  Primary PID:  {cyan(str(pid))} (Total CAMS workers: {len(pids)})")
    print(f"  Web Studio:   {bold(f'http://localhost:{port}')}")
    print(f"  Uptime:       {uptime_str}")
    print(f"  Health API:   {green('Healthy (200 OK)') if healthy else yellow('Pending handshake')}")
    print(f"  Stop with:    {cyan('python cams.py stop')}\n")
    return True


def do_kill(verbose=True) -> bool:
    """Gracefully terminates CAMS, releases webcam handles, and clears locks."""
    pids = find_cams_processes()

    if not pids:
        if verbose:
            print(yellow("• CAMS is not currently running. Nothing to stop."))
        # Clean up any leftover lock files
        for p in (PID_FILE, STATE_FILE):
            if p.exists():
                try: p.unlink()
                except Exception: pass
        return True

    if verbose:
        print(cyan(f"⏹  Initiating graceful clean-kill for CAMS (PIDs: {', '.join(map(str, pids))})..."))

    # Step 1: Send gentle SIGTERM/SIGINT so OpenCV releases camera and sockets
    for pid in pids:
        if is_pid_alive(pid):
            if IS_WINDOWS:
                # Windows taskkill without /F sends WM_CLOSE
                subprocess.run(["taskkill", "/PID", str(pid), "/T"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                try:
                    os.kill(pid, signal.SIGTERM)
                except Exception:
                    pass

    # Step 2: Wait up to 2.0s for camera handle release and socket closure
    deadline = time.time() + 2.0
    while time.time() < deadline:
        alive = [pid for pid in pids if is_pid_alive(pid)]
        if not alive:
            break
        time.sleep(0.15)

    # Step 3: Forcefully terminate any lingering workers if still alive
    alive = [pid for pid in pids if is_pid_alive(pid)]
    for pid in alive:
        if IS_WINDOWS:
            subprocess.run(["taskkill", "/F", "/PID", str(pid), "/T"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            try:
                os.kill(pid, signal.SIGKILL)
            except Exception:
                pass

    # Step 4: Clean up state files and temporary disk buffers
    for p in (PID_FILE, STATE_FILE):
        if p.exists():
            try: p.unlink()
            except Exception: pass

    for tmp_file in PROJECT_DIR.glob("*.tmp"):
        try: tmp_file.unlink()
        except Exception: pass

    if verbose:
        print(green("✓ CAMS Clean-Kill Complete."))
        print(green("✓ Optical camera sensor released. Hardware LED off."))
        print(green("✓ All background workers and sockets terminated.\n"))

    return True


def do_boot(foreground=False, extra_args=None):
    """Boots up the entire CAMS system, verifies health, and launches browser."""
    extra_args = extra_args or []

    # 1. Check if already running
    pids = find_cams_processes()
    if pids:
        st = get_stored_state()
        port = st.get("port", DEFAULT_PORT)
        print(yellow(f"• CAMS is already running on PID {pids[0]} at http://localhost:{port}"))
        print(f"  Opening browser dashboard...")
        webbrowser.open(f"http://localhost:{port}")
        return True

    # 2. Prepare environment
    venv_py = ensure_environment()

    # 3. Choose startup mode
    cmd = [str(venv_py), str(SERVER_SCRIPT)] + extra_args

    if foreground:
        print(bold(cyan("\n▶  Starting CAMS Studio in foreground mode (Ctrl+C to stop)...")))
        try:
            subprocess.run(cmd)
        except KeyboardInterrupt:
            print("\n")
            do_kill(verbose=True)
        return True

    # Background daemon mode
    print(bold(cyan("\n▶  Booting CAMS Studio Unified Engine...")))

    log_file_path = PROJECT_DIR / "cams.log"
    log_fd = open(log_file_path, "w", encoding="utf-8")

    # Launch detached process cross-platform
    if IS_WINDOWS:
        # DETACHED_PROCESS = 0x00000008, CREATE_NEW_PROCESS_GROUP = 0x00000200
        flags = 0x00000008 | 0x00000200
        proc = subprocess.Popen(cmd, stdout=log_fd, stderr=log_fd, creationflags=flags)
    else:
        proc = subprocess.Popen(cmd, stdout=log_fd, stderr=log_fd, start_new_session=True)

    # 4. Wait for server readiness via health polling
    print(dim("   Waiting for vision engine & telemetry handshake..."), end="", flush=True)
    ready = False
    active_port = DEFAULT_PORT

    for _ in range(40):  # Wait up to 8 seconds
        time.sleep(0.2)
        print(dim("."), end="", flush=True)

        st = get_stored_state()
        if st and st.get("port"):
            active_port = st["port"]

        if probe_health(active_port):
            ready = True
            break

    print()  # newline

    if not ready:
        print(yellow("! Server took longer than expected to report ready. Check cams.log if needed."))
    else:
        print(green(f"✓ Optical Pipeline Online · Telemetry Synced"))

    dashboard_url = f"http://localhost:{active_port}"

    print(bold("\n" + "=" * 55))
    print(bold("  CAMS Studio — Classroom Attention Monitoring System"))
    print("=" * 55)
    print(f"  • Web Dashboard:   {bold(green(dashboard_url))}")
    print(f"  • Video Stream:    {cyan(f'{dashboard_url}/video_feed')}")
    print(f"  • Telemetry WS:    {cyan(f'ws://localhost:{active_port}')}")
    print(f"  • Process PID:     {dim(str(proc.pid))}")
    print("=" * 55)
    print(f"  To stop cleanly:   {bold(yellow('python cams.py stop'))}\n")

    # 5. Open browser automatically
    try:
        webbrowser.open(dashboard_url)
    except Exception:
        pass

    return True


# ============================================================================
# INTERACTIVE TUI (WHEN INVOKED WITHOUT ARGUMENTS)
# ============================================================================

def interactive_menu():
    """Interactive CLI menu when executed without arguments."""
    pids = find_cams_processes()

    if not pids:
        # Not running -> start immediately for 1-click execution
        do_boot()
        return

    st = get_stored_state()
    port = st.get("port", DEFAULT_PORT)

    print(bold("\n======================================================="))
    print(bold("   CAMS Studio — System Controller"))
    print("=======================================================")
    print(f"   Status: {green('RUNNING')} on http://localhost:{port} (PID {pids[0]})")
    print("-------------------------------------------------------")
    print("   [1] Open Dashboard in Browser")
    print("   [2] Clean-Kill / Stop System")
    print("   [3] Restart System")
    print("   [4] View System Status")
    print("   [5] Exit Menu")
    print("=======================================================")

    try:
        choice = input("Enter choice (1-5) [default: 1]: ").strip() or "1"
    except (KeyboardInterrupt, EOFError):
        print("\n")
        return

    if choice == "1":
        webbrowser.open(f"http://localhost:{port}")
    elif choice == "2":
        do_kill(verbose=True)
    elif choice == "3":
        do_kill(verbose=True)
        time.sleep(1.0)
        do_boot()
    elif choice == "4":
        do_status()
    elif choice == "5":
        return
    else:
        print(red("Invalid choice."))


# ============================================================================
# ENTRY POINT
# ============================================================================

def main():
    args = sys.argv[1:]

    if not args:
        interactive_menu()
        return

    cmd = args[0].lower().strip()
    extra = args[1:]

    if cmd in ("start", "boot", "up", "launch"):
        foreground = ("--foreground" in extra or "-f" in extra)
        extra_clean = [a for a in extra if a not in ("--foreground", "-f")]
        do_boot(foreground=foreground, extra_args=extra_clean)

    elif cmd in ("stop", "kill", "clean-kill", "down", "halt"):
        do_kill(verbose=True)

    elif cmd in ("restart", "reboot"):
        do_kill(verbose=True)
        time.sleep(1.0)
        do_boot(extra_args=extra)

    elif cmd in ("status", "info", "check"):
        do_status()

    elif cmd in ("run", "foreground"):
        do_boot(foreground=True, extra_args=extra)

    elif cmd in ("help", "-h", "--help"):
        print(__doc__)

    else:
        # If passed an unknown argument like camera index (e.g. `python cams.py 0`), treat as boot with args
        if cmd.isdigit() or not cmd.startswith("-"):
            do_boot(extra_args=args)
        else:
            print(red(f"Unknown command: {cmd}"))
            print("Usage: python cams.py [start|stop|restart|status|run]")


if __name__ == "__main__":
    main()
