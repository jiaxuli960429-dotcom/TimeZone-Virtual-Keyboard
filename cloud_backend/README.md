# cloud_backend

云端后端骨架（M1）。

## 运行

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 已有接口（M1/M2）

- `GET /healthz`
- `GET /api/configs`
- `POST /api/configs/{name}`
- `GET /api/configs/{name}`
- `DELETE /api/configs/{name}`
- `WS /ws/realtime`

兼容旧前端接口：

- `POST /api/config/save`
- `GET /api/config?name=...`
- `DELETE /api/config?name=...`

## v1 账号与配置库接口（进行中）

- 认证：
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/me`
  - `POST /api/v1/auth/logout`
- 个人配置库：
  - `GET /api/v1/my/configs`
  - `POST /api/v1/configs`
  - `GET /api/v1/configs/{id}`
  - `PUT /api/v1/configs/{id}`
  - `DELETE /api/v1/configs/{id}`
  - `POST /api/v1/configs/{id}/publish`
- 创意工坊：
  - `GET /api/v1/workshop/configs`
  - `POST /api/v1/configs/{id}/fork`
  - `POST /api/v1/configs/{id}/like`
  - `DELETE /api/v1/configs/{id}/like`

## Realtime 握手协议（当前版本）

客户端连接后第一条消息必须发送：

```json
{"type":"hello","role":"agent","channel":"demo","deviceId":"pc-01"}
```

或：

```json
{"type":"hello","role":"overlay","channel":"demo"}
```

- `agent`：可上报 `{"type":"key","code":"KeyA","pressed":true}`
- `overlay`：仅接收同 `channel` 的按键事件
- 双方均可发送 `{"type":"ping"}`，服务端返回 `{"type":"pong"}`

## 后续（M2+）

- 接入数据库（PostgreSQL）
- 用户体系与 token 鉴权
- Realtime 房间隔离（按 user/device/session）

## 部署

- 参考：`deploy_server.md`
- `systemd` 服务模板：`systemd/timezone-cloud-backend.service`
