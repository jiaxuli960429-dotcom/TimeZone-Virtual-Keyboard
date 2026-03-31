# MVP 路线图（Server + Local Agent）

## 产品目标

- 主播使用本地 Agent 采集全局按键。
- 叠加层和编辑器通过公网地址访问云端服务。
- 用户拥有个人配置库，并可发布到创意工坊。
- 登录体系先预留 B 站 OAuth 接口，待域名与平台配置完成后接入。

## 当前状态（已完成）

- 云端后端骨架：`cloud_backend/`
  - `/api/configs*` 与 `/ws/realtime` 已可用
  - 基础日志已启用（按文件、按天轮转）
- 本地 Agent 骨架：`local_agent/`
  - 全局按键捕获 + 实时上报
  - 一键测试脚本：`start-agent-test.bat`
- 前端联网化
  - 不再依赖本地 `localhost`
  - Overlay 可按 `channel` 订阅

## P0：可稳定使用（建议优先）

1. 最小鉴权（token）
   - WebSocket 与配置 API 都要求 token
   - 防止公开频道被恶意串流
2. 配置持久化
   - 从内存迁移到 SQLite（后续再切 PostgreSQL）
   - 支持个人配置 CRUD
3. 频道与设备绑定
   - 避免所有人使用 `demo` 频道
   - 每个用户/设备独立频道

## P1：个人配置库

- 数据模型
  - `users`
  - `configs`（owner、title、content、visibility、fork_from）
  - `config_versions`
- API
  - `POST /api/v1/configs`
  - `GET /api/v1/my/configs`
  - `GET /api/v1/configs/{id}`
  - `PUT /api/v1/configs/{id}`
  - `DELETE /api/v1/configs/{id}`

## P2：创意工坊

- 发布/下架
- 公共列表（最新/热门）
- 详情页与 Fork
- 点赞/收藏（可后置）

## P3：B 站登录

- 预留接口：
  - `GET /auth/bilibili/start`
  - `GET /auth/bilibili/callback`
  - `GET /auth/me`
  - `POST /auth/logout`
- 接入前置条件：
  - 真实域名
  - HTTPS
  - B 站开放平台应用（client_id/client_secret）

## 验收闭环

1. 用户登录
2. 编辑并保存个人配置
3. 发布到创意工坊
4. Agent 绑定并上报按键
5. OBS 通过公网 overlay 实时显示
