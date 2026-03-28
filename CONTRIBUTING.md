# Contributing

Thanks for helping improve **TimeZone Virtual Keyboard**.

## 1. Branches and commits
- Prefer one branch per feature or fix.
- Use clear commit messages, for example:
  - `feat: ...`
  - `fix: ...`
  - `refactor: ...`
  - `docs: ...`

Examples:
- `refactor: simplify websocket keyboard server flow`
- `docs: add contributing conventions`

## 2. Code style
- **Developer-facing** comments and docstrings: **English** (explain *why*, not only *what*).
- **User-facing** UI strings (web, alerts, logs meant for streamers/operators): **Chinese (Simplified)** where this project already uses it.
- Prefer meaningful names; avoid `a`, `tmp`, etc.
- Keep functions focused; consider splitting past ~80–100 lines.
- Handle exceptions as specifically as practical; avoid blanket silent catches.

## 3. Frontend changes
- Match existing UI wording and layout patterns.
- When adding controls, keep `id`s and event handlers aligned between `index.html` and `keyboard.js`.
- Keep OBS browser-source compatibility in mind (e.g. 1200×400 canvas).

## 4. Python service (`key_server.py`)
- Prefer not to break non-Windows platforms (Windows is the main target).
- If you change the WebSocket JSON schema, update the frontend handler accordingly.
- After changing startup logic, run at least `python -m py_compile key_server.py`.

## 5. Pre-merge checklist (minimal)
1. `python -m py_compile key_server.py`
2. Open the page in a browser and verify key highlighting.
3. Save / load config still works.

## 6. Pull request description
- Motivation (why the change)
- What changed (high level)
- Risks / rollback / compatibility
- How you tested (commands + manual steps)
