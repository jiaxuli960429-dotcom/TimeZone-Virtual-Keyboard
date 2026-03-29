#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global keyboard capture service for TimeZoneKeyboard (browser / OBS overlay).

Behavior:
1) Capture system-wide key events (works when the browser is not focused).
2) Push events to the web UI over WebSocket (ws://localhost:8765).
3) Serve the overlay static files and project config API on HTTP (http://127.0.0.1:8080).
   On Windows, HTTP_PORT is reclaimed from other listeners at startup unless
   OVERLAY_SKIP_HTTP_PORT_RECLAIM is set to 1/true/yes.
   Set KEYBOARD_SKIP_BROWSER=1 to skip auto-opening the control panel in the browser.

Design goals ("safe bootstrap"):
- Self-check: install missing dependencies and restart the process.
- Prefer stable public APIs over private internals of third-party libs.
- Resilient: network/client issues must not take down the main service.
"""

from __future__ import annotations

import asyncio
import errno
import importlib.util
import json
import os
import platform
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

# --- Configuration ---
def _resolve_runtime_dirs() -> tuple[str, str]:
    """(bundle_dir, app_dir): static assets vs writable app directory (configs)."""
    if getattr(sys, "frozen", False):
        bundle_dir = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
        app_dir = os.path.dirname(os.path.abspath(sys.executable))
    else:
        here = os.path.dirname(os.path.abspath(__file__))
        bundle_dir = app_dir = here
    return bundle_dir, app_dir


BUNDLE_DIR, APP_DIR = _resolve_runtime_dirs()
CONFIGS_DIR = os.path.join(APP_DIR, "configs")
WS_HOST = "localhost"
WS_PORT = 8765
HTTP_HOST = "127.0.0.1"
HTTP_PORT = 8080
PIP_MIRROR = "https://pypi.tuna.tsinghua.edu.cn/simple"
REQUIRED_PACKAGES = ("pynput", "websockets")
QUEUE_POLL_INTERVAL_SEC = 0.01

_browser_open_lock = threading.Lock()
_browser_opened = False
_vt_colors_enabled = False


def log(message: str) -> None:
    """Print a timestamped line (user-facing / ops; keep messages in Chinese)."""
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {message}")


def _ensure_console_vt_colors() -> None:
    """Enable ANSI colors in Windows conhost (best-effort)."""
    global _vt_colors_enabled
    if _vt_colors_enabled:
        return
    _vt_colors_enabled = True
    if platform.system().lower() != "windows":
        return
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        handle = kernel32.GetStdHandle(-11)
        mode = ctypes.c_uint32()
        if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
            kernel32.SetConsoleMode(handle, mode.value | 0x0004)
    except Exception:
        pass


def log_emphasis(message: str) -> None:
    """High-visibility hint line (yellow); for critical usage tips."""
    _ensure_console_vt_colors()
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    yellow, reset = "\033[1;33m", "\033[0m"
    print(f"[{ts}] {yellow}{message}{reset}")


def _maybe_open_control_panel(url: str) -> None:
    """Open the control panel in the default browser once (unless opted out)."""
    global _browser_opened
    skip = os.environ.get("KEYBOARD_SKIP_BROWSER", "").strip().lower() in ("1", "true", "yes")
    if skip:
        return
    with _browser_open_lock:
        if _browser_opened:
            return
        _browser_opened = True
    try:
        webbrowser.open(url)
        log("已尝试在默认浏览器中打开控制台页面（若未弹出请手动复制上方地址）。")
    except Exception:
        log("无法自动打开浏览器，请手动复制上方「控制台页面」地址到浏览器。")


# --- Dependency bootstrap (before heavy imports) ---
def ensure_dependencies() -> None:
    """Install missing packages via pip, then execv-restart this process."""
    if getattr(sys, "frozen", False):
        return
    missing = [pkg for pkg in REQUIRED_PACKAGES if importlib.util.find_spec(pkg) is None]
    if not missing:
        return

    log(f"检测到缺失依赖: {', '.join(missing)}")
    log("正在自动安装，请稍候...")

    install_cmd_base = [sys.executable, "-m", "pip", "install", *missing]

    try:
        # Tsinghua mirror first (better for CN networks)
        subprocess.check_call([*install_cmd_base, "-i", PIP_MIRROR])
    except subprocess.CalledProcessError:
        # Fall back to default PyPI if the mirror fails
        log("镜像源安装失败，尝试使用默认 PyPI 源...")
        subprocess.check_call(install_cmd_base)

    log("依赖安装完成，正在重启服务...")
    os.execv(sys.executable, [sys.executable, *sys.argv])


ensure_dependencies()

from pynput import keyboard
import websockets

# --- Runtime state ---
key_event_queue: "queue.Queue[tuple[str, str]]" = queue.Queue()
connected_clients: set[Any] = set()


def kill_process_using_port(port: int) -> None:
    """Windows: kill processes listening on `port` (excluding current PID)."""
    if platform.system().lower() != "windows":
        return

    cmd = f"netstat -ano | findstr :{port}"
    try:
        result = subprocess.check_output(
            cmd,
            shell=True,
            encoding="gbk",
            errors="ignore",
        )
    except subprocess.CalledProcessError:
        return

    current_pid = str(os.getpid())
    pid_pattern = re.compile(r"\s+(\d+)\s*$")
    pids: set[str] = set()

    for line in result.splitlines():
        if f":{port}" not in line or "LISTENING" not in line:
            continue
        match = pid_pattern.search(line)
        if match:
            raw = match.group(1).strip()
            try:
                pid_norm = str(int(raw))
            except ValueError:
                continue
            if pid_norm != current_pid:
                pids.add(pid_norm)

    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    for pid in sorted(pids):
        subprocess.run(
            ["taskkill", "/F", "/PID", pid],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creationflags,
        )


def _is_address_in_use(exc: OSError) -> bool:
    """True if `exc` indicates the listen address/port is already in use."""
    if exc.errno == getattr(errno, "EADDRINUSE", None):
        return True
    # Windows: WSAEADDRINUSE
    if getattr(exc, "winerror", None) == 10048:
        return True
    return False


# --- Key code mapping (pynput -> browser KeyboardEvent.code); module-level to avoid per-event dict alloc ---
_DOM_KEY_MAP: dict[str, str] = {
    # Letters
    "a": "KeyA", "b": "KeyB", "c": "KeyC", "d": "KeyD",
    "e": "KeyE", "f": "KeyF", "g": "KeyG", "h": "KeyH",
    "i": "KeyI", "j": "KeyJ", "k": "KeyK", "l": "KeyL",
    "m": "KeyM", "n": "KeyN", "o": "KeyO", "p": "KeyP",
    "q": "KeyQ", "r": "KeyR", "s": "KeyS", "t": "KeyT",
    "u": "KeyU", "v": "KeyV", "w": "KeyW", "x": "KeyX",
    "y": "KeyY", "z": "KeyZ",
    # Digits
    "0": "Digit0", "1": "Digit1", "2": "Digit2", "3": "Digit3",
    "4": "Digit4", "5": "Digit5", "6": "Digit6", "7": "Digit7",
    "8": "Digit8", "9": "Digit9",
    # Function keys
    "f1": "F1", "f2": "F2", "f3": "F3", "f4": "F4",
    "f5": "F5", "f6": "F6", "f7": "F7", "f8": "F8",
    "f9": "F9", "f10": "F10", "f11": "F11", "f12": "F12",
    # Arrows
    "up": "ArrowUp", "down": "ArrowDown",
    "left": "ArrowLeft", "right": "ArrowRight",
    # Editing / navigation
    "space": "Space",
    "enter": "Enter",
    "tab": "Tab",
    "backspace": "Backspace",
    "delete": "Delete",
    "escape": "Escape",
    "home": "Home", "end": "End",
    "pageup": "PageUp", "pagedown": "PageDown",
    "insert": "Insert",
    # Punctuation / symbols
    ".": "Period",
    ",": "Comma",
    "/": "Slash",
    ";": "Semicolon",
    "'": "Quote",
    "[": "BracketLeft",
    "]": "BracketRight",
    "-": "Minus",
    "=": "Equal",
    "`": "Backquote",
    "\\": "Backslash",
}

_DOM_MODIFIER_MAP: dict[str, str] = {
    "shift": "ShiftLeft",
    "shift_l": "ShiftLeft",
    "shift_r": "ShiftRight",
    "ctrl": "ControlLeft",
    "ctrl_l": "ControlLeft",
    "ctrl_r": "ControlRight",
    "alt": "AltLeft",
    "alt_l": "AltLeft",
    "alt_r": "AltRight",
    "alt_gr": "AltRight",
    "cmd": "MetaLeft",
    "cmd_l": "MetaLeft",
    "cmd_r": "MetaRight",
    "caps_lock": "CapsLock",
    "esc": "Escape",
}


def get_key_code(key: keyboard.Key | keyboard.KeyCode) -> str:
    """Map a pynput key to the DOM `KeyboardEvent.code` string."""
    if isinstance(key, keyboard.KeyCode) and key.char:
        char = key.char.lower()
        if char in _DOM_KEY_MAP:
            return _DOM_KEY_MAP[char]

    # Fallback for control-combos (e.g. Ctrl+A) where `key.char` may be "\x01".
    # Use virtual-key codes to recover the physical key.
    vk = getattr(key, "vk", None)
    if isinstance(vk, int):
        if 65 <= vk <= 90:  # A-Z
            return f"Key{chr(vk)}"
        if 48 <= vk <= 57:  # 0-9
            return f"Digit{chr(vk)}"

    key_name = str(key).replace("Key.", "").lower()

    if key_name in _DOM_KEY_MAP:
        return _DOM_KEY_MAP[key_name]
    if key_name in _DOM_MODIFIER_MAP:
        return _DOM_MODIFIER_MAP[key_name]

    return str(key)


def on_press(key: keyboard.Key | keyboard.KeyCode) -> None:
    """pynput callback: enqueue a press event."""
    key_event_queue.put(("press", get_key_code(key)))


def on_release(key: keyboard.Key | keyboard.KeyCode) -> None:
    """pynput callback: enqueue a release event."""
    key_event_queue.put(("release", get_key_code(key)))


# --- WebSocket server ---
async def broadcast_to_clients(message: str) -> None:
    """Send `message` to every connected client; drop broken connections."""
    if not connected_clients:
        return

    disconnected: set[Any] = set()

    for client in list(connected_clients):
        try:
            await client.send(message)
        except Exception:
            disconnected.add(client)

    if disconnected:
        connected_clients.difference_update(disconnected)


async def handle_client(websocket: Any) -> None:
    """One client connection; handle JSON ping/pong."""
    log(f"客户端已连接: {websocket.remote_address}")
    connected_clients.add(websocket)

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                continue

            if isinstance(data, dict) and data.get("type") == "ping":
                await websocket.send(json.dumps({"type": "pong"}))
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        log(f"客户端已断开: {websocket.remote_address}")


async def process_key_events() -> None:
    """Drain the thread-safe queue and broadcast key JSON to clients."""
    while True:
        try:
            event_type, code = key_event_queue.get_nowait()
        except queue.Empty:
            await asyncio.sleep(QUEUE_POLL_INTERVAL_SEC)
            continue

        message = json.dumps(
            {
                "type": "key",
                "code": code,
                "pressed": event_type == "press",
            }
        )
        await broadcast_to_clients(message)


async def start_server() -> None:
    """Run the WebSocket server until cancelled; retry once if port is busy."""
    log("=" * 50)
    log("TimeZoneKeyboard")
    log("=" * 50)
    log("全局捕获键盘，在浏览器或 OBS 里显示；游戏窗口在前台时也能显示按键。")
    log(f"本机连接地址（一般无需手动填写）: ws://{WS_HOST}:{WS_PORT}")
    log("按 Ctrl+C 停止本程序（关闭后浏览器里将不再更新按键）。")

    asyncio.create_task(process_key_events())

    async def listen_forever() -> None:
        async with websockets.serve(
            handle_client,
            WS_HOST,
            WS_PORT,
            ping_interval=20,
            ping_timeout=10,
        ):
            await asyncio.Future()  # block until cancelled

    try:
        await listen_forever()
    except OSError as exc:
        if not _is_address_in_use(exc):
            raise
        log(f"端口 {WS_PORT} 已被占用，正在尝试释放占用进程并重试一次…")
        kill_process_using_port(WS_PORT)
        time.sleep(0.55)
        try:
            await listen_forever()
        except OSError as exc2:
            if _is_address_in_use(exc2):
                log(f"端口 {WS_PORT} 仍被占用：请先关闭另一份本程序或其它占用该端口的软件。")
            raise


def _sanitize_config_basename(name: Any) -> str | None:
    """Safe filename stem for configs/*.json (no path separators)."""
    if not isinstance(name, str):
        return None
    s = name.strip()
    if not s or len(s) > 80 or s.startswith("."):
        return None
    for bad in ("/", "\\", ":", "*", "?", '"', "<", ">", "|"):
        if bad in s:
            return None
    if ".." in s:
        return None
    return s


def _safe_config_file(configs_dir: str, safe_name: str) -> str | None:
    """Absolute path to one JSON file under configs_dir, or None if traversal."""
    try:
        base = os.path.realpath(configs_dir)
        candidate = os.path.realpath(os.path.join(configs_dir, safe_name + ".json"))
        if os.path.commonpath([base, candidate]) != base:
            return None
    except (OSError, ValueError):
        return None
    return candidate


def _normalized_request_path(raw_path: str) -> str:
    """Strip query/fragment, lowercase, drop trailing slash (except '/')."""
    parsed = urllib.parse.urlparse(raw_path)
    p = parsed.path or "/"
    p = p.lower()
    if len(p) > 1 and p.endswith("/"):
        p = p.rstrip("/")
    return p


def _list_saved_config_names(configs_dir: str) -> list[str]:
    if not os.path.isdir(configs_dir):
        return []
    names: list[str] = []
    for entry in sorted(os.listdir(configs_dir)):
        if entry.startswith(".") or not entry.lower().endswith(".json"):
            continue
        path = os.path.join(configs_dir, entry)
        if os.path.isfile(path):
            names.append(entry[:-5])
    return names


def _summarize_config_json_file(path: str) -> dict[str, Any]:
    """Light metadata for config list UI (author / saved time / key count / file mtime)."""
    stem = os.path.splitext(os.path.basename(path))[0]
    out: dict[str, Any] = {
        "name": stem,
        "keyCount": 0,
        "author": "",
        "updatedAt": "",
        "fileModified": "",
    }
    try:
        st = os.stat(path)
        out["fileModified"] = time.strftime("%Y-%m-%d %H:%M", time.localtime(st.st_mtime))
    except OSError:
        pass
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return out
    if not isinstance(data, dict):
        return out
    keys = data.get("keys")
    if isinstance(keys, list):
        out["keyCount"] = len(keys)
    meta = data.get("meta")
    if isinstance(meta, dict):
        author = meta.get("author")
        updated = meta.get("updatedAt")
        if isinstance(author, str):
            out["author"] = author.strip()
        if isinstance(updated, str):
            out["updatedAt"] = updated.strip()
    return out


def _list_saved_config_summaries(configs_dir: str) -> list[dict[str, Any]]:
    if not os.path.isdir(configs_dir):
        return []
    items: list[dict[str, Any]] = []
    for entry in sorted(os.listdir(configs_dir)):
        if entry.startswith(".") or not entry.lower().endswith(".json"):
            continue
        path = os.path.join(configs_dir, entry)
        if os.path.isfile(path):
            items.append(_summarize_config_json_file(path))
    return items


def _open_configs_dir(configs_dir: str) -> tuple[bool, str]:
    """Best-effort open configs folder in OS file explorer."""
    try:
        os.makedirs(configs_dir, exist_ok=True)
        if platform.system().lower() == "windows":
            os.startfile(configs_dir)  # type: ignore[attr-defined]
        elif platform.system().lower() == "darwin":
            subprocess.Popen(["open", configs_dir])
        else:
            subprocess.Popen(["xdg-open", configs_dir])
        return True, ""
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)


def _build_overlay_http_handler(root_dir: str, configs_dir: str):
    """Factory: HTTP static root + /api/config* for overlay JSON profiles."""

    class OverlayHTTPRequestHandler(SimpleHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, directory=root_dir, **kwargs)

        def log_message(self, format: str, *args: Any) -> None:
            return

        def _send_bytes(self, code: int, data: bytes, content_type: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def _send_json(self, code: int, obj: Any) -> None:
            self._send_bytes(
                code,
                json.dumps(obj, ensure_ascii=False).encode("utf-8"),
                "application/json; charset=utf-8",
            )

        def do_GET(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            path = _normalized_request_path(self.path)
            if path == "/overlay":
                overlay_fp = os.path.join(root_dir, "overlay.html")
                if not os.path.isfile(overlay_fp):
                    self._send_json(404, {"ok": False, "error": "overlay.html not found"})
                    return
                try:
                    with open(overlay_fp, "rb") as f:
                        html = f.read()
                except OSError:
                    self._send_json(500, {"ok": False, "error": "overlay read failed"})
                    return
                self._send_bytes(200, html, "text/html; charset=utf-8")
                return
            if path == "/api/configs":
                summaries = _list_saved_config_summaries(configs_dir)
                self._send_json(
                    200,
                    {
                        "ok": True,
                        "names": [x["name"] for x in summaries],
                        "items": summaries,
                    },
                )
                return
            if path == "/api/config":
                qs = urllib.parse.parse_qs(parsed.query)
                raw = (qs.get("name") or [None])[0]
                safe = _sanitize_config_basename(raw)
                if not safe:
                    self._send_json(400, {"ok": False, "error": "invalid name"})
                    return
                fp = _safe_config_file(configs_dir, safe)
                if fp is None or not os.path.isfile(fp):
                    self._send_json(404, {"ok": False, "error": "not found"})
                    return
                try:
                    with open(fp, "rb") as f:
                        data = f.read()
                except OSError:
                    self._send_json(500, {"ok": False, "error": "read failed"})
                    return
                self._send_bytes(200, data, "application/json; charset=utf-8")
                return
            super().do_GET()

        def do_POST(self) -> None:
            path = _normalized_request_path(self.path)
            if path == "/api/config/open-folder":
                ok, err = _open_configs_dir(configs_dir)
                if ok:
                    self._send_json(200, {"ok": True})
                else:
                    self._send_json(500, {"ok": False, "error": f"open folder failed: {err}"})
                return
            if path != "/api/config/save":
                log(f"HTTP POST 未匹配路由: raw={self.path!r} normalized={path!r}")
                self._send_json(404, {"ok": False, "error": "not found", "path": path})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                length = 0
            body = self.rfile.read(length) if length else b""
            try:
                payload = json.loads(body.decode("utf-8"))
            except json.JSONDecodeError:
                self._send_json(400, {"ok": False, "error": "invalid json"})
                return
            safe = _sanitize_config_basename(payload.get("name"))
            if not safe:
                self._send_json(400, {"ok": False, "error": "invalid name"})
                return
            cfg = payload.get("config")
            if not isinstance(cfg, dict):
                self._send_json(400, {"ok": False, "error": "config must be object"})
                return
            fp = _safe_config_file(configs_dir, safe)
            if fp is None:
                self._send_json(400, {"ok": False, "error": "bad path"})
                return
            try:
                os.makedirs(os.path.dirname(fp), exist_ok=True)
                with open(fp, "w", encoding="utf-8") as f:
                    json.dump(cfg, f, ensure_ascii=False, indent=2)
            except OSError:
                self._send_json(500, {"ok": False, "error": "write failed"})
                return
            self._send_json(200, {"ok": True, "name": safe})

        def do_DELETE(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            path = _normalized_request_path(self.path)
            if path != "/api/config":
                self._send_json(404, {"ok": False, "error": "not found", "path": path})
                return
            qs = urllib.parse.parse_qs(parsed.query)
            raw = (qs.get("name") or [None])[0]
            safe = _sanitize_config_basename(raw)
            if not safe:
                self._send_json(400, {"ok": False, "error": "invalid name"})
                return
            fp = _safe_config_file(configs_dir, safe)
            if fp is None or not os.path.isfile(fp):
                self._send_json(404, {"ok": False, "error": "not found"})
                return
            try:
                os.remove(fp)
            except OSError:
                self._send_json(500, {"ok": False, "error": "delete failed"})
                return
            self._send_json(200, {"ok": True})

    return OverlayHTTPRequestHandler


def start_http_server_background() -> None:
    """Serve static UI on HTTP_PORT and JSON profiles under configs/."""
    os.makedirs(CONFIGS_DIR, exist_ok=True)
    handler_cls = _build_overlay_http_handler(BUNDLE_DIR, CONFIGS_DIR)

    def run() -> None:
        # Free HTTP_PORT before bind so old one-off static servers (e.g. legacy bat + PowerShell)
        # do not keep 8080; avoids POST /api/config/save -> 404 for users.
        skip_reclaim = os.environ.get("OVERLAY_SKIP_HTTP_PORT_RECLAIM", "").strip().lower() in (
            "1",
            "true",
            "yes",
        )
        if platform.system().lower() == "windows" and not skip_reclaim:
            log(f"正在检查本地端口 {HTTP_PORT}（若被旧进程占用将自动释放）…")
            kill_process_using_port(HTTP_PORT)
            time.sleep(0.55)

        for attempt in range(2):
            try:
                httpd = ThreadingHTTPServer((HTTP_HOST, HTTP_PORT), handler_cls)
                break
            except OSError as exc:
                if attempt == 0 and _is_address_in_use(exc):
                    log(f"端口 {HTTP_PORT} 已被占用，正在尝试释放占用进程并重试一次…")
                    kill_process_using_port(HTTP_PORT)
                    time.sleep(0.5)
                else:
                    log(f"网页服务启动失败（无法在浏览器里改键位与保存配置）: {exc}")
                    return
        else:
            return
        console_url = f"http://{HTTP_HOST}:{HTTP_PORT}/"
        log(f"控制台页面（日常调键位、保存配置）: {console_url}")
        log(f"配置列表接口（高级）: http://{HTTP_HOST}:{HTTP_PORT}/api/configs")
        log_emphasis(
            f"请优先使用上方控制台页面。OBS 浏览器源请复制页面内「OBS」卡片里的完整链接，不要自己拼 /overlay 路径。"
        )
        _maybe_open_control_panel(console_url)
        httpd.serve_forever()

    threading.Thread(target=run, name="http-overlay", daemon=True).start()


def start_keyboard_listener() -> None:
    """Blocking call: run pynput listener in this thread (used from a daemon thread)."""
    with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
        listener.join()


def _ensure_default_config_from_bundle() -> None:
    """Frozen build: copy bundled default.json beside the exe if user has none yet."""
    if not getattr(sys, "frozen", False):
        return
    os.makedirs(CONFIGS_DIR, exist_ok=True)
    dest = os.path.join(CONFIGS_DIR, "default.json")
    if os.path.isfile(dest):
        return
    src = os.path.join(BUNDLE_DIR, "configs", "default.json")
    if os.path.isfile(src):
        shutil.copy2(src, dest)


def main() -> None:
    """Entry point: keyboard thread + HTTP static/API + asyncio WebSocket server."""
    _ensure_default_config_from_bundle()
    keyboard_thread = threading.Thread(target=start_keyboard_listener, daemon=True)
    keyboard_thread.start()

    start_http_server_background()
    time.sleep(0.45)

    try:
        asyncio.run(start_server())
    except KeyboardInterrupt:
        log("服务已停止")
        sys.exit(0)
    except OSError as exc:
        log(f"网络启动失败（可能端口占用）: {exc}")
        input("按 Enter 退出")
    except Exception as exc:
        log(f"错误: {exc}")
        input("按 Enter 退出")


if __name__ == "__main__":
    main()
