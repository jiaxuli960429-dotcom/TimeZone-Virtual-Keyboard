# 贡献指南

感谢你愿意改进 **TimeZone Virtual Keyboard**。

本仓库当前架构为 **Server + Local Agent**：

- `cloud_backend/`：云端 API 与实时服务
- `local_agent/`：本地按键采集与上报
- 前端：`index.html`、`overlay.html`、`keyboard.js`、`js/`

## 分支建议

- `feat/...`：新功能
- `fix/...`：修复
- `refactor/...`：重构
- `docs/...`：文档

## 开发前阅读

- `README.md`
- `docs/online-migration-plan.md`
- `docs/mvp-roadmap.md`
- `docs/frontend-baseline.md`
- `docs/frontend-modules.md`

## 本地联调

1. 启动云端后端：`start-cloud-backend-dev.bat`
2. 启动本地 Agent：`start-agent-test.bat`
3. 打开控制台和 overlay 页面联调

## 提交前自检

1. Python 语法检查：
   - `python -m compileall cloud_backend local_agent`
2. 前端行为检查：
   - 页面可加载
   - overlay 可显示键盘并响应按键
   - 配置保存/读取可用
3. 文档同步：
   - 行为变更需同步更新 `docs/` 对应文档
