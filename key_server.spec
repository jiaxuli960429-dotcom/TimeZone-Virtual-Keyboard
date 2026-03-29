# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec: Windows folder build (no Python on end-user PC)."""

from PyInstaller.utils.hooks import collect_all, collect_submodules

block_cipher = None

pynput_datas, pynput_binaries, pynput_hidden = collect_all("pynput")

# websockets hook pulls all submodules (incl. optional router → werkzeug); we only use serve().
hiddenimports = list(
    dict.fromkeys(list(collect_submodules("pynput")) + pynput_hidden)
)

a = Analysis(
    ["key_server.py"],
    pathex=[],
    binaries=pynput_binaries,
    datas=[
        ("index.html", "."),
        ("overlay.html", "."),
        ("keyboard.js", "."),
        ("js", "js"),
        ("configs/default.json", "configs"),
        *pynput_datas,
    ],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["werkzeug", "markupsafe"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="TimeZoneKeyboard",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="TimeZoneKeyboard",
)
