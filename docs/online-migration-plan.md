# 在线化改造计划（Server + Local Agent）

## 目标

- 将当前本地项目拆分为：
  - 云端服务（配置存储、鉴权、实时转发、社区能力）
  - 本地 Agent（全局按键捕获、设备绑定、模块管理）
- OBS 浏览器源使用公网地址，不再依赖 `localhost`。

## 分层架构

- `cloud_backend/`
  - REST API（用户、配置、发布）
  - Realtime 通道（WebSocket）
  - 持久化（后续接 PostgreSQL/Redis）
- `local_agent/`
  - 常驻壳程序（Agent Core）
  - 键盘捕获 Worker（复用现有 `pynput` 逻辑）
  - 与云端建立安全连接并上报按键事件
- `index.html/overlay.html`
  - 前端编辑器与 OBS 叠加层
  - 通过 `/api` 与 `/realtime` 对接云端

## 里程碑

1. `M1` 云端最小可运行
   - 提供 `/healthz`、`/api/configs`、`/ws/realtime`
   - 支持内存态配置（便于先跑通链路）
2. `M2` Agent 最小可运行
   - 设备标识 + 心跳
   - 本地键盘事件上报到云端
3. `M3` 前端切换云端接口
   - 编辑页配置读写走云端 API
   - OBS 页订阅云端实时按键
4. `M4` 账号与社区
   - OAuth 登录（目标 B 站）
   - 配置发布、Fork、点赞等

## 当前分支已做

- 新增云端骨架目录：`cloud_backend/`
- 新增本地 Agent 骨架目录：`local_agent/`
- 预置最小可运行入口（便于快速联调）
