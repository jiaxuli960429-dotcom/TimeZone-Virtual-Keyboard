#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DOTA 键盘按键捕获服务
功能：在后台捕获全局键盘事件，通过 WebSocket 发送给浏览器
解决浏览器失去焦点时无法捕获按键的问题
"""

import asyncio
import json
import sys
import os
import subprocess
import threading
from queue import Queue

# 先尝试杀掉占用端口的进程
def kill_process_using_port(port):
    try:
        result = subprocess.check_output(
            ['netstat', '-ano', '|', 'findstr', f':{port}'],
            shell=True,
            encoding='gbk',
            errors='ignore'
        )
        for line in result.split('\n'):
            if f':{port}' in line and 'LISTENING' in line:
                parts = line.strip().split()
                if len(parts) >= 5:
                    pid = parts[-1]
                    try:
                        subprocess.call(['taskkill', '/F', '/PID', pid])
                    except:
                        pass
    except:
        pass

# 检查并安装依赖
def check_dependencies():
    try:
        import pynput
        import websockets
    except ImportError:
        print("正在安装必要的依赖...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pynput", "websockets", "-i", "https://pypi.tuna.tsinghua.edu.cn/simple"])
        print("依赖安装完成！")
        os.execv(sys.executable, [sys.executable] + sys.argv)

check_dependencies()

from pynput import keyboard
import websockets.server

# 消息队列
key_event_queue = Queue()

# WebSocket 连接集合
connected_clients = set()
clients_lock = threading.Lock()

# 按键代码映射（将 pynput 按键转换为浏览器标准的 code）
def get_key_code(key):
    """将 pynput 按键对象转换为浏览器标准的 code"""
    key_map = {
        # 字母键
        'a': 'KeyA', 'b': 'KeyB', 'c': 'KeyC', 'd': 'KeyD',
        'e': 'KeyE', 'f': 'KeyF', 'g': 'KeyG', 'h': 'KeyH',
        'i': 'KeyI', 'j': 'KeyJ', 'k': 'KeyK', 'l': 'KeyL',
        'm': 'KeyM', 'n': 'KeyN', 'o': 'KeyO', 'p': 'KeyP',
        'q': 'KeyQ', 'r': 'KeyR', 's': 'KeyS', 't': 'KeyT',
        'u': 'KeyU', 'v': 'KeyV', 'w': 'KeyW', 'x': 'KeyX',
        'y': 'KeyY', 'z': 'KeyZ',
        # 数字键
        '0': 'Digit0', '1': 'Digit1', '2': 'Digit2', '3': 'Digit3',
        '4': 'Digit4', '5': 'Digit5', '6': 'Digit6', '7': 'Digit7',
        '8': 'Digit8', '9': 'Digit9',
        # 功能键
        'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4',
        'f5': 'F5', 'f6': 'F6', 'f7': 'F7', 'f8': 'F8',
        'f9': 'F9', 'f10': 'F10', 'f11': 'F11', 'f12': 'F12',
        # 方向键
        'up': 'ArrowUp', 'down': 'ArrowDown',
        'left': 'ArrowLeft', 'right': 'ArrowRight',
        # 控制键
        'space': 'Space',
        'enter': 'Enter',
        'tab': 'Tab',
        'backspace': 'Backspace',
        'delete': 'Delete',
        'escape': 'Escape',
        'home': 'Home', 'end': 'End',
        'pageup': 'PageUp', 'pagedown': 'PageDown',
        'insert': 'Insert',
        # 符号键
        '.': 'Period',
        ',': 'Comma',
        '/': 'Slash',
        ';': 'Semicolon',
        "'": 'Quote',
        '[': 'BracketLeft',
        ']': 'BracketRight',
        '-': 'Minus',
        '=': 'Equal',
        '`': 'Backquote',
        '\\': 'Backslash',
    }

    try:
        # 尝试获取字符键
        char = key.char.lower()
        if char in key_map:
            return key_map[char]
    except (AttributeError, TypeError):
        pass

    # 特殊键
    try:
        name = key.name.lower()
        if name in key_map:
            return key_map[name]
    except AttributeError:
        pass

    # 修饰键
    if isinstance(key, keyboard.Key):
        key_str = str(key)
        
        # 同时处理多种可能的修饰键格式
        if key == keyboard.Key.ctrl_l or key_str == 'Key.ctrl_l':
            return 'ControlLeft'
        if key == keyboard.Key.ctrl_r or key_str == 'Key.ctrl_r':
            return 'ControlRight'
        if key == keyboard.Key.shift_l or key_str == 'Key.shift_l':
            return 'ShiftLeft'
        if key == keyboard.Key.shift_r or key_str == 'Key.shift_r':
            return 'ShiftRight'
        if key == keyboard.Key.shift or key_str == 'Key.shift':
            return 'ShiftLeft'
        if key == keyboard.Key.alt_l or key_str == 'Key.alt_l':
            return 'AltLeft'
        if key == keyboard.Key.alt_r or key_str == 'Key.alt_r':
            return 'AltRight'
        if key == keyboard.Key.alt or key_str == 'Key.alt':
            return 'AltLeft'
        if key == keyboard.Key.alt_gr or key_str == 'Key.alt_gr':
            return 'AltRight'
        if key == keyboard.Key.cmd_l or key_str == 'Key.cmd_l':
            return 'MetaLeft'
        if key == keyboard.Key.cmd_r or key_str == 'Key.cmd_r':
            return 'MetaRight'
        if key == keyboard.Key.caps_lock or key_str == 'Key.caps_lock':
            return 'CapsLock'
        if key == keyboard.Key.esc or key_str == 'Key.esc':
            return 'Escape'
        
        # 备用方法
        key_name = key_str.replace('Key.', '').lower()
        modifier_map = {
            'shift': 'ShiftLeft',
            'shift_l': 'ShiftLeft',
            'shift_r': 'ShiftRight',
            'ctrl': 'ControlLeft',
            'ctrl_l': 'ControlLeft',
            'ctrl_r': 'ControlRight',
            'alt': 'AltLeft',
            'alt_l': 'AltLeft',
            'alt_r': 'AltRight',
            'alt_gr': 'AltRight',
            'cmd': 'MetaLeft',
            'cmd_l': 'MetaLeft',
            'cmd_r': 'MetaRight',
            'caps_lock': 'CapsLock',
            'esc': 'Escape',
        }
        if key_name in modifier_map:
            return modifier_map[key_name]

    # 如果无法识别，返回字符串表示
    return str(key)


def on_press(key):
    """按键按下回调"""
    code = get_key_code(key)
    key_event_queue.put(('press', code))


def on_release(key):
    """按键释放回调"""
    code = get_key_code(key)
    key_event_queue.put(('release', code))


async def broadcast_to_clients(message):
    """向所有连接的客户端广播消息"""
    with clients_lock:
        disconnected = set()
        for client in list(connected_clients):
            try:
                await client.send(message)
            except:
                disconnected.add(client)
        
        # 移除断开的连接
        connected_clients.difference_update(disconnected)


async def handle_client(websocket):
    """处理 WebSocket 客户端连接"""
    print(f"客户端已连接: {websocket.remote_address}")

    with clients_lock:
        connected_clients.add(websocket)

    try:
        async for message in websocket:
            # 处理客户端消息（如果需要）
            try:
                data = json.loads(message)
                if data.get('type') == 'ping':
                    await websocket.send(json.dumps({'type': 'pong'}))
            except:
                pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        with clients_lock:
            connected_clients.discard(websocket)
        print(f"客户端已断开: {websocket.remote_address}")


async def process_key_events():
    """处理按键事件队列"""
    while True:
        try:
            # 非阻塞获取队列中的事件
            try:
                event_type, code = key_event_queue.get_nowait()
                message = json.dumps({
                    'type': 'key',
                    'code': code,
                    'pressed': event_type == 'press'
                })
                await broadcast_to_clients(message)
            except:
                pass  # 队列为空
            
            await asyncio.sleep(0.01)  # 短暂休眠，避免 CPU 占用过高
        except:
            pass


async def start_server():
    """启动 WebSocket 服务器"""
    print("=" * 50)
    print("    DOTA Keyboard Capture Service")
    print("=" * 50)
    print()
    print("功能：捕获全局键盘事件，通过 WebSocket 发送给浏览器")
    print("解决：浏览器失去焦点时无法捕获按键")
    print()
    print("WebSocket 地址: ws://localhost:8765")
    print()
    print("按 Ctrl+C 停止服务")
    print("=" * 50)
    print()

    # 启动按键事件处理任务
    asyncio.create_task(process_key_events())

    # 使用兼容的方式启动服务器
    server = await websockets.serve(
        handle_client,
        "localhost",
        8765,
        ping_interval=20,
        ping_timeout=10
    )

    await server.wait_closed()


def start_keyboard_listener():
    """启动键盘监听"""
    with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
        listener.join()


if __name__ == "__main__":
    # 先杀掉占用端口的进程
    kill_process_using_port(8765)

    # 等待一小会儿
    import time
    time.sleep(0.5)

    # 在后台线程启动键盘监听
    keyboard_thread = threading.Thread(target=start_keyboard_listener, daemon=True)
    keyboard_thread.start()

    try:
        # 启动 WebSocket 服务器
        asyncio.run(start_server())
    except KeyboardInterrupt:
        print("\n服务已停止")
        sys.exit(0)
    except Exception as e:
        print(f"错误: {e}")
        input("按 Enter 退出")
