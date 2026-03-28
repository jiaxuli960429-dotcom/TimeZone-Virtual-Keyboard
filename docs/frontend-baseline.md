# Frontend Behavior Baseline

This file records current frontend behavior before incremental refactoring.
Goal: preserve behavior while improving readability and structure.

## Startup Flow

1. `DOMContentLoaded` initializes canvas and event listeners.
2. Try to load built-in config from `configs/default.json`.
3. Load browser persisted config (`localStorage`) if version is valid.
4. Refresh key list and render canvas.
5. Connect to WebSocket server (`ws://localhost:8765`).
6. Refresh saved project config selector from `/api/configs`.

## Core Runtime Behaviors

- Key highlight state is updated by:
  - WebSocket messages (`{ type: "key", code, pressed }`)
  - Local keydown/keyup fallback handling.
- Canvas redraw is scheduled via `requestAnimationFrame` coalescing.
- Dragging/resizing keys supports snapping and undo/redo history.
- Double click on key opens key editor modal.
- Delete removes currently selected key.

## Config Behaviors

- Exported/saved config schema uses:
  - `version: 5`
  - `keys`, `config`, `bgImage`, `bgPosition`, `bgScale`, `bgKeyOpacity`, `bgNonKeyOpacity`
- Built-in default config path: `configs/default.json`
- Browser persisted config key: `dotaKeyboardConfig`
- Persisted config minimum accepted version: `5`

## API / Endpoint Behaviors

- `GET /api/configs` lists saved config names.
- `POST /api/config/save` saves config to `configs/<name>.json`.
- `GET /api/config?name=...` loads one saved config.
- `DELETE /api/config?name=...` deletes one saved config.

## Manual Regression Checklist

- Page opens and keyboard renders.
- Pressing keys still highlights expected keys.
- Add/edit/remove key works.
- Drag/resize + snapping still works.
- Undo/redo still works.
- Save/load/export/import config still works.
- Global background and key background editing still works.
