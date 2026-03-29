# TimeZone Virtual Keyboard

一个专为游戏直播设计的虚拟键盘显示工具，特别适合 DOTA 游戏玩家在直播时展示按键操作。

由于哥们一点前端后端都不会写，所以本仓库完全由AI开发管理（我偶尔代为add-commit-push一下）。

---

## 你想做什么？

### 我是主播，只想用起来

**不想装 Python：** 到本仓库 **[GitHub Releases](https://github.com/jiaxuli960429-dotcom/TimeZone-Virtual-Keyboard/releases)** 下载 **`TimeZoneKeyboard.exe`**，放到任意文件夹后**双击运行**即可（无需 Python；首次启动可能略慢，属正常现象）。使用说明仍以仓库里的 **[使用说明.md](./使用说明.md)** 为准。

**从源码运行：** 克隆仓库后需要本机已安装 Python，再双击根目录 **`start-keyboard.bat`** 或执行 `python key_server.py`。

详细步骤请看 **[使用说明.md](./使用说明.md)**；纯文本速查：**[USER_GUIDE.txt](./USER_GUIDE.txt)**。

（Release 包由维护者在推送版本标签 `v*` 时自动构建上传，见 **`CONTRIBUTING.md`**。）

### 我想参与开发或提交改动

请先阅读：

| 文档 | 内容 |
|------|------|
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | 分支与提交规范、前后端约定、合并前自检 |
| **[LICENSE](./LICENSE)** | MIT 许可证全文 |
| **[docs/README.md](./docs/README.md)** | 开发文档索引（行为基线、模块边界） |

---

## 功能概览

- 实时高亮按键；支持 **WebSocket 全局按键捕获**（游戏在前台时浏览器仍能收到按键）。
- **控制台**（`http://localhost:8080`）编辑布局；**OBS** 使用 **`/overlay?config=方案名`** 仅显示键盘层。
- 画布尺寸可在预览顶栏调节（逻辑尺寸与 OBS 建议一致）；方案带 `meta`（作者、更新时间等），列表接口由 `key_server.py` 提供。
- 默认布局可由 **`scripts/generate_default_layout.py`** 重新生成并写入 `configs/default.json`。

---

## 快速启动（开发者自测）

```bash
git clone https://github.com/jiaxuli960429-dotcom/TimeZone-Virtual-Keyboard.git
cd TimeZone-Virtual-Keyboard
```

Windows：双击 **`start-keyboard.bat`**，或：

```bash
python key_server.py
```

浏览器打开 **`http://localhost:8080`**（勿长期依赖 `file://` 打开 `index.html`，否则配置 API 与保存不可用）。

### 维护者：发布 Windows `.exe` 的 Release

1. 确保默认分支上代码已就绪。
2. 创建并推送版本标签（示例）：

   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

3. GitHub Actions 会执行 **`.github/workflows/release-windows.yml`**，构建 **`TimeZoneKeyboard.exe`** 并挂到对应 Release。

本地试打包：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_windows_release.ps1
```

产物：**`dist\TimeZoneKeyboard.exe`**（已列入 `.gitignore`，勿提交）。

---

## 仓库结构（节选）

```
├── index.html / overlay.html   # 控制台与叠加层入口
├── keyboard.js                 # 前端编排
├── js/                         # 渲染、配置、网络、交互等模块
├── key_server.py               # WebSocket + HTTP（静态资源 + /api/config*）
├── configs/                    # 方案 JSON（default 为内置默认布局）
├── .github/workflows/          # Release 自动构建 Windows .exe
├── scripts/                    # generate_default_layout.py、build_windows_release.ps1
├── 使用说明.md                  # 面向主播的详细步骤
├── USER_GUIDE.txt              # 使用说明（纯文本）
├── CONTRIBUTING.md
├── LICENSE
└── docs/                       # 前端基线与模块说明
```

---

## 许可证

本项目以 **MIT** 许可发布，详见 [LICENSE](./LICENSE)。

---

## 作者与反馈

- **B 站**：[无知小冒](https://space.bilibili.com/10158668)（uid：10158668）  
- **GitHub**：[jiaxuli960429-dotcom](https://github.com/jiaxuli960429-dotcom)  
- 问题与建议：请使用仓库 **Issues**（主播使用问题请尽量说明是否已用 `http://localhost:8080` 与 OBS 里完整 overlay 地址）。
