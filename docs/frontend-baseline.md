# 前端行为基线

本文档用于记录前端当前“约定行为”，作为持续重构时的对照标准。  
目标：在提升可读性与可维护性的同时，确保用户可见行为不变。

## 启动流程

1. `DOMContentLoaded` 后初始化画布与事件监听。
2. 尝试加载内置配置 `configs/default.json`。
3. 读取浏览器缓存配置（`localStorage`），要求 JSON 含 `keys` 数组（旧版仅 `version` 的缓存会被丢弃）。
4. 刷新按键列表并触发首帧渲染。
5. 建立 WebSocket 连接（`ws://localhost:8765`）。
6. 刷新项目内配置下拉列表（`/api/configs`）。

## 核心运行行为

- 按键高亮来源：
  - WebSocket 消息（`{ type: "key", code, pressed }`）
  - 本地 `keydown/keyup` 兜底逻辑。
- 画布刷新采用 `requestAnimationFrame` 合帧（避免重复重绘）。
- 按键支持拖拽、缩放、吸附、撤销/重做。
- 双击按键可打开编辑弹窗。
- `Delete` 删除当前选中按键。

## 配置行为

- 导出/保存配置结构（持久化层）：
  - `keys`、`config`、`bgImage`、`bgPosition`、`bgScale`、`bgKeyOpacity`、`bgNonKeyOpacity`
  - 可选 `meta`：`author`、`updatedAt`（保存时刷新 `updatedAt`；脏状态指纹忽略 `meta`）
- 不再写入顶层 `version`。
- 载入方案时先重置 `CONFIG` 再合并文件内 `config`，避免切换方案残留字段。
- 内置默认配置路径：`configs/default.json`
- 浏览器缓存 key：`dotaKeyboardConfig`

## 接口行为

- `GET /api/configs`：返回 `names` 与 `items`（每项含 `name`、`keyCount`、`author`、`updatedAt`、`fileModified` 等摘要）。
- `POST /api/config/save`：保存到 `configs/<name>.json`。
- `GET /api/config?name=...`：读取指定配置。
- `DELETE /api/config?name=...`：删除指定配置。

## 手工回归清单

- 页面可正常打开，键盘可正常渲染。
- 按键高亮正常（含组合键，如 `Ctrl + 字母`）。
- 按键新增 / 编辑 / 删除正常。
- 拖拽 / 缩放 / 吸附行为正常。
- 撤销 / 重做正常。
- 配置保存 / 加载 / 导入 / 导出正常。
- 全局背景与单键背景编辑正常。
- 编辑弹窗打开期间，被编辑按键高亮始终可见。
- 编辑弹窗只有点击“保存”才提交；其他关闭方式均取消修改。
