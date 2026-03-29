# 贡献指南

感谢你愿意改进 **TimeZone Virtual Keyboard**。本文面向**提交代码、改文档、提 PR** 的贡献者；直播使用步骤请看 **[使用说明.md](./使用说明.md)**。

---

## 1. 开始之前

- 在 **Issue** 里先描述问题或方案，避免大改与维护者预期不一致（小修复可直接 PR）。
- 一个 PR 尽量只做一类事：`feat` / `fix` / `docs` / `refactor` 分开更易审。

---

## 2. 分支与提交信息

- 建议分支名可读：`fix/obs-url-doc`、`feat/config-meta`。
- 提交信息推荐前缀：
  - `feat:` 新功能
  - `fix:` 缺陷修复
  - `docs:` 仅文档
  - `refactor:` 重构（行为不变）
  - `chore:` 构建、脚本、无关紧要的清理

示例：`fix: 切换方案后脏状态误报`、`docs: 更新使用说明与 OBS 地址说明`。

---

## 3. 代码与文案约定

- **用户可见文案**（页面、弹窗、`key_server.py` 里面向用户的 log）：优先 **简体中文**，与现有语气一致。
- **代码内注释 / 与外部库对接的标识**：可用英文，说明「为什么」比「做了什么」更重要。
- 命名需可读；避免无意义缩写与 `tmp`、`a` 等。
- 异常处理要具体，避免空 `except` 吞掉关键错误。

---

## 4. 前端（`index.html`、`keyboard.js`、`js/*`）

- 新增或修改 DOM 时，保持 **`id` / `data-click` / 模块回调** 一致，避免半套接在 `keyboard.js`、半套散落在内联脚本。
- 考虑 **叠加层** `overlay.html`：`IS_OVERLAY_MODE` 下勿依赖仅控制台存在的节点。
- OBS 相关：叠加层地址为 **`/overlay?config=…`**，文档与 UI 文案勿误导为首页 URL。
- 布局与默认键位：大改 `configs/default.json` 时，优先改 **`scripts/generate_default_layout.py`** 后重新生成，便于复现。
- 深入结构前请阅读：
  - [docs/frontend-baseline.md](./docs/frontend-baseline.md)
  - [docs/frontend-modules.md](./docs/frontend-modules.md)

---

## 5. 后端（`key_server.py`）

- **Windows** 是主要使用场景；非 Windows 路径尽量保持可运行或明确失败提示。
- HTTP 路由变更需同步前端 `fetch` 路径；当前常见接口：
  - `GET /api/configs` — 返回 `names` 与 `items`（方案摘要）
  - `GET/POST/DELETE /api/config` — 读写删除 `configs/<name>.json`
- 修改后至少执行：

  ```bash
  python -m py_compile key_server.py
  ```

- 若改 WebSocket 消息 JSON 形状，必须同步 **`js/keyboard_network_module.js`**（及消费处）。
- **Windows 免 Python 发行包**：由 **`scripts/build_windows_release.ps1`** + **`key_server.spec`** 生成；推送到远程的标签 **`v*`**（如 `v1.0.0`）会触发 **`.github/workflows/release-windows.yml`**，向 **GitHub Release** 上传 **`TimeZoneKeyboard-Windows.zip`**。若改动影响 `key_server.py` 或静态资源，发版前应本地执行该脚本自检。

---

## 6. 配置 JSON 约定（与前端一致）

- 持久化对象由 **`js/keyboard_pure_utils.js`** 的 `buildCurrentConfigObject` / `cleanKeyForSave` 等约束字段。
- 已弃用顶层 **`version`**；本地缓存合法性由 **`keys` 数组存在** 等规则判断（见 `keyboard_config_module.js`）。
- 可选 **`meta`**：`author`、`updatedAt`（保存时刷新）；脏状态指纹会忽略 `meta`，避免仅元数据变更误报未保存。
- 载入方案时会对 **`CONFIG` 先重置再合并**，避免切换方案残留字段。

---

## 7. 合并前自检清单

1. `python -m py_compile key_server.py`
2. 用 **`http://localhost:8080`** 打开控制台：按键高亮、保存/加载/切换方案、OBS 区链接与「保存并复制」。
3. 打开 **`/overlay?config=default`**：叠加层能加载、无明显控制台报错。
4. 若动到编辑弹窗：仅「保存」提交，其它关闭方式应取消（见 baseline 文档）。
5. 若改动涉及打包相关文件（`key_server.py` 冻结路径、`key_server.spec`、静态入口页等），发版前在 Windows 上跑通 **`scripts/build_windows_release.ps1`**。

---

## 8. PR 描述建议写清

- **动机**：解决什么问题或满足什么场景。
- **改动摘要**：用户能感知的行为 + 技术要点（接口/数据结构）。
- **风险与兼容**：是否破坏旧 JSON、旧 bat 流程。
- **测试**：命令行步骤 + 浏览器/OBS 手工步骤。

---

再次感谢你的时间与贡献。
