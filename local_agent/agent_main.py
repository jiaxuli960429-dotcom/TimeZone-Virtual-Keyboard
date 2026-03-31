from __future__ import annotations

import asyncio
import json
import os
import time
from queue import Empty, Queue
from collections import defaultdict

import websockets

from keyboard_capture import start_capture

SERVER_WS_URL = os.environ.get("TZK_SERVER_WS_URL", "ws://127.0.0.1:8000/ws/realtime")
DEVICE_ID = os.environ.get("TZK_DEVICE_ID", "dev-local")
CHANNEL = os.environ.get("TZK_CHANNEL", "demo")
LOG_STATS_INTERVAL_SEC = float(os.environ.get("TZK_LOG_STATS_INTERVAL_SEC", "2"))
LOCAL_RELAY_HOST = os.environ.get("TZK_LOCAL_RELAY_HOST", "127.0.0.1")
LOCAL_RELAY_PORT = int(os.environ.get("TZK_LOCAL_RELAY_PORT", "8766"))

_local_overlay_clients: dict[str, set[websockets.WebSocketServerProtocol]] = defaultdict(set)


def _cleanup_local_client(ws: websockets.WebSocketServerProtocol) -> None:
    for channel in list(_local_overlay_clients.keys()):
        _local_overlay_clients[channel].discard(ws)
        if not _local_overlay_clients[channel]:
            _local_overlay_clients.pop(channel, None)


async def _broadcast_local(channel: str, payload_json: str) -> None:
    dead = []
    for client in list(_local_overlay_clients.get(channel, set())):
        try:
            await client.send(payload_json)
        except Exception:
            dead.append(client)
    for client in dead:
        _cleanup_local_client(client)


async def local_relay_handler(ws: websockets.WebSocketServerProtocol) -> None:
    try:
        raw = await ws.recv()
        hello = json.loads(raw)
        if hello.get("type") != "hello":
            await ws.send(json.dumps({"type": "error", "error": "missing hello"}, ensure_ascii=False))
            await ws.close()
            return
        role = str(hello.get("role", "")).strip().lower()
        channel = str(hello.get("channel", "")).strip()
        if role != "overlay" or not channel:
            await ws.send(json.dumps({"type": "error", "error": "bad role/channel"}, ensure_ascii=False))
            await ws.close()
            return
        _local_overlay_clients[channel].add(ws)
        await ws.send(json.dumps({"type": "hello_ack", "role": "overlay", "channel": channel}, ensure_ascii=False))
        print(f"[agent] local relay client connected channel={channel}")
        async for raw in ws:
            # overlay may send ping; respond for compatibility
            try:
                data = json.loads(raw)
            except Exception:
                continue
            if isinstance(data, dict) and data.get("type") == "ping":
                await ws.send(json.dumps({"type": "pong"}, ensure_ascii=False))
    except Exception:
        pass
    finally:
        _cleanup_local_client(ws)


async def run_local_relay() -> None:
    async with websockets.serve(local_relay_handler, LOCAL_RELAY_HOST, LOCAL_RELAY_PORT, ping_interval=20, ping_timeout=10):
        print(f"[agent] local relay ws://{LOCAL_RELAY_HOST}:{LOCAL_RELAY_PORT}/ws/local")
        await asyncio.Future()


async def heartbeat(ws: websockets.WebSocketClientProtocol) -> None:
    while True:
        payload = {
            "type": "heartbeat",
            "deviceId": DEVICE_ID,
            "channel": CHANNEL,
            "ts": int(time.time()),
        }
        await ws.send(json.dumps(payload, ensure_ascii=False))
        print(f"[agent] heartbeat channel={CHANNEL} device={DEVICE_ID}")
        await asyncio.sleep(10)


async def pump_key_events(ws: websockets.WebSocketClientProtocol, q: Queue[tuple[str, str]]) -> None:
    sent_total = 0
    window_count = 0
    last_stats_ts = time.time()
    while True:
        try:
            action, code = q.get_nowait()
        except Empty:
            await asyncio.sleep(0.01)
            continue
        payload = {
            "type": "key",
            "deviceId": DEVICE_ID,
            "channel": CHANNEL,
            "code": code,
            "pressed": action == "press",
            "ts": int(time.time() * 1000),
        }
        payload_json = json.dumps(payload, ensure_ascii=False)
        await ws.send(payload_json)
        await _broadcast_local(CHANNEL, payload_json)
        sent_total += 1
        window_count += 1
        now = time.time()
        if now - last_stats_ts >= LOG_STATS_INTERVAL_SEC:
            rate = window_count / max(now - last_stats_ts, 0.001)
            print(
                f"[agent] key_stats total={sent_total} recent={window_count} "
                f"rate={rate:.1f}/s channel={CHANNEL}"
            )
            window_count = 0
            last_stats_ts = now


async def run_agent() -> None:
    print(f"[agent] connect => {SERVER_WS_URL}")
    async with websockets.connect(SERVER_WS_URL, ping_interval=20, ping_timeout=10) as ws:
        await ws.send(
            json.dumps(
                {
                    "type": "hello",
                    "role": "agent",
                    "channel": CHANNEL,
                    "deviceId": DEVICE_ID,
                },
                ensure_ascii=False,
            )
        )
        ack = await ws.recv()
        print(f"[agent] hello_ack => {ack}")
        print("[agent] connected")
        q: Queue[tuple[str, str]] = Queue()
        start_capture(q)
        await asyncio.gather(run_local_relay(), heartbeat(ws), pump_key_events(ws, q))


def main() -> None:
    while True:
        try:
            asyncio.run(run_agent())
        except KeyboardInterrupt:
            print("[agent] stopped")
            return
        except Exception as exc:
            print(f"[agent] reconnect after error: {exc!r}")
            time.sleep(3)


if __name__ == "__main__":
    main()
