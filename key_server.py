#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global keyboard capture service for the DOTA / streaming overlay.

Behavior:
1) Capture system-wide key events (works when the browser is not focused).
2) Push events to the web UI over WebSocket (ws://localhost:8765).

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
import subprocess
import sys
import threading
import time
from typing import Any

# --- Configuration ---
WS_HOST = "localhost"
WS_PORT = 8765
PIP_MIRROR = "https://pypi.tuna.tsinghua.edu.cn/simple"
REQUIRED_PACKAGES = ("pynput", "websockets")
QUEUE_POLL_INTERVAL_SEC = 0.01


def log(message: str) -> None:
    """Print a timestamped line (user-facing / ops; keep messages in Chinese)."""
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {message}")


# --- Dependency bootstrap (before heavy imports) ---
def ensure_dependencies() -> None:
    """Install missing packages via pip, then execv-restart this process."""
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
            pid = match.group(1)
            if pid != current_pid:
                pids.add(pid)

    for pid in pids:
        subprocess.call(["taskkill", "/F", "/PID", pid])


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
    log("DOTA Keyboard Capture Service")
    log("=" * 50)
    log("功能：捕获全局键盘事件，通过 WebSocket 发送给浏览器")
    log("解决：浏览器失去焦点时无法捕获按键")
    log(f"WebSocket 地址: ws://{WS_HOST}:{WS_PORT}")
    log("按 Ctrl+C 停止服务")

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
        # Only kill port holders after a failed bind, not on every startup
        if not _is_address_in_use(exc):
            raise
        log(f"端口 {WS_PORT} 已被占用，尝试结束占用进程后重试一次...")
        kill_process_using_port(WS_PORT)
        time.sleep(0.5)
        await listen_forever()


def start_keyboard_listener() -> None:
    """Blocking call: run pynput listener in this thread (used from a daemon thread)."""
    with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
        listener.join()


def main() -> None:
    """Entry point: keyboard thread + asyncio WebSocket server."""
    keyboard_thread = threading.Thread(target=start_keyboard_listener, daemon=True)
    keyboard_thread.start()

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
