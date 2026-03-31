from __future__ import annotations

import threading
from queue import Queue

from pynput import keyboard

_DOM_KEY_MAP: dict[str, str] = {
    "a": "KeyA",
    "b": "KeyB",
    "c": "KeyC",
    "d": "KeyD",
    "e": "KeyE",
    "f": "KeyF",
    "g": "KeyG",
    "h": "KeyH",
    "i": "KeyI",
    "j": "KeyJ",
    "k": "KeyK",
    "l": "KeyL",
    "m": "KeyM",
    "n": "KeyN",
    "o": "KeyO",
    "p": "KeyP",
    "q": "KeyQ",
    "r": "KeyR",
    "s": "KeyS",
    "t": "KeyT",
    "u": "KeyU",
    "v": "KeyV",
    "w": "KeyW",
    "x": "KeyX",
    "y": "KeyY",
    "z": "KeyZ",
    "0": "Digit0",
    "1": "Digit1",
    "2": "Digit2",
    "3": "Digit3",
    "4": "Digit4",
    "5": "Digit5",
    "6": "Digit6",
    "7": "Digit7",
    "8": "Digit8",
    "9": "Digit9",
    "space": "Space",
    "enter": "Enter",
    "tab": "Tab",
    "backspace": "Backspace",
    "delete": "Delete",
    "escape": "Escape",
    "up": "ArrowUp",
    "down": "ArrowDown",
    "left": "ArrowLeft",
    "right": "ArrowRight",
    "home": "Home",
    "end": "End",
    "pageup": "PageUp",
    "pagedown": "PageDown",
    "insert": "Insert",
    "f1": "F1",
    "f2": "F2",
    "f3": "F3",
    "f4": "F4",
    "f5": "F5",
    "f6": "F6",
    "f7": "F7",
    "f8": "F8",
    "f9": "F9",
    "f10": "F10",
    "f11": "F11",
    "f12": "F12",
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
    "caps_lock": "CapsLock",
    "esc": "Escape",
}


def get_key_code(key: keyboard.Key | keyboard.KeyCode) -> str:
    if isinstance(key, keyboard.KeyCode) and key.char:
        char = key.char.lower()
        if char in _DOM_KEY_MAP:
            return _DOM_KEY_MAP[char]
    vk = getattr(key, "vk", None)
    if isinstance(vk, int):
        if 65 <= vk <= 90:
            return f"Key{chr(vk)}"
        if 48 <= vk <= 57:
            return f"Digit{chr(vk)}"
    name = str(key).replace("Key.", "").lower()
    if name in _DOM_KEY_MAP:
        return _DOM_KEY_MAP[name]
    if name in _DOM_MODIFIER_MAP:
        return _DOM_MODIFIER_MAP[name]
    return str(key)


def start_capture(event_queue: Queue[tuple[str, str]]) -> threading.Thread:
    def on_press(key: keyboard.Key | keyboard.KeyCode) -> None:
        event_queue.put(("press", get_key_code(key)))

    def on_release(key: keyboard.Key | keyboard.KeyCode) -> None:
        event_queue.put(("release", get_key_code(key)))

    def run_listener() -> None:
        with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
            listener.join()

    thread = threading.Thread(target=run_listener, name="keyboard-capture", daemon=True)
    thread.start()
    return thread
