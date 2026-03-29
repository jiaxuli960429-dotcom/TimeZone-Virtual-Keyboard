# One-off / regen: builds configs/default.json — ANSI-style core + nav cluster (no overlaps).
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "configs", "default.json")

G = 6
H = 46
W = 50
W_BS = 88
W_TAB = 72
W_CAPS = 82
W_SHIFT_L = 100
# 右缘对齐：Enter / 右 Shift / 右 Ctrl / \ 的宽度由 core_right 反推，不再用固定宽
W_CTRL = 64
W_WIN = 64
W_ALT = 64
W_SPACE = 280
W_F = 44
H_F = 38
W_NAV = 52
NAV_GAP = 18  # space between main block (e.g. Backspace) and Ins/Del column


def key(code, label, x, y, w=W, h=H):
    return {
        "code": code,
        "label": label,
        "x": int(x),
        "y": int(y),
        "width": int(w),
        "height": int(h),
    }


def main():
    keys = []
    x0, y = 16, 14

    # --- Function row (Esc + F1–F12) ---
    keys.append(key("Escape", "Esc", x0, y, 52, H_F))
    x = x0 + 52 + 18
    for i in range(1, 5):
        keys.append(key(f"F{i}", f"F{i}", x, y, W_F, H_F))
        x += W_F + G
    x += 16
    for i in range(5, 9):
        keys.append(key(f"F{i}", f"F{i}", x, y, W_F, H_F))
        x += W_F + G
    x += 16
    for i in range(9, 13):
        keys.append(key(f"F{i}", f"F{i}", x, y, W_F, H_F))
        x += W_F + G
    f_block_right = x

    y1 = y + H_F + G + 4

    # --- Number row (must compute right edge before nav column) ---
    x = x0
    keys.append(key("Backquote", "`", x, y1))
    x += W + G
    for d in range(1, 10):
        keys.append(key(f"Digit{d}", str(d), x, y1))
        x += W + G
    keys.append(key("Digit0", "0", x, y1))
    x += W + G
    keys.append(key("Minus", "-", x, y1))
    x += W + G
    keys.append(key("Equal", "=", x, y1))
    x += W + G
    # 主键区右缘：Back 与 \、Enter、右 Shift、右 Ctrl 共用同一竖线
    bs_x = x
    core_right = bs_x + W_BS
    keys.append(key("Backspace", "Back", bs_x, y1, core_right - bs_x))
    main_right = core_right

    # Nav column entirely to the RIGHT of core block
    nav_x = main_right + NAV_GAP
    # If F row sticks out past backspace, keep nav clear of F12 as well
    nav_x = max(nav_x, f_block_right + 12)

    keys.extend(
        [
            key("Insert", "Ins", nav_x, y, W_NAV, H_F),
            key("Home", "Home", nav_x + W_NAV + G, y, W_NAV, H_F),
            key("PageUp", "PgUp", nav_x + 2 * (W_NAV + G), y, W_NAV, H_F),
        ]
    )

    # Del / End / PgDn: same vertical band as number row (standard 104-key alignment)
    keys.extend(
        [
            key("Delete", "Del", nav_x, y1, W_NAV, H),
            key("End", "End", nav_x + W_NAV + G, y1, W_NAV, H),
            key("PageDown", "PgDn", nav_x + 2 * (W_NAV + G), y1, W_NAV, H),
        ]
    )

    y2 = y1 + H + G
    x = x0
    keys.append(key("Tab", "Tab", x, y2, W_TAB))
    x += W_TAB + G
    for c, lb in [
        ("KeyQ", "Q"),
        ("KeyW", "W"),
        ("KeyE", "E"),
        ("KeyR", "R"),
        ("KeyT", "T"),
        ("KeyY", "Y"),
        ("KeyU", "U"),
        ("KeyI", "I"),
        ("KeyO", "O"),
        ("KeyP", "P"),
    ]:
        keys.append(key(c, lb, x, y2))
        x += W + G
    keys.append(key("BracketLeft", "[", x, y2))
    x += W + G
    keys.append(key("BracketRight", "]", x, y2))
    x += W + G
    bslash_x = x
    keys.append(key("Backslash", "\\", bslash_x, y2, core_right - bslash_x))

    y3 = y2 + H + G
    x = x0
    keys.append(key("CapsLock", "Caps", x, y3, W_CAPS))
    x += W_CAPS + G
    for c, lb in [
        ("KeyA", "A"),
        ("KeyS", "S"),
        ("KeyD", "D"),
        ("KeyF", "F"),
        ("KeyG", "G"),
        ("KeyH", "H"),
        ("KeyJ", "J"),
        ("KeyK", "K"),
        ("KeyL", "L"),
    ]:
        keys.append(key(c, lb, x, y3))
        x += W + G
    keys.append(key("Semicolon", ";", x, y3))
    x += W + G
    keys.append(key("Quote", "'", x, y3))
    x += W + G
    enter_x = x
    keys.append(key("Enter", "Enter", enter_x, y3, core_right - enter_x))

    y4 = y3 + H + G
    x = x0
    keys.append(key("ShiftLeft", "Shift", x, y4, W_SHIFT_L))
    x += W_SHIFT_L + G
    for c, lb in [
        ("KeyZ", "Z"),
        ("KeyX", "X"),
        ("KeyC", "C"),
        ("KeyV", "V"),
        ("KeyB", "B"),
        ("KeyN", "N"),
        ("KeyM", "M"),
    ]:
        keys.append(key(c, lb, x, y4))
        x += W + G
    keys.append(key("Comma", ",", x, y4))
    x += W + G
    keys.append(key("Period", ".", x, y4))
    x += W + G
    keys.append(key("Slash", "/", x, y4))
    x += W + G
    shiftr_x = x
    keys.append(key("ShiftRight", "Shift", shiftr_x, y4, core_right - shiftr_x))
    # Arrow ↑ same row as Shift，紧贴核心区右缘右侧
    nav_mid = nav_x + W_NAV + G  # center column x for 3-col nav
    up_x = nav_mid
    if up_x + W_NAV < core_right + G:
        up_x = core_right + G
    keys.append(key("ArrowUp", "↑", up_x, y4, W_NAV, H))

    y5 = y4 + H + G
    x = x0
    keys.append(key("ControlLeft", "Ctrl", x, y5, W_CTRL))
    x += W_CTRL + G
    keys.append(key("MetaLeft", "Win", x, y5, W_WIN))
    x += W_WIN + G
    keys.append(key("AltLeft", "Alt", x, y5, W_ALT))
    x += W_ALT + G
    keys.append(key("Space", "Space", x, y5, W_SPACE))
    x += W_SPACE + G
    keys.append(key("AltRight", "Alt", x, y5, W_ALT))
    x += W_ALT + G
    keys.append(key("MetaRight", "Win", x, y5, W_WIN))
    x += W_WIN + G
    keys.append(key("ContextMenu", "Menu", x, y5, 56))
    x += 56 + G
    ctrlr_x = x
    keys.append(key("ControlRight", "Ctrl", ctrlr_x, y5, core_right - ctrlr_x))

    # Arrow ←↓→ on bottom row, under Ins/Del/PgDn columns
    keys.append(key("ArrowLeft", "←", nav_x, y5, W_NAV, H))
    keys.append(key("ArrowDown", "↓", nav_mid, y5, W_NAV, H))
    keys.append(key("ArrowRight", "→", nav_x + 2 * (W_NAV + G), y5, W_NAV, H))

    # Sys column to the right of PageUp (optional; keeps clear of nav)
    sys_x = nav_x + 3 * (W_NAV + G) + 14
    keys.extend(
        [
            key("PrintScreen", "PrtSc", sys_x, y, 56, H_F),
            key("ScrollLock", "ScrLk", sys_x, y1, 56, H),
            key("Pause", "Pause", sys_x, y2, 56, H),
        ]
    )

    max_r = max(k["y"] + k["height"] for k in keys)
    max_b = max(k["x"] + k["width"] for k in keys)

    out = {
        "meta": {"author": "", "updatedAt": ""},
        "keys": keys,
        "config": {
            "keySize": W,
            "keyGap": G,
            "keyOpacity": 0.8,
            "activeColor": "#00ff00",
            "inactiveColor": "#333333",
            "textColor": "#ffffff",
            "borderColor": "#555555",
            "canvasWidth": max(1100, max_b + 28),
            "canvasHeight": max(340, max_r + 24),
        },
        "bgImage": "",
        "bgPosition": {"x": 0, "y": 0},
        "bgScale": 1.0,
        "bgKeyOpacity": 0.8,
        "bgNonKeyOpacity": 0.8,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("Wrote", OUT, "keys=", len(keys), "core_right=", core_right, "nav_x=", nav_x)


if __name__ == "__main__":
    main()
