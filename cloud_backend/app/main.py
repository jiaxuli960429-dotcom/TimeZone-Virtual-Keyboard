from __future__ import annotations

import json
import logging
import os
from collections import defaultdict
from logging.handlers import TimedRotatingFileHandler
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect

from . import db

app = FastAPI(title="TimeZone Keyboard Cloud Backend")

_channel_overlays: dict[str, set[WebSocket]] = defaultdict(set)
_socket_meta: dict[WebSocket, dict[str, str]] = {}

LOG_DIR = os.environ.get("TZK_LOG_DIR", "/opt/launch-advisor/logs/backend")
DEFAULT_CONFIG_NAME = os.environ.get("TZK_DEFAULT_CONFIG_NAME", "默认87键")
DEFAULT_CONFIG_FILE = os.environ.get(
    "TZK_DEFAULT_CONFIG_FILE",
    "/opt/launch-advisor/app/TimeZone-Virtual-Keyboard/webroot/configs/默认87键.json",
)


def _build_rotating_handler(path: str) -> TimedRotatingFileHandler:
    handler = TimedRotatingFileHandler(
        path,
        when="midnight",
        interval=1,
        backupCount=30,
        encoding="utf-8",
    )
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
    )
    return handler


def _setup_logging() -> tuple[logging.Logger, logging.Logger]:
    os.makedirs(LOG_DIR, exist_ok=True)
    app_logger = logging.getLogger("tzk.app")
    realtime_logger = logging.getLogger("tzk.realtime")
    app_logger.setLevel(logging.INFO)
    realtime_logger.setLevel(logging.INFO)
    app_logger.propagate = False
    realtime_logger.propagate = False
    if not app_logger.handlers:
        app_logger.addHandler(_build_rotating_handler(os.path.join(LOG_DIR, "app.log")))
        app_logger.addHandler(logging.StreamHandler())
    if not realtime_logger.handlers:
        realtime_logger.addHandler(
            _build_rotating_handler(os.path.join(LOG_DIR, "realtime.log"))
        )
        realtime_logger.addHandler(logging.StreamHandler())
    return app_logger, realtime_logger


APP_LOG, RT_LOG = _setup_logging()


def _bootstrap_default_config() -> None:
    try:
        with open(DEFAULT_CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        APP_LOG.warning(
            "bootstrap_default_config skipped file=%s err=%s",
            DEFAULT_CONFIG_FILE,
            exc,
        )
        return
    if not isinstance(cfg, dict):
        APP_LOG.warning(
            "bootstrap_default_config skipped file=%s err=not_object",
            DEFAULT_CONFIG_FILE,
        )
        return
    system_user_id = db.ensure_system_user()
    db.upsert_config(system_user_id, DEFAULT_CONFIG_NAME, cfg, visibility="public")
    APP_LOG.info(
        "bootstrap_default_config loaded name=%s keys=%s",
        DEFAULT_CONFIG_NAME,
        len(cfg.get("keys", [])),
    )


def _bootstrap_db() -> None:
    db.init_db()
    _bootstrap_default_config()


def _read_bearer_token(authorization: str | None) -> str:
    if not authorization:
        return ""
    val = authorization.strip()
    if val.lower().startswith("bearer "):
        return val[7:].strip()
    return val


def get_current_user(
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
) -> dict[str, Any]:
    token = _read_bearer_token(authorization) or (x_auth_token or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="unauthorized")
    user = db.get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="invalid token")
    return user


_bootstrap_db()


@app.get("/healthz")
def healthz() -> dict[str, str]:
    APP_LOG.info("healthz")
    return {"ok": "true"}


@app.get("/api/configs")
def list_configs() -> dict[str, Any]:
    names = db.list_config_names()
    APP_LOG.info("list_configs count=%s", len(names))
    return {"ok": True, "names": names}


@app.post("/api/configs/{name}")
def save_config(name: str, config: dict[str, Any]) -> dict[str, Any]:
    system_user_id = db.ensure_system_user()
    db.upsert_config(system_user_id, name, config, visibility="public")
    APP_LOG.info("save_config name=%s keys=%s", name, len(config.get("keys", [])))
    return {"ok": True, "name": name}


@app.get("/api/configs/{name}")
def get_config(name: str) -> dict[str, Any]:
    item = db.get_config_by_name(name)
    if item is None:
        APP_LOG.warning("get_config not_found name=%s", name)
        return {"ok": False, "error": "not found"}
    APP_LOG.info("get_config name=%s", name)
    return {"ok": True, "name": name, "config": item["content"]}


@app.delete("/api/configs/{name}")
def delete_config(name: str) -> dict[str, Any]:
    system_user_id = db.ensure_system_user()
    ok = db.delete_config_by_name_for_owner(system_user_id, name)
    if not ok:
        APP_LOG.warning("delete_config not_found name=%s", name)
        return {"ok": False, "error": "not found"}
    APP_LOG.info("delete_config name=%s", name)
    return {"ok": True}


# Compatibility routes for legacy frontend endpoints.
@app.get("/api/config")
def get_config_compat(name: str = Query(default="")) -> dict[str, Any]:
    item = db.get_config_by_name(name)
    if item is None:
        raise HTTPException(status_code=404, detail="not found")
    # Legacy UI expects raw config object.
    return item["content"]


@app.post("/api/config/save")
def save_config_compat(payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("name", "")).strip()
    config = payload.get("config")
    if not name:
        raise HTTPException(status_code=400, detail="invalid name")
    if not isinstance(config, dict):
        raise HTTPException(status_code=400, detail="config must be object")
    system_user_id = db.ensure_system_user()
    db.upsert_config(system_user_id, name, config, visibility="public")
    APP_LOG.info("save_config_compat name=%s keys=%s", name, len(config.get("keys", [])))
    return {"ok": True, "name": name}


@app.delete("/api/config")
def delete_config_compat(name: str = Query(default="")) -> dict[str, Any]:
    system_user_id = db.ensure_system_user()
    if not db.delete_config_by_name_for_owner(system_user_id, name):
        raise HTTPException(status_code=404, detail="not found")
    APP_LOG.info("delete_config_compat name=%s", name)
    return {"ok": True}


@app.post("/api/v1/auth/register")
def register(payload: dict[str, Any]) -> dict[str, Any]:
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    if len(username) < 3 or len(password) < 6:
        raise HTTPException(status_code=400, detail="invalid username/password")
    try:
        user_id = db.create_user(username, password)
    except Exception:
        raise HTTPException(status_code=409, detail="username exists")
    APP_LOG.info("auth_register username=%s user_id=%s", username, user_id)
    return {"ok": True, "user": {"id": user_id, "username": username}}


@app.post("/api/v1/auth/login")
def login(payload: dict[str, Any]) -> dict[str, Any]:
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    user = db.verify_user(username, password)
    if not user:
        raise HTTPException(status_code=401, detail="invalid credentials")
    token = db.create_session(user["id"])
    APP_LOG.info("auth_login username=%s user_id=%s", username, user["id"])
    return {"ok": True, "token": token, "user": user}


@app.get("/api/v1/auth/me")
def auth_me(
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_current_user(authorization=authorization, x_auth_token=x_auth_token)
    return {"ok": True, "user": user}


@app.post("/api/v1/auth/logout")
def logout(
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
) -> dict[str, Any]:
    token = _read_bearer_token(authorization) or (x_auth_token or "").strip()
    if token:
        db.delete_session(token)
    return {"ok": True}


@app.get("/api/v1/my/configs")
def my_configs(
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_current_user(authorization=authorization, x_auth_token=x_auth_token)
    items = db.list_my_configs(user["id"])
    return {"ok": True, "items": items}


@app.post("/api/v1/configs")
def create_my_config(
    payload: dict[str, Any],
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_current_user(authorization=authorization, x_auth_token=x_auth_token)
    name = str(payload.get("name", "")).strip()
    content = payload.get("content")
    visibility = str(payload.get("visibility", "private")).strip().lower()
    if not name or not isinstance(content, dict):
        raise HTTPException(status_code=400, detail="bad payload")
    if visibility not in ("private", "public"):
        visibility = "private"
    config_id = db.upsert_config(user["id"], name, content, visibility=visibility)
    return {"ok": True, "id": config_id, "name": name}


@app.get("/api/v1/configs/{config_id}")
def get_config_by_id(
    config_id: int,
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_current_user(authorization=authorization, x_auth_token=x_auth_token)
    item = db.get_config_by_id(config_id)
    if not item:
        raise HTTPException(status_code=404, detail="not found")
    if item["visibility"] != "public" and item["ownerUserId"] != user["id"]:
        raise HTTPException(status_code=403, detail="forbidden")
    return {"ok": True, "item": item}


@app.put("/api/v1/configs/{config_id}")
def update_config_by_id(
    config_id: int,
    payload: dict[str, Any],
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_current_user(authorization=authorization, x_auth_token=x_auth_token)
    item = db.get_config_by_id(config_id)
    if not item:
        raise HTTPException(status_code=404, detail="not found")
    if item["ownerUserId"] != user["id"]:
        raise HTTPException(status_code=403, detail="forbidden")
    name = str(payload.get("name", item["name"])).strip()
    content = payload.get("content")
    visibility = str(payload.get("visibility", item["visibility"])).strip().lower()
    if not name or not isinstance(content, dict):
        raise HTTPException(status_code=400, detail="bad payload")
    if visibility not in ("private", "public"):
        visibility = "private"
    db.upsert_config(user["id"], name, content, visibility=visibility)
    return {"ok": True}


@app.delete("/api/v1/configs/{config_id}")
def delete_config_by_id(
    config_id: int,
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_current_user(authorization=authorization, x_auth_token=x_auth_token)
    ok = db.delete_config_by_id_for_owner(config_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="not found or no permission")
    return {"ok": True}


@app.post("/api/v1/configs/{config_id}/publish")
def publish_config(
    config_id: int,
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_current_user(authorization=authorization, x_auth_token=x_auth_token)
    ok = db.publish_config(config_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="not found or no permission")
    return {"ok": True}


@app.get("/api/v1/workshop/configs")
def workshop_list(limit: int = Query(default=50, ge=1, le=200)) -> dict[str, Any]:
    items = db.list_public_configs(limit=limit)
    return {"ok": True, "items": items}


@app.post("/api/v1/configs/{config_id}/fork")
def fork_config(
    config_id: int,
    payload: dict[str, Any],
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_current_user(authorization=authorization, x_auth_token=x_auth_token)
    name = str(payload.get("name", "")).strip()
    if not name:
        raise HTTPException(status_code=400, detail="name required")
    new_id = db.fork_config(config_id, user["id"], name)
    if not new_id:
        raise HTTPException(status_code=404, detail="source not found or forbidden")
    return {"ok": True, "id": new_id}


@app.post("/api/v1/configs/{config_id}/like")
def like_config(
    config_id: int,
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_current_user(authorization=authorization, x_auth_token=x_auth_token)
    item = db.get_config_by_id(config_id)
    if not item or item["visibility"] != "public":
        raise HTTPException(status_code=404, detail="public config not found")
    db.like_config(config_id, user["id"])
    return {"ok": True, "likes": db.count_config_likes(config_id)}


@app.delete("/api/v1/configs/{config_id}/like")
def unlike_config(
    config_id: int,
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_current_user(authorization=authorization, x_auth_token=x_auth_token)
    db.unlike_config(config_id, user["id"])
    return {"ok": True, "likes": db.count_config_likes(config_id)}


def _cleanup_socket(ws: WebSocket) -> None:
    meta = _socket_meta.pop(ws, None)
    if not meta:
        return
    if meta.get("role") == "overlay":
        channel = meta.get("channel", "")
        if channel:
            _channel_overlays[channel].discard(ws)
            if not _channel_overlays[channel]:
                _channel_overlays.pop(channel, None)
    RT_LOG.info("ws_disconnected role=%s channel=%s", meta.get("role"), meta.get("channel"))


async def _broadcast_to_overlays(channel: str, message: str) -> None:
    listeners = len(_channel_overlays.get(channel, set()))
    RT_LOG.info("broadcast channel=%s listeners=%s", channel, listeners)
    dead: list[WebSocket] = []
    for client in list(_channel_overlays.get(channel, set())):
        try:
            await client.send_text(message)
        except Exception:
            dead.append(client)
    for client in dead:
        _cleanup_socket(client)


@app.websocket("/ws/realtime")
async def realtime_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    RT_LOG.info("ws_connected client=%s", websocket.client)
    try:
        # handshake example:
        # {"type":"hello","role":"agent","channel":"demo","deviceId":"pc-01"}
        # {"type":"hello","role":"overlay","channel":"demo"}
        raw = await websocket.receive_text()
        hello = json.loads(raw)
        if hello.get("type") != "hello":
            RT_LOG.warning("ws_bad_hello client=%s reason=missing_type_hello", websocket.client)
            await websocket.send_text(json.dumps({"type": "error", "error": "missing hello"}))
            await websocket.close()
            return
        role = str(hello.get("role", "")).strip().lower()
        channel = str(hello.get("channel", "")).strip()
        if role not in ("agent", "overlay") or not channel:
            RT_LOG.warning(
                "ws_bad_hello client=%s reason=bad_role_or_channel role=%s channel=%s",
                websocket.client,
                role,
                channel,
            )
            await websocket.send_text(json.dumps({"type": "error", "error": "bad role/channel"}))
            await websocket.close()
            return

        _socket_meta[websocket] = {"role": role, "channel": channel}
        if role == "overlay":
            _channel_overlays[channel].add(websocket)
        RT_LOG.info("ws_hello_ack role=%s channel=%s client=%s", role, channel, websocket.client)
        await websocket.send_text(json.dumps({"type": "hello_ack", "role": role, "channel": channel}))

        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            meta = _socket_meta.get(websocket, {})
            role = meta.get("role", "")
            channel = meta.get("channel", "")

            if data.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            # Agents can publish events to channel overlays.
            if role == "agent" and data.get("type") == "key":
                RT_LOG.info("key_event channel=%s code=%s pressed=%s", channel, data.get("code"), data.get("pressed"))
                await _broadcast_to_overlays(channel, raw)
                continue

            if role == "agent" and data.get("type") == "full_state":
                RT_LOG.info(
                    "full_state channel=%s pressed_keys=%s",
                    channel,
                    len(data.get("pressed_keys", []) if isinstance(data.get("pressed_keys"), list) else []),
                )
                await _broadcast_to_overlays(channel, raw)
                continue
    except WebSocketDisconnect:
        _cleanup_socket(websocket)
    except Exception as exc:
        RT_LOG.exception("ws_error client=%s err=%s", websocket.client, exc)
        _cleanup_socket(websocket)
