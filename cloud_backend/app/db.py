from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any

DB_PATH = os.environ.get("TZK_DB_PATH", "/opt/launch-advisor/data/tzk.db")
AUTH_SECRET = os.environ.get("TZK_AUTH_SECRET", "change-me-in-production")
SESSION_TTL_DAYS = int(os.environ.get("TZK_SESSION_TTL_DAYS", "7"))


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _session_expire_iso() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)).isoformat()


def _ensure_parent_dir(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)


def get_conn() -> sqlite3.Connection:
    _ensure_parent_dir(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                content_json TEXT NOT NULL,
                visibility TEXT NOT NULL DEFAULT 'private',
                fork_from INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                published_at TEXT,
                UNIQUE(owner_user_id, name),
                FOREIGN KEY(owner_user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS config_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_id INTEGER NOT NULL,
                version_no INTEGER NOT NULL,
                content_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(config_id) REFERENCES configs(id)
            );

            CREATE TABLE IF NOT EXISTS config_likes (
                config_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY(config_id, user_id),
                FOREIGN KEY(config_id) REFERENCES configs(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            """
        )
        conn.commit()


def password_hash(password: str) -> str:
    data = (password + "::" + AUTH_SECRET).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def ensure_system_user() -> int:
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM users WHERE username='system'").fetchone()
        if row:
            return int(row["id"])
        now = _utc_now_iso()
        conn.execute(
            "INSERT INTO users(username, password_hash, created_at) VALUES (?, ?, ?)",
            ("system", password_hash("system-disabled"), now),
        )
        conn.commit()
        row2 = conn.execute("SELECT id FROM users WHERE username='system'").fetchone()
        return int(row2["id"])


def create_user(username: str, password: str) -> int:
    now = _utc_now_iso()
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO users(username, password_hash, created_at) VALUES (?, ?, ?)",
            (username, password_hash(password), now),
        )
        conn.commit()
        return int(cur.lastrowid)


def verify_user(username: str, password: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username=?",
            (username,),
        ).fetchone()
        if not row:
            return None
        if row["password_hash"] != password_hash(password):
            return None
        return {"id": int(row["id"]), "username": str(row["username"])}


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = _utc_now_iso()
    expire = _session_expire_iso()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions(token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, user_id, now, expire),
        )
        conn.commit()
    return token


def get_user_by_token(token: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT u.id AS id, u.username AS username, s.expires_at AS expires_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()
        if not row:
            return None
        if row["expires_at"] < _utc_now_iso():
            conn.execute("DELETE FROM sessions WHERE token=?", (token,))
            conn.commit()
            return None
        return {"id": int(row["id"]), "username": str(row["username"])}


def delete_session(token: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token=?", (token,))
        conn.commit()


def _next_version_no(conn: sqlite3.Connection, config_id: int) -> int:
    row = conn.execute(
        "SELECT COALESCE(MAX(version_no), 0) AS n FROM config_versions WHERE config_id=?",
        (config_id,),
    ).fetchone()
    return int(row["n"]) + 1


def upsert_config(owner_user_id: int, name: str, content: dict[str, Any], visibility: str = "private") -> int:
    now = _utc_now_iso()
    payload = json.dumps(content, ensure_ascii=False)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM configs WHERE owner_user_id=? AND name=?",
            (owner_user_id, name),
        ).fetchone()
        if row:
            config_id = int(row["id"])
            conn.execute(
                "UPDATE configs SET content_json=?, visibility=?, updated_at=? WHERE id=?",
                (payload, visibility, now, config_id),
            )
        else:
            cur = conn.execute(
                """
                INSERT INTO configs(owner_user_id, name, content_json, visibility, fork_from, created_at, updated_at)
                VALUES (?, ?, ?, ?, NULL, ?, ?)
                """,
                (owner_user_id, name, payload, visibility, now, now),
            )
            config_id = int(cur.lastrowid)
        v = _next_version_no(conn, config_id)
        conn.execute(
            "INSERT INTO config_versions(config_id, version_no, content_json, created_at) VALUES (?, ?, ?, ?)",
            (config_id, v, payload, now),
        )
        conn.commit()
        return config_id


def get_config_by_name(name: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT c.id, c.name, c.content_json, c.visibility, u.username AS owner
            FROM configs c
            JOIN users u ON u.id = c.owner_user_id
            WHERE c.name = ?
            ORDER BY c.updated_at DESC
            LIMIT 1
            """,
            (name,),
        ).fetchone()
        if not row:
            return None
        return {
            "id": int(row["id"]),
            "name": str(row["name"]),
            "content": json.loads(str(row["content_json"])),
            "visibility": str(row["visibility"]),
            "owner": str(row["owner"]),
        }


def list_config_names() -> list[str]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT DISTINCT name FROM configs ORDER BY name ASC"
        ).fetchall()
        return [str(r["name"]) for r in rows]


def delete_config_by_name_for_owner(owner_user_id: int, name: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM configs WHERE owner_user_id=? AND name=?",
            (owner_user_id, name),
        )
        conn.commit()
        return cur.rowcount > 0


def list_my_configs(owner_user_id: int) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, name, visibility, updated_at
            FROM configs
            WHERE owner_user_id=?
            ORDER BY updated_at DESC
            """,
            (owner_user_id,),
        ).fetchall()
        return [
            {
                "id": int(r["id"]),
                "name": str(r["name"]),
                "visibility": str(r["visibility"]),
                "updatedAt": str(r["updated_at"]),
            }
            for r in rows
        ]


def list_public_configs(limit: int = 50) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT c.id, c.name, c.updated_at, u.username AS owner
            FROM configs c
            JOIN users u ON u.id = c.owner_user_id
            WHERE c.visibility='public'
            ORDER BY c.updated_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [
            {
                "id": int(r["id"]),
                "name": str(r["name"]),
                "owner": str(r["owner"]),
                "updatedAt": str(r["updated_at"]),
                "likes": count_config_likes(int(r["id"])),
            }
            for r in rows
        ]


def get_config_by_id(config_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT c.id, c.name, c.visibility, c.content_json, c.owner_user_id, u.username AS owner
            FROM configs c
            JOIN users u ON u.id = c.owner_user_id
            WHERE c.id=?
            """,
            (config_id,),
        ).fetchone()
        if not row:
            return None
        return {
            "id": int(row["id"]),
            "name": str(row["name"]),
            "visibility": str(row["visibility"]),
            "ownerUserId": int(row["owner_user_id"]),
            "owner": str(row["owner"]),
            "content": json.loads(str(row["content_json"])),
        }


def publish_config(config_id: int, owner_user_id: int) -> bool:
    now = _utc_now_iso()
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE configs SET visibility='public', published_at=?, updated_at=? WHERE id=? AND owner_user_id=?",
            (now, now, config_id, owner_user_id),
        )
        conn.commit()
        return cur.rowcount > 0


def delete_config_by_id_for_owner(config_id: int, owner_user_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM configs WHERE id=? AND owner_user_id=?",
            (config_id, owner_user_id),
        )
        conn.commit()
        return cur.rowcount > 0


def fork_config(source_config_id: int, new_owner_user_id: int, new_name: str) -> int | None:
    src = get_config_by_id(source_config_id)
    if not src:
        return None
    if src["visibility"] != "public" and src["ownerUserId"] != new_owner_user_id:
        return None
    now = _utc_now_iso()
    payload = json.dumps(src["content"], ensure_ascii=False)
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO configs(owner_user_id, name, content_json, visibility, fork_from, created_at, updated_at)
            VALUES (?, ?, ?, 'private', ?, ?, ?)
            """,
            (new_owner_user_id, new_name, payload, source_config_id, now, now),
        )
        config_id = int(cur.lastrowid)
        conn.execute(
            "INSERT INTO config_versions(config_id, version_no, content_json, created_at) VALUES (?, 1, ?, ?)",
            (config_id, payload, now),
        )
        conn.commit()
        return config_id


def like_config(config_id: int, user_id: int) -> bool:
    now = _utc_now_iso()
    with get_conn() as conn:
        try:
            conn.execute(
                "INSERT INTO config_likes(config_id, user_id, created_at) VALUES (?, ?, ?)",
                (config_id, user_id, now),
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False


def unlike_config(config_id: int, user_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM config_likes WHERE config_id=? AND user_id=?",
            (config_id, user_id),
        )
        conn.commit()
        return cur.rowcount > 0


def count_config_likes(config_id: int) -> int:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS c FROM config_likes WHERE config_id=?",
            (config_id,),
        ).fetchone()
        return int(row["c"]) if row else 0


def is_config_liked_by_user(config_id: int, user_id: int) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 AS ok FROM config_likes WHERE config_id=? AND user_id=?",
            (config_id, user_id),
        ).fetchone()
        return row is not None
