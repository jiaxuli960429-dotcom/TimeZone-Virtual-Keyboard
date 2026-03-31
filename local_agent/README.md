# local_agent

本地常驻 Agent 骨架（M1）。

当前版本仅做：

- 连接云端 WebSocket
- 持续发送心跳
- 断线自动重连
- 捕获全局按键并上报 `press/release`

## 运行

推荐（Windows 一键测试）：

```bat
..\start-agent-test.bat
```

默认参数可放在仓库根目录 `agent-test.env`（从 `agent-test.env.example` 复制）：

```env
SERVER_WS_URL=ws://8.140.239.22/ws/realtime
CHANNEL=demo
DEVICE_ID=dev-local
```

可选自定义参数：

```bat
..\start-agent-test.bat ws://8.140.239.22/ws/realtime demo my-device
```

运行时会输出：

- 连接与握手日志
- 心跳日志（每 10 秒）
- 按键发送统计（默认每 2 秒）

手动方式：

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
set TZK_SERVER_WS_URL=ws://127.0.0.1:8000/ws/realtime
set TZK_DEVICE_ID=dev-demo
set TZK_CHANNEL=demo
python agent_main.py
```

## 下阶段

- 丰富按键映射与跨平台适配
- 增加设备绑定、模块版本与日志上报
- 接入鉴权与用户体系
