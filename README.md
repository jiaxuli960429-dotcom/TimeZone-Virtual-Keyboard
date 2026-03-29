# TimeZone Virtual Keyboard

一个专为游戏直播设计的虚拟键盘显示工具，特别适合 DOTA 游戏玩家在直播时展示按键操作。

由于哥们一点前端后端都不会写，所以本仓库完全由AI开发管理（我偶尔代为add-commit-push一下）。

## 🎯 项目特点

### 核心功能
- **实时按键状态显示**：实时显示键盘按键的按下/松开状态
- **高度自定义**：
  - 按键大小、位置、标签完全可调整
  - 支持自定义按键颜色（按下/未按下状态）
  - 独立的按键透明度和背景图片透明度控制
  - 按键独立背景图片支持（可拖拽、缩放、调整透明度）
- **智能辅助**：
  - 按键对齐吸附功能，支持边缘和中心吸附
  - 辅助排列功能，保持按键间距一致
- **背景管理**：
  - 全局背景图片支持（分层透明度效果）
  - 按键独立背景图片支持（简单模式和高级模式）
- **配置系统**：
  - 配置保存和加载功能
  - DOTA 常用按键预设
- **用户友好**：
  - 直观的编辑界面
  - 支持拖拽调整按键位置和大小
  - 滚轮调整背景缩放
  - 快捷键 F2 显示/隐藏控制面板

### 技术特点
- 使用 HTML5 Canvas 实现高效渲染
- 响应式设计，支持不同屏幕尺寸
- 模块化代码结构，易于维护和扩展
- 支持 WebSocket 远程按键捕获，减少系统资源占用
- 配置文件自动备份和恢复

## 🚀 快速开始

### 安装与启动
1. 克隆本仓库：
   ```bash
   git clone https://github.com/jiaxuli960429-dotcom/TimeZone-Virtual-Keyboard.git
   ```

2. 进入项目目录：
   ```bash
   cd TimeZone-Virtual-Keyboard
   ```

3. 启动应用（推荐）：
   - 双击 `start-keyboard.bat` 文件
4. 浏览器打开：`http://localhost:8080`

### 一分钟上手
- 按 `F2` 显示/隐藏设置面板。
- 点“添加按键”后按任意键即可加入布局。
- 画布上双击按键打开编辑弹窗；拖拽可移动，拖边缘可缩放。
- 配置建议通过“保存到项目”写入 `configs/*.json`，再通过下拉框加载/删除。
- 若需完整操作手册，请看 `USER_GUIDE.txt`。

## 🛠 技术栈
- **前端**：HTML5, CSS3, JavaScript
- **渲染**：HTML5 Canvas
- **后端**：Python（WebSocket 按键服务 + 本地 HTTP 静态页与配置 API）
- **工具**：Git

## 📁 项目结构
```
TimeZone-Virtual-Keyboard/
├── index.html          # 主页面
├── keyboard.js         # 前端入口与状态编排
├── js/                 # 前端模块目录（渲染、配置、网络、交互等）
├── key_server.py       # WebSocket + 本地 HTTP（页面与 configs API）
├── configs/            # 配置目录：default.json 为内置默认布局（入库）；其余 *.json 为用户保存（默认忽略）
├── docs/               # 开发文档（行为基线、模块说明、文档导航）
├── start-keyboard.bat  # 启动脚本
├── USER_GUIDE.txt      # 使用说明（中文）
├── LICENSE             # MIT 许可证全文
├── .gitignore          # Git 忽略文件
└── README.md           # 项目说明
```

## 📚 文档体系
- `README.md`：项目概览 + 快速启动（入口文档）
- `USER_GUIDE.txt`：面向使用者的详细操作手册（OBS、常见问题）
- `CONTRIBUTING.md`：贡献与提交流程规范
- `docs/README.md`：开发文档导航
- `docs/frontend-baseline.md`：前端行为基线与回归清单
- `docs/frontend-modules.md`：前端模块职责边界

## 🤖 项目开发说明

**重要声明**：本项目完全由 AI 开发，包括：
- 核心功能实现
- 用户界面设计
- 代码结构优化
- 功能测试和调试

所有代码均通过 AI 生成和优化，确保了代码质量和功能完整性。


## 📐 开发与仓库规范
- 贡献规范请查看 `CONTRIBUTING.md`
- 文档导航请查看 `docs/README.md`
- 推荐使用语义化提交信息：`feat/fix/refactor/docs`
- 统一编码与缩进规则请查看 `.editorconfig`
- 本地修改后建议先做最小检查：
  - `python -m py_compile key_server.py`
  - 浏览器手工验证按键显示和配置保存/加载

## 📄 许可证

本项目采用 MIT 许可证，详见 LICENSE 文件。

## 👨‍💻 作者

**无知小冒**

- GitHub: [https://github.com/jiaxuli960429-dotcom](https://github.com/jiaxuli960429-dotcom)

## 📞 联系方式

如有问题或建议，欢迎通过 GitHub Issues 提交。

---

**TimeZone Virtual Keyboard** - 为游戏直播而生的虚拟键盘显示工具
