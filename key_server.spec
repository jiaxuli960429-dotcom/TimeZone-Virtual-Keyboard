# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec: single Windows .exe (onefile, no Python on target PC)."""

from PyInstaller.utils.hooks import collect_all, collect_submodules

block_cipher = None

pynput_datas, pynput_binaries, pynput_hidden = collect_all("pynput")

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
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="TimeZoneKeyboard",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
