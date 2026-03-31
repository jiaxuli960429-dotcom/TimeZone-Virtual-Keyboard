# TimeZone Virtual Keyboard

一个用于直播按键展示的在线化项目，当前主形态为：

- 云端服务（配置库 + 实时转发）
- 本地 Agent（全局按键采集）
- OBS 叠加层（公网地址订阅实时按键）

---

## 当前架构（推荐）

- `cloud_backend/`：云端 API 与 WebSocket 实时服务
- `local_agent/`：本地采集器（全局按键、心跳、自动重连）
- `index.html / overlay.html`：编辑器与 OBS 叠加页
- `scripts/server/`：服务器 Nginx 配置脚本

---

## 快速启动（开发联调）

```bash
git clone https://github.com/jiaxuli960429-dotcom/TimeZone-Virtual-Keyboard.git
cd TimeZone-Virtual-Keyboard
```

1) 启动云端后端（本地开发）：

```bat
start-cloud-backend-dev.bat
```

2) 启动本地 Agent（Windows 一键）：

```bat
start-agent-test.bat
```

3) 打开页面：

- 控制台：`http://<server>/`
- OBS：`http://<server>/overlay?channel=demo`

---

## 服务器目录结构（ECS）

推荐部署目录：

```text
/opt/launch-advisor/
├── app/
│   └── TimeZone-Virtual-Keyboard/
│       ├── cloud_backend/              # FastAPI + WS 后端
│       ├── local_agent/                # 本地 Agent 源码（可选同步）
│       └── webroot/                    # 对外静态资源根目录
│           ├── index.html
│           ├── overlay.html
│           ├── keyboard.js
│           ├── js/
│           └── configs/
├── conf/
│   └── site.env                        # SERVER_NAME=...
└── logs/
    └── backend/
        ├── app.log                     # 接口日志（按天归档）
        └── realtime.log                # 实时通道日志（按天归档）
```

常用服务文件：

- `/etc/nginx/sites-available/launch-advisor`
- `/etc/systemd/system/timezone-cloud-backend.service`
- `/usr/local/bin/la-apply-site.sh`

---

## 文档入口

| 文档 | 用途 |
|------|------|
| `docs/online-migration-plan.md` | 在线化拆分思路与里程碑 |
| `docs/mvp-roadmap.md` | 剩余功能和业务逻辑路线图 |
| `docs/frontend-baseline.md` | 前端行为基线 |
| `docs/frontend-modules.md` | 前端模块边界 |
| `cloud_backend/deploy_server.md` | ECS 部署与 systemd 常驻 |
| `local_agent/README.md` | Agent 本地运行与调试 |

---

## 未来功能（规划）

- 个人配置库（持久化、版本管理）
- 创意工坊（发布、Fork、热门）
- B 站 OAuth 登录（接口预留，待域名与平台配置）

---

## 许可证

本项目以 **MIT** 许可发布，详见 [LICENSE](./LICENSE)。
