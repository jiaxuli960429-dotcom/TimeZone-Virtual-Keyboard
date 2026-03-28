# 前端模块说明

本文档描述当前前端模块划分与职责边界，便于后续维护和继续拆分。

## 入口与编排

- `keyboard.js`
  - 维护共享运行时状态。
  - 负责 DOM 事件接线与模块调用编排。
  - 保留 `index.html` 依赖的兼容函数名。

## 核心数据与渲染

- `js/keyboard_pure_utils.js`
  - 纯函数工具：按键/配置的清洗、序列化与反序列化。
- `js/keyboard_render_module.js`
  - 画布渲染与吸附辅助线绘制。

## 配置与网络

- `js/keyboard_config_module.js`
  - 内置配置、本地缓存配置、导入导出与应用逻辑。
- `js/keyboard_network_module.js`
  - WebSocket 连接管理与配置 API 请求。

## 吸附能力

- `js/keyboard_snap_module.js`
  - 拖拽/缩放过程中的吸附计算。
- `js/keyboard_snap_controls_module.js`
  - 吸附开关、阈值与界面状态同步。

## 面板与按键列表

- `js/keyboard_panel_module.js`
  - 控制面板显示逻辑与全局背景控制。
- `js/keyboard_key_list_module.js`
  - 按键新增、删除、选中与侧栏渲染。

## 编辑弹窗相关

- `js/keyboard_key_edit_module.js`
  - 编辑弹窗打开/关闭/保存/取消及弹窗拖拽。
  - 行为约束：只有“保存”提交修改，其余关闭路径一律视为取消。
- `js/keyboard_key_bg_module.js`
  - 单键背景图与相关编辑项。
- `js/keyboard_color_picker_module.js`
  - 颜色选择器流程、预览与历史色管理。

## 输入与鼠标交互

- `js/keyboard_input_module.js`
  - 键盘输入处理与快捷键逻辑。
- `js/keyboard_mouse_helpers_module.js`
  - 鼠标命中检测与光标状态辅助函数。
- `js/keyboard_mouse_down_module.js`
  - `mousedown` 交互入口。
- `js/keyboard_mouse_move_module.js`
  - `mousemove` 交互流程。

## 关键行为约束（务必保持）

- 编辑弹窗打开期间，被编辑按键高亮必须持续可见。
- 未点击“保存”就关闭编辑弹窗，必须丢弃本次修改。
