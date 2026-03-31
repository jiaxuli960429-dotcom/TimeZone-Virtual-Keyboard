/**
 * TimeZoneKeyboard — 虚拟键盘叠加层
 * 用于浏览器或 OBS 直播时显示按键状态
 */

// ==================== 配置 ====================
const CONFIG = {
    keySize: 50,
    keyGap: 5,
    keyOpacity: 0.8,
    keyOpacityPressed: 0.8,
    keyOpacityPressedUseUnpressed: true,
    activeColor: '#00ff00',
    activeColorUseInactive: false,
    inactiveColor: '#333333',
    textColor: '#ffffff',
    textColorPressed: '#ffffff',
    textColorPressedUseUnpressed: true,
    /** 字母不透明度 0–1，独立于按键本体透明度 */
    textOpacity: 1,
    textOpacityPressed: 1,
    textOpacityPressedUseUnpressed: true,
    borderColor: '#555555',
    borderColorPressed: '#555555',
    borderColorPressedUseUnpressed: true,
    /** 边框不透明度 0–1，独立于按键本体透明度 */
    borderOpacity: 1,
    borderOpacityPressed: 1,
    borderOpacityPressedUseUnpressed: true,
    canvasWidth: 1200,
    canvasHeight: 400
};

/** 载入方案时先重置再合并，避免上一方案的 config 字段残留在内存里导致误报「未保存」。 */
const DEFAULT_CONFIG_TEMPLATE = Object.freeze({ ...CONFIG });

// ==================== 状态 ====================
let keys = []; // 按键列表
let pressedKeys = new Set(); // 当前按下的按键
/** 控制台预览：live=真实按键；all_pressed / all_unpressed=静态样式（调色板等 _previewPressed 仍优先生效） */
let previewKeyStateMode = 'live';
let isAddingKey = false; // 是否正在添加按键
let draggedKey = null; // 正在拖拽的按键
let dragOffset = { x: 0, y: 0 };
let canvas, ctx;
/** Coalesced requestAnimationFrame id for canvas redraws (idle = no rAF loop). */
let canvasRafId = null;
/** Single scheduled WebSocket reconnect to avoid stacked timers on rapid disconnects. */
let wsReconnectTimerId = null;
/** Fade-out timer for the connection status chip; cleared before rescheduling. */
let wsStatusFadeTimerId = null;

let editingKey = null; // 当前正在编辑的按键
let editingKeyBackup = null; // 编辑前的按键备份，用于取消操作
let keyEditShouldCommit = false; // 编辑菜单关闭时是否提交（仅保存按钮置为 true）
/** 画布上单击选中的按键（Delete 删除）；与拖动分离：超过阈值才进入拖动 */
let selectedKey = null;
let dragCandidateKey = null;
let dragCandidateFrom = { x: 0, y: 0 };
const CLICK_DRAG_THRESHOLD_PX = 5;

// ==================== 背景图片状态 ====================
let bgImage = null; // 背景图片
let bgPosition = { x: 0, y: 0 }; // 背景图片位置
let bgScale = 1.0; // 背景图片缩放
let bgKeyOpacity = 0.8; // 按键区域的背景透明度
let bgKeyOpacityPressed = 0.8; // 按下态按键区域背景透明度
let bgKeyOpacityPressedUseUnpressed = true; // 按下态是否跟随未按下
let bgNonKeyOpacity = 0.8; // 非按键区域的背景透明度
let isDraggingBg = false; // 是否正在拖拽背景图片
let bgDragOffset = { x: 0, y: 0 }; // 背景拖拽偏移

// ==================== 按键独立背景拖拽状态 ====================
let isDraggingKeyBg = false; // 是否正在拖拽按键独立背景
let draggedKeyBg = null; // 正在拖拽背景的按键
let keyBgDragOffset = { x: 0, y: 0 }; // 按键背景拖拽偏移
let keyBgViewMode = 'clipped'; // 独立背景显示模式: 'full' = 完整背景, 'clipped' = 只显示按键内
let keyBgMode = 'advanced'; // 背景设置模式: 'simple' = 简单(自动填满), 'advanced' = 高级(手动调整)

// ==================== WebSocket 连接 ====================
let ws = null; // WebSocket 连接
let wsConnected = false; // 连接状态
let useWebSocket = true; // 是否使用 WebSocket 模式（全局按键捕获）

// 调整大小相关
let resizingKey = null; // 正在调整大小的按键
let resizeHandle = null; // 调整大小的手柄位置
let resizeStart = { x: 0, y: 0, w: 0, h: 0 }; // 调整开始时的状态
const RESIZE_HANDLE_SIZE = 8; // 调整手柄大小
const RESIZE_EDGE_THRESHOLD = 6; // 边缘检测阈值

const LAST_ACTIVE_PROFILE_STORAGE_KEY = 'vkLastActiveProfile';

let savedConfigNamesCache = [];
/** 与列表 API 同步的摘要行，用于本地方案卡片展示（作者 / 日期 / 键位数）。 */
let savedConfigSummariesCache = [];
/** 当前文件中的 meta（保存时写回）；author 可由用户以后扩展编辑入口。 */
let profileMeta = { author: '', updatedAt: '' };
let currentConfigName = 'obs';
let lastPristineFingerprint = '';
let isConfigDirty = true;
let baselineResyncTimerId = null;
let baselineResyncTimerId2 = null;
let obsDirtyUiDebounceTimer = null;

// 辅助对齐线相关
let snapLines = []; // 当前显示的对齐线
let isSnapping = false; // 是否正在吸附

// 布局撤销 / 恢复（仅按键列表，不含全局背景等）
const MAX_LAYOUT_HISTORY = 50;
let layoutUndoStack = [];
let layoutRedoStack = [];
let pendingGestureHistorySnapshot = null;
let historySuspended = false;

// 吸附功能配置
let snapConfig = {
    enabled: true,           // 是否启用吸附
    toEdges: true,           // 是否吸附到边缘
    toCenter: true,          // 是否吸附到中心
    toAssist: true,          // 是否启用辅助排列
    status: 'selected',      // 状态：'selected'（选择）, 'half-selected'（半选择）, 'unselected'（未选择）
    thresholds: {
        edges: 10,           // 边缘吸附阈值
        center: 10,          // 中心吸附阈值
        assist: 10           // 辅助排列阈值
    },
    distance: 10             // 辅助排列距离
};

/** Built-in layout shipped with the repo (same schema as saved profiles). */
const BUILTIN_DEFAULT_CONFIG_URL = 'configs/默认87键.json';
const APP_MODE = window.__VK_APP_MODE === 'overlay' ? 'overlay' : 'console';
const IS_OVERLAY_MODE = APP_MODE === 'overlay';

// ==================== 模块引用与通用工具 ====================
const pureUtils = window.KeyboardPureUtils;
const renderModule = window.KeyboardRenderModule;
const snapModule = window.KeyboardSnapModule;
const snapControlsModule = window.KeyboardSnapControlsModule;
const panelModule = window.KeyboardPanelModule;
const keyListModule = window.KeyboardKeyListModule;
const historyModule = window.KeyboardHistoryModule;
const keyEditModule = window.KeyboardKeyEditModule;
const colorPickerModule = window.KeyboardColorPickerModule;
const keyBgModule = window.KeyboardKeyBgModule;
const inputModule = window.KeyboardInputModule;
const mouseHelpersModule = window.KeyboardMouseHelpersModule;
const mouseDownModule = window.KeyboardMouseDownModule;
const mouseMoveModule = window.KeyboardMouseMoveModule;
const configModule = window.KeyboardConfigModule;
const networkModule = window.KeyboardNetworkModule;

if (
    !pureUtils ||
    !renderModule ||
    !snapModule ||
    !snapControlsModule ||
    !panelModule ||
    !keyListModule ||
    !historyModule ||
    !keyEditModule ||
    !colorPickerModule ||
    !keyBgModule ||
    !inputModule ||
    !mouseHelpersModule ||
    !mouseDownModule ||
    !mouseMoveModule ||
    !configModule ||
    !networkModule
) {
    throw new Error('前端模块加载失败，请检查 index.html 中 js/* 模块脚本引用顺序。');
}

currentConfigName = configModule.OVERLAY_FALLBACK_PROFILE_NAME || 'obs';

function keyListCtx() {
    return {
        CONFIG,
        getKeys: () => keys,
        setKeys: (nextKeys) => {
            keys = nextKeys;
        },
        getSelectedKey: () => selectedKey,
        setSelectedKey: (value) => {
            selectedKey = value;
        },
        getCanvas: () => canvas,
        setIsAddingKey: (value) => {
            isAddingKey = value;
        },
        pushUndoCurrentState,
        updateKeyList,
        invalidateCanvas,
        openKeyEdit
    };
}

function historyCtx() {
    return {
        maxLayoutHistory: MAX_LAYOUT_HISTORY,
        keyFromPersistedData,
        snapshotKeysLayout,
        snapshotsLayoutEqual,
        getKeys: () => keys,
        setKeys: (nextKeys) => {
            keys = nextKeys;
        },
        getSelectedKey: () => selectedKey,
        setSelectedKey: (value) => {
            selectedKey = value;
        },
        getEditingKey: () => editingKey,
        setEditingKey: (value) => {
            editingKey = value;
        },
        setEditingKeyBackup: (value) => {
            editingKeyBackup = value;
        },
        closeKeyEdit,
        updateEditMenuValues,
        updateKeyList,
        invalidateCanvas,
        getLayoutUndoStack: () => layoutUndoStack,
        getLayoutRedoStack: () => layoutRedoStack,
        getPendingGestureHistorySnapshot: () => pendingGestureHistorySnapshot,
        setPendingGestureHistorySnapshot: (value) => {
            pendingGestureHistorySnapshot = value;
        },
        getHistorySuspended: () => historySuspended,
        setHistorySuspended: (value) => {
            historySuspended = value;
        },
        setDragCandidateKey: (value) => {
            dragCandidateKey = value;
        }
    };
}

function keyEditCtx() {
    return {
        CONFIG,
        setupKeyBackgroundImageUI,
        setupKeyBackgroundPressedImageUI,
        updateKeyBgModeUI,
        updateKeyList,
        invalidateCanvas,
        pushUndoCurrentState,
        getKeys: () => keys,
        setKeys: (nextKeys) => {
            keys = nextKeys;
        },
        getEditingKey: () => editingKey,
        setEditingKey: (value) => {
            editingKey = value;
        },
        getEditingKeyBackup: () => editingKeyBackup,
        setEditingKeyBackup: (value) => {
            editingKeyBackup = value;
        },
        getKeyEditShouldCommit: () => keyEditShouldCommit,
        setKeyEditShouldCommit: (value) => {
            keyEditShouldCommit = value;
        },
        setSelectedKey: (value) => {
            selectedKey = value;
        },
        setIsDraggingKeyBg: (value) => {
            isDraggingKeyBg = value;
        },
        setDraggedKeyBg: (value) => {
            draggedKeyBg = value;
        },
        getKeyBgMode: () => keyBgMode,
        setKeyBgMode: (value) => {
            keyBgMode = value;
        },
        setKeyBgViewMode: (value) => {
            keyBgViewMode = value;
        }
    };
}

function keyBgCtx() {
    return {
        CONFIG,
        invalidateCanvas,
        getEditingKey: () => editingKey,
        getKeyBgMode: () => keyBgMode,
        setKeyBgMode: (value) => {
            keyBgMode = value;
        },
        getKeyBgViewMode: () => keyBgViewMode,
        setKeyBgViewMode: (value) => {
            keyBgViewMode = value;
        },
        updateKeyBgModeUI
    };
}

function colorPickerCtx() {
    return {
        CONFIG,
        CLASSIC_COLORS,
        maxHistory: MAX_HISTORY,
        handleColorPreview,
        handleColorChange,
        invalidateCanvas,
        getKeys: () => keys,
        getColorHistory: () => colorHistory,
        setColorHistory: (nextHistory) => {
            colorHistory = nextHistory;
        },
        getCurrentColorTarget: () => currentColorTarget,
        setCurrentColorTarget: (value) => {
            currentColorTarget = value;
        },
        getOriginalColor: () => originalColor,
        setOriginalColor: (value) => {
            originalColor = value;
        },
        getPreviewActiveState: () => previewActiveState,
        setPreviewActiveState: (value) => {
            previewActiveState = value;
        },
        getLastSelectedColor: () => lastSelectedColor,
        setLastSelectedColor: (value) => {
            lastSelectedColor = value;
        }
    };
}

function inputCtx() {
    return {
        addKey,
        removeKey,
        undoLayout,
        redoLayout,
        invalidateCanvas,
        isLayoutUndoRedoShortcut,
        getPressedKeys: () => pressedKeys,
        getSelectedKey: () => selectedKey,
        getIsAddingKey: () => isAddingKey,
        setIsAddingKey: (value) => {
            isAddingKey = value;
        },
        getWsConnected: () => wsConnected,
        getUseWebSocket: () => useWebSocket
    };
}

function mouseHelpersCtx() {
    return {
        canvas,
        CONFIG,
        RESIZE_HANDLE_SIZE,
        RESIZE_EDGE_THRESHOLD
    };
}

function mouseDownCtx() {
    return {
        canvas,
        CONFIG,
        canvasClientToLogical,
        dragOffset,
        bgPosition,
        bgDragOffset,
        keyBgDragOffset,
        getKeys: () => keys,
        getEditingKey: () => editingKey,
        getBgImage: () => bgImage,
        getResizeHandle,
        getEdgePosition,
        beginLayoutGesture,
        updateKeyList,
        invalidateCanvas,
        setSelectedKey: (value) => {
            selectedKey = value;
        },
        setDragCandidateKey: (value) => {
            dragCandidateKey = value;
        },
        setDragCandidateFrom: (value) => {
            dragCandidateFrom = value;
        },
        setResizingKey: (value) => {
            resizingKey = value;
        },
        setResizeHandle: (value) => {
            resizeHandle = value;
        },
        setResizeStart: (value) => {
            resizeStart = value;
        },
        setIsDraggingBg: (value) => {
            isDraggingBg = value;
        },
        setIsDraggingKeyBg: (value) => {
            isDraggingKeyBg = value;
        },
        setDraggedKeyBg: (value) => {
            draggedKeyBg = value;
        }
    };
}

function mouseMoveCtx() {
    return {
        canvas,
        CONFIG,
        canvasClientToLogical,
        dragOffset,
        bgPosition,
        bgDragOffset,
        keyBgDragOffset,
        CLICK_DRAG_THRESHOLD_PX,
        RESIZE_EDGE_THRESHOLD,
        calculateSnap,
        beginLayoutGesture,
        updateEditMenuValues,
        invalidateCanvas,
        getResizeHandle,
        getEdgePosition,
        updateCursor,
        getKeys: () => keys,
        getEditingKey: () => editingKey,
        getBgImage: () => bgImage,
        getDragCandidateKey: () => dragCandidateKey,
        setDragCandidateKey: (value) => {
            dragCandidateKey = value;
        },
        getDragCandidateFrom: () => dragCandidateFrom,
        getDraggedKey: () => draggedKey,
        setDraggedKey: (value) => {
            draggedKey = value;
        },
        getResizingKey: () => resizingKey,
        getResizeHandleState: () => resizeHandle,
        getResizeStart: () => resizeStart,
        setSnapLines: (lines) => {
            snapLines = lines;
        },
        getIsDraggingBg: () => isDraggingBg,
        getIsDraggingKeyBg: () => isDraggingKeyBg,
        getDraggedKeyBg: () => draggedKeyBg
    };
}

function byId(id) {
    return document.getElementById(id);
}

function setInputValue(id, value) {
    const el = byId(id);
    if (el) el.value = value;
}

function setChecked(id, checked) {
    const el = byId(id);
    if (el) el.checked = !!checked;
}

function setDisabled(id, disabled) {
    const el = byId(id);
    if (el) el.disabled = !!disabled;
}

function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
}

function setStyle(id, prop, value) {
    const el = byId(id);
    if (el) el.style[prop] = value;
}

function setDisplay(id, value) {
    const el = byId(id);
    if (el) el.style.display = value;
}

function setImageSrc(id, src) {
    const el = byId(id);
    if (el) el.src = src;
}

function invokeDeclarativeAction(expr, event) {
    if (!expr) return;
    const [name, arg] = expr.split(':');
    const fn = window[name];
    if (typeof fn !== 'function') {
        console.warn('未找到事件处理函数:', name);
        return;
    }
    if (arg === 'event') {
        fn(event);
        return;
    }
    if (arg === 'value') {
        fn(event && event.target ? event.target.value : undefined);
        return;
    }
    if (arg !== undefined) {
        fn(arg);
        return;
    }
    fn();
}

function setPreviewKeyStateMode(mode) {
    const allowed = ['live', 'all_pressed', 'all_unpressed'];
    if (!allowed.includes(mode)) return;
    previewKeyStateMode = mode;
    document.querySelectorAll('[data-preview-mode]').forEach((el) => {
        const m = el.getAttribute('data-preview-mode');
        const on = m === mode;
        el.classList.toggle('is-selected', on);
        if (el.tagName === 'BUTTON') {
            el.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
    });
    invalidateCanvas();
}

function setupDeclarativeControlBindings() {
    document.querySelectorAll('[data-click]').forEach((el) => {
        el.addEventListener('click', (event) => invokeDeclarativeAction(el.dataset.click, event));
    });
    document.querySelectorAll('[data-change]').forEach((el) => {
        el.addEventListener('change', (event) => invokeDeclarativeAction(el.dataset.change, event));
    });
    document.querySelectorAll('[data-input]').forEach((el) => {
        el.addEventListener('input', (event) => invokeDeclarativeAction(el.dataset.input, event));
    });
}

function openConfigUpload() {
    const upload = byId('config-upload');
    if (upload) upload.click();
}

async function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
}

function setObsFlowStatus(message, tone = '') {
    const el = byId('obs-flow-status');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('success', 'error');
    if (tone === 'success' || tone === 'error') {
        el.classList.add(tone);
    }
}

function updateSavedConfigCountText(names) {
    const count = byId('saved-config-count');
    if (!count) return;
    const n = Array.isArray(names) ? names.length : 0;
    count.textContent = '共 ' + n + ' 项';
}

function isValidProfileFileStem(name) {
    const s = String(name || '').trim();
    if (!s || s.length > 80 || s.startsWith('.')) return false;
    if (s.includes('..')) return false;
    const bad = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    return !bad.some((c) => s.includes(c));
}

function normalizeProfileNameOrFallback(raw) {
    const name = String(raw || '').trim();
    return name || configModule.OVERLAY_FALLBACK_PROFILE_NAME;
}

function getCurrentConfigName() {
    const input = byId('obs-profile-name');
    const fromInput = input && input.value ? String(input.value).trim() : '';
    return normalizeProfileNameOrFallback(fromInput || currentConfigName);
}

function persistLastActiveProfile(name) {
    const safe = String(name || '').trim();
    if (!safe) return;
    try {
        localStorage.setItem(LAST_ACTIVE_PROFILE_STORAGE_KEY, safe);
    } catch (_) {
        /* ignore quota / private mode */
    }
}

function scheduleBaselineResync() {
    if (IS_OVERLAY_MODE) return;
    if (baselineResyncTimerId !== null) {
        clearTimeout(baselineResyncTimerId);
        baselineResyncTimerId = null;
    }
    if (baselineResyncTimerId2 !== null) {
        clearTimeout(baselineResyncTimerId2);
        baselineResyncTimerId2 = null;
    }
    /** 仅刷新顶栏等 UI，绝不在这里 capture 基线，否则会吸收用户未保存编辑，导致切换配置不弹确认。 */
    function runBaselineResync() {
        try {
            if (!IS_OVERLAY_MODE) {
                fitConsoleCanvasToPreviewStage();
            }
        } catch (_) {
            /* ignore */
        }
        updateObsWorkflowUi();
    }
    baselineResyncTimerId = setTimeout(() => {
        baselineResyncTimerId = null;
        runBaselineResync();
    }, 400);
    baselineResyncTimerId2 = setTimeout(() => {
        baselineResyncTimerId2 = null;
        runBaselineResync();
    }, 2200);
}

/** 长字符串（多为 base64 图）只比长度，避免抖动与性能问题 */
function shortenLongStringsInValue(val, minLen) {
    const n = minLen || 240;
    if (typeof val === 'string' && val.length >= n) {
        return '#str:' + val.length;
    }
    return val;
}

/**
 * 将当前画布序列化为稳定指纹：键排序、数字取整、长串折叠。
 * 用于判断是否与「上次保存/载入」一致，减少误报未保存。
 */
function normalizeConfigSnapshotForCompare(raw) {
    let snap;
    try {
        snap = JSON.parse(JSON.stringify(raw));
    } catch (_) {
        snap = raw;
    }

    function norm(val) {
        if (val === null || val === undefined) return val;
        if (typeof val === 'number' && Number.isFinite(val)) {
            return Math.round(val * 1e6) / 1e6;
        }
        if (typeof val === 'string') {
            return shortenLongStringsInValue(val, 240);
        }
        if (Array.isArray(val)) {
            return val.map(norm);
        }
        if (typeof val === 'object') {
            const out = {};
            Object.keys(val)
                .sort()
                .forEach((k) => {
                    out[k] = norm(val[k]);
                });
            return out;
        }
        return val;
    }

    if (!snap || typeof snap !== 'object') {
        return norm(snap);
    }
    return norm(snap);
}

function canonicalConfigFingerprint() {
    const snap = buildCurrentConfigObject();
    if (snap.meta) delete snap.meta;
    if (snap.version !== undefined) delete snap.version;
    return JSON.stringify(normalizeConfigSnapshotForCompare(snap));
}

/** 用磁盘 JSON 的稳定形态做基线，避免异步背景图加载等导致刚切换就误报未保存。 */
function configSnapshotFromFileForCompare(loaded) {
    const o = loaded && typeof loaded === 'object' ? JSON.parse(JSON.stringify(loaded)) : {};
    delete o.version;
    delete o.meta;
    const cleanedKeys = Array.isArray(o.keys) ? o.keys.map((k) => pureUtils.cleanKeyForSave(k || {})) : [];
    const cfg = Object.assign({}, DEFAULT_CONFIG_TEMPLATE, o.config && typeof o.config === 'object' ? o.config : {});
    return {
        keys: cleanedKeys,
        config: cfg,
        bgImage: typeof o.bgImage === 'string' ? o.bgImage : '',
        bgPosition:
            o.bgPosition && typeof o.bgPosition === 'object'
                ? { x: o.bgPosition.x || 0, y: o.bgPosition.y || 0 }
                : { x: 0, y: 0 },
        bgScale:
            o.bgScale !== undefined && !Number.isNaN(Number(o.bgScale)) ? parseFloat(String(o.bgScale), 10) : 1.0,
        bgKeyOpacity:
            o.bgKeyOpacity !== undefined && !Number.isNaN(Number(o.bgKeyOpacity))
                ? parseFloat(String(o.bgKeyOpacity), 10)
                : 0.8,
        bgKeyOpacityPressed:
            o.bgKeyOpacityPressed !== undefined && !Number.isNaN(Number(o.bgKeyOpacityPressed))
                ? parseFloat(String(o.bgKeyOpacityPressed), 10)
                : o.bgKeyOpacity !== undefined && !Number.isNaN(Number(o.bgKeyOpacity))
                  ? parseFloat(String(o.bgKeyOpacity), 10)
                  : 0.8,
        bgKeyOpacityPressedUseUnpressed:
            o.bgKeyOpacityPressedUseUnpressed !== undefined ? !!o.bgKeyOpacityPressedUseUnpressed : true,
        bgNonKeyOpacity:
            o.bgNonKeyOpacity !== undefined && !Number.isNaN(Number(o.bgNonKeyOpacity))
                ? parseFloat(String(o.bgNonKeyOpacity), 10)
                : 0.8
    };
}

function setPristineBaselineFromLoadedConfig(loaded) {
    if (!IS_OVERLAY_MODE) {
        fitConsoleCanvasToPreviewStage();
    }
    const snap = configSnapshotFromFileForCompare(loaded);
    lastPristineFingerprint = JSON.stringify(normalizeConfigSnapshotForCompare(snap));
    isConfigDirty = false;
}

function capturePristineFingerprintBaseline() {
    if (!IS_OVERLAY_MODE) {
        fitConsoleCanvasToPreviewStage();
    }
    lastPristineFingerprint = canonicalConfigFingerprint();
    isConfigDirty = false;
}

function recomputeDirtyState() {
    if (IS_OVERLAY_MODE) return;
    try {
        const now = canonicalConfigFingerprint();
        isConfigDirty = !lastPristineFingerprint || now !== lastPristineFingerprint;
    } catch (err) {
        console.warn('配置脏状态计算失败，降级为未保存状态:', err);
        isConfigDirty = true;
    }
}

function syncObsProfileNameEverywhere(name) {
    currentConfigName = normalizeProfileNameOrFallback(name);
    const input = byId('obs-profile-name');
    if (input) input.value = currentConfigName;

    const sel = byId('saved-config-select');
    if (sel) {
        const has = Array.from(sel.options || []).some((o) => o.value === currentConfigName);
        sel.value = has ? currentConfigName : '';
    }
    updateObsOverlayUrlField();
    updateObsWorkflowUi();
}

function updateObsWorkflowUi() {
    const name = getCurrentConfigName();
    const modeBadge = byId('obs-mode-badge');
    recomputeDirtyState();

    if (modeBadge) {
        modeBadge.textContent = isConfigDirty ? '保存状态：有未保存改动' : '保存状态：无未保存改动';
        modeBadge.classList.remove('is-clean', 'is-dirty');
        modeBadge.classList.add(isConfigDirty ? 'is-dirty' : 'is-clean');
        // 内联 + important，避免被其它样式或扩展盖住
        if (isConfigDirty) {
            modeBadge.style.setProperty('background-color', '#ffebee', 'important');
            modeBadge.style.setProperty('color', '#b71c1c', 'important');
            modeBadge.style.setProperty('border', '1px solid #e53935', 'important');
        } else {
            modeBadge.style.setProperty('background-color', '#e8f5e9', 'important');
            modeBadge.style.setProperty('color', '#1b5e20', 'important');
            modeBadge.style.setProperty('border', '1px solid #43a047', 'important');
        }
        if (modeBadge.title !== undefined) {
            modeBadge.title = isConfigDirty
                ? '当前内容与上次载入或保存时的快照不一致，切换配置前建议先保存。'
                : '与上次载入配置或上次成功「保存当前配置」时的内容一致；要写入 configs 文件夹请点配置页的保存。';
        }
    }
    const previewNameEl = byId('preview-current-config-name');
    if (previewNameEl) {
        previewNameEl.textContent = name;
    }
}

/** 编辑后画布会 invalidate，但顶栏保存状态需另算；防抖避免拖拽时每帧全量指纹。 */
function scheduleObsDirtyUiRefresh() {
    if (IS_OVERLAY_MODE) return;
    if (obsDirtyUiDebounceTimer !== null) {
        clearTimeout(obsDirtyUiDebounceTimer);
    }
    obsDirtyUiDebounceTimer = setTimeout(() => {
        obsDirtyUiDebounceTimer = null;
        updateObsWorkflowUi();
    }, 200);
}

function hasSavedProfile(name) {
    const safeName = String(name || '').trim();
    if (!safeName) return false;
    return savedConfigNamesCache.includes(safeName);
}

function getOverlayUrl() {
    const u = new URL(window.location.href);
    const profile = getCurrentConfigName();
    return `${u.origin}/overlay?config=${encodeURIComponent(profile)}`;
}

function updateObsOverlayUrlField() {
    const input = byId('obs-overlay-url');
    if (!input) return;
    input.value = getOverlayUrl();
}

function waitTwoFrames() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });
}

async function promptSaveIfDirty(actionLabel) {
    await waitTwoFrames();
    recomputeDirtyState();
    if (!isConfigDirty) return true;

    const shouldSave = confirm(
        '当前配置还有未保存改动。\n\n点击“确定”先保存再继续' + actionLabel + '；点击“取消”表示不保存继续。'
    );
    if (shouldSave) {
        const ok = await saveConfigToProject();
        return !!ok;
    }
    return true;
}

async function startNewProfileConfig() {
    const goOn = await promptSaveIfDirty('新建');
    if (!goOn) return;
    const suggest = getCurrentConfigName() + '-new';
    const raw = prompt(
        '新建配置：请输入文件名（不含 .json，将保存为 configs/名称.json）。\n' +
            '会从内置模板 configs/默认87键.json 载入键位，之后可在画布上编辑。',
        suggest
    );
    if (raw === null) return;
    const name = String(raw).trim();
    if (!name) {
        setObsFlowStatus('已取消新建。');
        return;
    }
    if (!isValidProfileFileStem(name)) {
        alert('名称无效：需 1～80 字符，不能以 . 开头，且不能含 / \\ : * ? " < > | 等符号。');
        return;
    }
    await loadBuiltinDefaultConfig();
    lastPristineFingerprint = '';
    isConfigDirty = true;
    syncObsProfileNameEverywhere(name);
    setObsFlowStatus('已新建配置「' + name + '」。请编辑后点击「保存当前配置」。', 'success');
    renderSavedConfigRepoList();
    invalidateCanvas();
    updateKeyList();
}

async function saveConfigAsNewProfile() {
    const suggest = getCurrentConfigName() + '-copy';
    const raw = prompt('另存为：请输入新的配置文件名（不含 .json）', suggest);
    if (raw === null) return false;
    const name = String(raw).trim();
    if (!isValidProfileFileStem(name)) {
        alert('名称无效：需 1～80 字符，不能以 . 开头，且不能含 / \\ : * ? " < > | 等符号。');
        return false;
    }
    syncObsProfileNameEverywhere(name);
    return saveConfigToProject();
}

async function copyObsOverlayUrlOnly() {
    recomputeDirtyState();
    await copyObsOverlayUrl(false);
    if (isConfigDirty) {
        setObsFlowStatus('已复制地址。有未保存改动时 OBS 仍用上次保存的版本。', 'error');
    } else {
        setObsFlowStatus('已复制地址。', 'success');
    }
}

async function loadProjectConfigByName(name, options) {
    const opts = options || {};
    const safeName = String(name || '').trim();
    if (!safeName) return false;
    if (safeName === getCurrentConfigName()) {
        return true;
    }
    if (!opts.skipDirtyPrompt) {
        const goOn = await promptSaveIfDirty('切换配置');
        if (!goOn) return false;
    }
    const sel = byId('saved-config-select');
    if (!sel) return false;
    sel.value = safeName;
    const loaded = await networkModule.loadSelectedProjectConfig({
        selectEl: sel,
        applyConfig,
        suppressSuccessAlert: true
    });
    if (!loaded) return false;

    currentConfigName = safeName;
    try {
        setPristineBaselineFromLoadedConfig(loaded);
    } catch (_) {
        lastPristineFingerprint = '';
        isConfigDirty = true;
    }
    syncObsProfileNameEverywhere(safeName);
    persistLastActiveProfile(safeName);
    scheduleBaselineResync();
    setObsFlowStatus('已切换配置。', 'success');
    renderSavedConfigRepoList();
    updateKeyList();
    invalidateCanvas();
    return true;
}

async function deleteProjectConfigByName(name) {
    const safeName = String(name || '').trim();
    if (!safeName) return false;
    const sel = byId('saved-config-select');
    if (!sel) return false;
    sel.value = safeName;
    const ok = await networkModule.deleteSelectedProjectConfig({
        selectEl: sel,
        onDeleted: refreshSavedConfigSelect
    });
    if (!ok) return false;
    setObsFlowStatus('已删除配置：configs/' + safeName + '.json', 'success');
    return true;
}

function normalizeConfigSummaryEntries(items) {
    if (!Array.isArray(items)) return [];
    return items
        .map((entry) => {
            if (typeof entry === 'string') {
                return {
                    name: entry,
                    keyCount: 0,
                    author: '',
                    updatedAt: '',
                    fileModified: ''
                };
            }
            return {
                name: String(entry.name || ''),
                keyCount: Number(entry.keyCount) || 0,
                author: String(entry.author || ''),
                updatedAt: String(entry.updatedAt || ''),
                fileModified: String(entry.fileModified || '')
            };
        })
        .filter((x) => x.name);
}

function formatSchemeListDate(iso, fileModified) {
    if (iso) {
        try {
            const d = new Date(iso);
            if (!Number.isNaN(d.getTime())) {
                return d.toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' });
            }
        } catch (_) {
            /* ignore */
        }
    }
    return fileModified || '—';
}

/** 传入 `items` 时更新缓存并渲染；不传则按上次缓存重绘（切换方案后仍保留作者等信息）。 */
function renderSavedConfigRepoList(items) {
    if (items !== undefined) {
        savedConfigSummariesCache = normalizeConfigSummaryEntries(items);
    }
    savedConfigNamesCache = savedConfigSummariesCache.map((x) => x.name);
    updateSavedConfigCountText(savedConfigNamesCache);

    const list = byId('saved-config-list');
    if (!list) return;
    list.innerHTML = '';

    const currentStem = normalizeProfileNameOrFallback(currentConfigName);

    if (!savedConfigSummariesCache.length) {
        const empty = document.createElement('div');
        empty.className = 'config-repo-empty';
        empty.textContent = '暂无配置。请先点击上方「新建配置（从默认模板）」。';
        list.appendChild(empty);
        return;
    }

    savedConfigSummariesCache.forEach((row) => {
        const name = row.name;
        const isCurrent = currentStem === name;
        const item = document.createElement('div');
        item.className = 'config-repo-item';
        if (isCurrent) item.classList.add('is-current');

        const main = document.createElement('div');
        main.className = 'config-repo-main';

        const title = document.createElement('button');
        title.type = 'button';
        title.className = 'config-repo-name config-repo-open-btn';
        title.textContent = name + (isCurrent ? '（当前）' : '');
        title.title = '切换到该配置';
        title.addEventListener('click', () => {
            loadProjectConfigByName(name).then(() => {
                renderSavedConfigRepoList();
            });
        });
        main.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'config-repo-meta';
        const authorDisp = row.author ? row.author : '—';
        const dateDisp = formatSchemeListDate(row.updatedAt, row.fileModified);
        meta.textContent = `作者：${authorDisp} · 更新：${dateDisp} · ${row.keyCount} 键`;
        main.appendChild(meta);

        item.appendChild(main);

        const actions = document.createElement('div');
        actions.className = 'config-repo-actions';

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-danger';
        delBtn.textContent = '🗑 删除';
        delBtn.addEventListener('click', () => {
            deleteProjectConfigByName(name).then(() => {
                renderSavedConfigRepoList();
            });
        });
        actions.appendChild(delBtn);

        item.appendChild(actions);
        list.appendChild(item);
    });
}

async function copyObsOverlayUrl(showNotice = true) {
    const url = getOverlayUrl();
    try {
        await copyTextToClipboard(url);
        if (showNotice) {
            setObsFlowStatus('OBS 地址已复制：' + url, 'success');
        }
        return url;
    } catch (err) {
        console.error('复制 OBS 地址失败:', err);
        setObsFlowStatus('复制失败，请手动复制输入框里的地址。', 'error');
        alert('复制失败，请手动复制：\n' + url);
        return url;
    }
}

async function quickSaveAndCopyObsUrl() {
    const ok = await saveConfigToProject();
    if (!ok) return;
    await copyObsOverlayUrl(false);
    setObsFlowStatus('已保存并复制地址。', 'success');
}

function switchConsoleTab(tabId) {
    const target = ['appearance', 'layout', 'config'].includes(tabId) ? tabId : 'appearance';

    const appearance = byId('tab-appearance');
    const layout = byId('tab-layout');
    const config = byId('tab-config');

    if (appearance) appearance.classList.toggle('active', target === 'appearance');
    if (layout) layout.classList.toggle('active', target === 'layout');
    if (config) config.classList.toggle('active', target === 'config');

    const appearanceBtn = byId('tab-btn-appearance');
    const layoutBtn = byId('tab-btn-layout');
    const configBtn = byId('tab-btn-config');
    if (appearanceBtn) appearanceBtn.classList.toggle('active', target === 'appearance');
    if (layoutBtn) layoutBtn.classList.toggle('active', target === 'layout');
    if (configBtn) configBtn.classList.toggle('active', target === 'config');
}

/** 将视口坐标转为画布逻辑坐标（预览区 CSS 缩放后与 bitmap 一致） */
function eventCanvasToLogical(canvasEl, clientX, clientY) {
    if (!canvasEl) {
        return { x: 0, y: 0 };
    }
    const rect = canvasEl.getBoundingClientRect();
    const bw = canvasEl.width;
    const bh = canvasEl.height;
    const sx = rect.width > 0 ? bw / rect.width : 1;
    const sy = rect.height > 0 ? bh / rect.height : 1;
    return {
        x: (clientX - rect.left) * sx,
        y: (clientY - rect.top) * sy
    };
}

function canvasClientToLogical(clientX, clientY) {
    return eventCanvasToLogical(canvas, clientX, clientY);
}

function clampCanvasWidth(v) {
    return Math.max(320, Math.min(3840, Math.round(Number(v)) || 1200));
}

function clampCanvasHeight(v) {
    return Math.max(200, Math.min(2160, Math.round(Number(v)) || 400));
}

function readCanvasDimensionsFromNumberInputs() {
    const wEl = byId('console-canvas-width');
    const hEl = byId('console-canvas-height');
    const rawW = wEl ? String(wEl.value).trim() : '';
    const rawH = hEl ? String(hEl.value).trim() : '';
    const w = rawW === '' ? NaN : parseInt(rawW, 10);
    const h = rawH === '' ? NaN : parseInt(rawH, 10);
    const cw = Number.isFinite(w) ? clampCanvasWidth(w) : CONFIG.canvasWidth;
    const ch = Number.isFinite(h) ? clampCanvasHeight(h) : CONFIG.canvasHeight;
    return {
        w: cw,
        h: ch,
        finiteW: Number.isFinite(w),
        finiteH: Number.isFinite(h)
    };
}

function refreshConsoleCanvasApplyButtonState() {
    if (IS_OVERLAY_MODE) return;
    const btn = byId('console-canvas-apply-btn');
    if (!btn) return;
    const { w, h, finiteW, finiteH } = readCanvasDimensionsFromNumberInputs();
    const pending =
        !finiteW || !finiteH || w !== CONFIG.canvasWidth || h !== CONFIG.canvasHeight;
    btn.classList.toggle('is-pending', pending);
    btn.title = pending
        ? '数字与当前画布不一致，点击应用到画布'
        : '将当前宽高数字应用到画布';
}

function syncPreviewCanvasDimensionUi() {
    if (IS_OVERLAY_MODE) return;
    const nw = clampCanvasWidth(CONFIG.canvasWidth);
    const nh = clampCanvasHeight(CONFIG.canvasHeight);
    const wEl = byId('console-canvas-width');
    const hEl = byId('console-canvas-height');
    const wSl = byId('console-canvas-width-slider');
    const hSl = byId('console-canvas-height-slider');
    if (wEl) wEl.value = String(nw);
    if (hEl) hEl.value = String(nh);
    if (wSl) wSl.value = String(nw);
    if (hSl) hSl.value = String(nh);
    refreshConsoleCanvasApplyButtonState();
}

function setupPreviewCanvasSizeControls() {
    if (IS_OVERLAY_MODE) return;
    syncPreviewCanvasDimensionUi();
    const wSl = byId('console-canvas-width-slider');
    const hSl = byId('console-canvas-height-slider');
    const wNum = byId('console-canvas-width');
    const hNum = byId('console-canvas-height');
    if (wSl) {
        wSl.addEventListener('input', () => {
            const v = parseInt(wSl.value, 10);
            if (!Number.isFinite(v)) return;
            applyConsoleCanvasDimensions(v, CONFIG.canvasHeight);
        });
    }
    if (hSl) {
        hSl.addEventListener('input', () => {
            const v = parseInt(hSl.value, 10);
            if (!Number.isFinite(v)) return;
            applyConsoleCanvasDimensions(CONFIG.canvasWidth, v);
        });
    }
    if (wNum) {
        wNum.addEventListener('input', refreshConsoleCanvasApplyButtonState);
        wNum.addEventListener('change', refreshConsoleCanvasApplyButtonState);
    }
    if (hNum) {
        hNum.addEventListener('input', refreshConsoleCanvasApplyButtonState);
        hNum.addEventListener('change', refreshConsoleCanvasApplyButtonState);
    }
}

/** 逻辑画布尺寸（保存到配置）；预览区仅 CSS 缩放，不改变逻辑宽高 */
function applyConsoleCanvasDimensions(w, h) {
    if (IS_OVERLAY_MODE || !canvas) return;
    const nw = clampCanvasWidth(w);
    const nh = clampCanvasHeight(h);
    CONFIG.canvasWidth = nw;
    CONFIG.canvasHeight = nh;
    canvas.width = nw;
    canvas.height = nh;
    fitConsoleCanvasToPreviewStage();
    invalidateCanvas();
    syncPreviewCanvasDimensionUi();
    scheduleObsDirtyUiRefresh();
}

function applyConsoleCanvasSizeFromInputs() {
    const wEl = byId('console-canvas-width');
    const hEl = byId('console-canvas-height');
    const w = wEl ? parseInt(wEl.value, 10) : NaN;
    const h = hEl ? parseInt(hEl.value, 10) : NaN;
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
        alert('请输入有效的宽高数字。');
        refreshConsoleCanvasApplyButtonState();
        return;
    }
    applyConsoleCanvasDimensions(w, h);
}

/** 控制台预览：画布按逻辑像素 1:1 显示，不缩放进预览区（避免改尺寸时「画面被挤小」的错觉）；过大时在预览区内滚动。 */
function fitConsoleCanvasToPreviewStage() {
    if (IS_OVERLAY_MODE || !canvas) return;

    const logicalW = Math.max(1, Math.round(Number(CONFIG.canvasWidth)) || 1200);
    const logicalH = Math.max(1, Math.round(Number(CONFIG.canvasHeight)) || 400);

    if (canvas.width !== logicalW || canvas.height !== logicalH) {
        canvas.width = logicalW;
        canvas.height = logicalH;
        invalidateCanvas();
    }

    canvas.style.width = logicalW + 'px';
    canvas.style.height = logicalH + 'px';

    const container = byId('keyboard-container');
    if (container) {
        container.style.width = logicalW + 'px';
        container.style.height = logicalH + 'px';
    }
}

let previewCanvasResizeState = null;

/** 预览区画布右/下/东南角拖动，按当前显示缩放换算为逻辑宽高 */
function setupPreviewCanvasEdgeResize() {
    if (IS_OVERLAY_MODE) return;
    const specs = [
        { id: 'vk-canvas-resize-e', edge: 'e' },
        { id: 'vk-canvas-resize-s', edge: 's' },
        { id: 'vk-canvas-resize-se', edge: 'se' }
    ];

    function onMove(e) {
        if (!previewCanvasResizeState) return;
        const st = previewCanvasResizeState;
        const dx = e.clientX - st.startClientX;
        const dy = e.clientY - st.startClientY;
        let nw = st.startLogicalW;
        let nh = st.startLogicalH;
        if (st.edge.includes('e')) {
            nw = Math.round(st.startLogicalW + dx * st.scaleX);
        }
        if (st.edge.includes('s')) {
            nh = Math.round(st.startLogicalH + dy * st.scaleY);
        }
        applyConsoleCanvasDimensions(nw, nh);
    }

    function onUp() {
        previewCanvasResizeState = null;
        document.body.classList.remove('is-resizing-vk-canvas');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
    }

    specs.forEach(({ id, edge }) => {
        const el = byId(id);
        if (!el) return;
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            const cont = byId('keyboard-container');
            if (!cont || !canvas) return;
            const rect = cont.getBoundingClientRect();
            const scaleX = rect.width > 0 ? CONFIG.canvasWidth / rect.width : 1;
            const scaleY = rect.height > 0 ? CONFIG.canvasHeight / rect.height : 1;
            previewCanvasResizeState = {
                edge,
                startClientX: e.clientX,
                startClientY: e.clientY,
                startLogicalW: CONFIG.canvasWidth,
                startLogicalH: CONFIG.canvasHeight,
                scaleX,
                scaleY
            };
            document.body.classList.add('is-resizing-vk-canvas');
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });
    });
}

function setupVerticalLayoutSplitter() {
    if (IS_OVERLAY_MODE) return;
    const shell = byId('app-shell');
    const splitter = byId('layout-splitter');
    if (!shell || !splitter) return;

    const SPLITTER_H = splitter.offsetHeight || 12;
    const MIN_TOP = 280;
    const MIN_BOTTOM = 200;
    let dragging = false;
    let startY = 0;
    let startTop = 0;

    function applyByTop(topPx) {
        const shellHeight = shell.clientHeight;
        const clampedTop = Math.max(MIN_TOP, Math.min(topPx, shellHeight - MIN_BOTTOM - SPLITTER_H));
        const bottom = Math.max(MIN_BOTTOM, shellHeight - clampedTop - SPLITTER_H);
        shell.style.gridTemplateRows = `${Math.round(clampedTop)}px ${SPLITTER_H}px ${Math.round(bottom)}px`;
        fitConsoleCanvasToPreviewStage();
    }

    function onMove(e) {
        if (!dragging) return;
        const delta = e.clientY - startY;
        applyByTop(startTop + delta);
    }

    function onUp() {
        if (!dragging) return;
        dragging = false;
        document.body.classList.remove('is-resizing-layout');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
    }

    splitter.addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragging = true;
        startY = e.clientY;
        const preview = shell.querySelector('.preview-pane');
        startTop = preview ? preview.getBoundingClientRect().height : Math.round(shell.clientHeight * 0.64);
        document.body.classList.add('is-resizing-layout');
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
    setupDeclarativeControlBindings();
    toggleGlobalActiveColorUseInactive();
    toggleGlobalTextColorPressedUseUnpressed();
    toggleGlobalBorderColorPressedUseUnpressed();
    toggleKeyOpacityPressedUseUnpressed();
    toggleTextOpacityPressedUseUnpressed();
    toggleBorderOpacityPressedUseUnpressed();
    toggleBgKeyOpacityPressedUseUnpressed();
    updateObsOverlayUrlField();
    updateObsWorkflowUi();
    switchConsoleTab('appearance');
    setupVerticalLayoutSplitter();

    canvas = document.getElementById('keyboard-canvas');
    ctx = canvas.getContext('2d');

    canvas.width = CONFIG.canvasWidth;
    canvas.height = CONFIG.canvasHeight;
    fitConsoleCanvasToPreviewStage();
    setupPreviewCanvasEdgeResize();
    setupPreviewCanvasSizeControls();

    if (!IS_OVERLAY_MODE) {
        // 键盘事件
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // 鼠标事件
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp);
        canvas.addEventListener('dblclick', handleDoubleClick);
        canvas.addEventListener('wheel', handleMouseWheel);

        window.addEventListener('resize', fitConsoleCanvasToPreviewStage);
    }

    // 初始化透明度控件可见性
    updateOpacityControlsVisibility(false);

    // 初始化吸附功能参数设置条的可见性
    const snapEdgesControls = byId('snap-edges-controls');
    const snapCenterControls = byId('snap-center-controls');
    const snapAssistControls = byId('snap-assist-controls');
    if (snapEdgesControls) snapEdgesControls.style.display = snapConfig.toEdges ? 'block' : 'none';
    if (snapCenterControls) snapCenterControls.style.display = snapConfig.toCenter ? 'block' : 'none';
    if (snapAssistControls) snapAssistControls.style.display = snapConfig.toAssist ? 'block' : 'none';

    if (!IS_OVERLAY_MODE) {
        setupKeyEditModalListeners();
    }

    connectWebSocket();

    await refreshSavedConfigSelect();

    if (IS_OVERLAY_MODE) {
        await configModule.loadOverlayServerProfile({ applyConfig });
    } else {
        const names = savedConfigNamesCache.slice();
        let target = '';
        try {
            target = (localStorage.getItem(LAST_ACTIVE_PROFILE_STORAGE_KEY) || '').trim();
        } catch (_) {
            target = '';
        }
        if (!target || !names.includes(target)) {
            target = names.includes('默认87键') ? '默认87键' : '';
        }
        if (target) {
            await loadProjectConfigByName(target, { skipDirtyPrompt: true });
        } else {
            await loadBuiltinDefaultConfig();
            loadSavedConfig();
            currentConfigName = getCurrentConfigName();
            try {
                capturePristineFingerprintBaseline();
            } catch (_) {
                lastPristineFingerprint = '';
                isConfigDirty = true;
            }
            scheduleBaselineResync();
            syncObsProfileNameEverywhere(currentConfigName);
        }
    }

    updateKeyList();
    invalidateCanvas();
    updateObsWorkflowUi();

    updateUndoRedoButtons();
    fitConsoleCanvasToPreviewStage();
});

/**
 * Load repo default layout from configs/默认87键.json (requires same-origin HTTP, e.g. localhost:8080).
 */
async function loadBuiltinDefaultConfig() {
    return configModule.loadBuiltinDefaultConfig({
        url: BUILTIN_DEFAULT_CONFIG_URL,
        applyConfig,
        onFallbackEmpty: () => {
            keys = [];
            resetLayoutHistory();
        }
    });
}

// ==================== 渲染 ====================
function invalidateCanvas() {
    scheduleObsDirtyUiRefresh();
    if (canvasRafId !== null) return;
    canvasRafId = requestAnimationFrame(render);
}

function render() {
    canvasRafId = null;
    renderModule.renderFrame(
        {
            ctx,
            canvas,
            bgImage,
            bgPosition,
            bgScale,
            bgKeyOpacity,
            bgNonKeyOpacity,
            keys,
            CONFIG,
            editingKey,
            snapLines,
            draggedKey,
            resizingKey,
            isDraggingBg,
            isDraggingKeyBg
        },
        {
            roundRect,
            drawKey,
            getBgKeyOpacityForKey: resolveGlobalBgKeyOpacityForKey,
            invalidateCanvas
        }
    );
}

// 绘制辅助对齐线（边缘/中心吸附：贯穿画布；辅助排列：见 calculateSnap 中的 x1/x2 或 y1/y2）
function drawSnapLines() {
    renderModule.drawSnapLines(ctx, canvas, snapLines);
}

// 计算对齐线和吸附位置
function calculateSnap(key, isResize = false, resizeHandle = null) {
    return snapModule.calculateSnapForKey(
        {
            keys,
            canvas,
            CONFIG,
            snapConfig
        },
        key,
        {
            isResize,
            resizeHandle
        }
    );
}

function clampUnit(value, fallback = 1) {
    const n = Number(value);
    if (Number.isNaN(n)) return fallback;
    return Math.max(0, Math.min(1, n));
}

function resolveStateValue(options) {
    const o = options || {};
    const isPressed = !!o.isPressed;
    if (!isPressed) {
        return o.unpressedValue !== undefined ? o.unpressedValue : o.globalUnpressedValue;
    }
    const keyUsesUnpressed = o.keyUseUnpressedFlag === true;
    if (keyUsesUnpressed) {
        return o.unpressedValue !== undefined ? o.unpressedValue : o.globalUnpressedValue;
    }
    if (o.pressedValue !== undefined) {
        return o.pressedValue;
    }
    if (o.globalUseUnpressedFlag === true) {
        return o.unpressedValue !== undefined ? o.unpressedValue : o.globalUnpressedValue;
    }
    if (o.globalPressedValue !== undefined) {
        return o.globalPressedValue;
    }
    return o.unpressedValue !== undefined ? o.unpressedValue : o.globalUnpressedValue;
}

function isKeyPressedForPreview(key) {
    if (key && key._previewPressed) return true;
    if (previewKeyStateMode === 'all_pressed') return true;
    if (previewKeyStateMode === 'all_unpressed') return false;
    return !!(key && pressedKeys.has(key.code));
}

function resolveGlobalBgKeyOpacityForKey(key) {
    const base = clampUnit(bgKeyOpacity, 0.8);
    if (!isKeyPressedForPreview(key)) return base;
    if (bgKeyOpacityPressedUseUnpressed) return base;
    return clampUnit(bgKeyOpacityPressed, base);
}

function drawKey(key) {
    const isPressed = isKeyPressedForPreview(key);
    const w = key.width || CONFIG.keySize;
    const h = key.height || CONFIG.keySize;

    const faceColor = resolveStateValue({
        isPressed,
        unpressedValue: key.inactiveColor,
        pressedValue: key.activeColor,
        keyUseUnpressedFlag: key.activeColorUseInactive === true,
        globalUnpressedValue: CONFIG.inactiveColor,
        globalPressedValue: CONFIG.activeColor,
        globalUseUnpressedFlag: CONFIG.activeColorUseInactive === true
    });

    const keyOpacity = clampUnit(
        resolveStateValue({
            isPressed,
            unpressedValue: key.opacity,
            pressedValue: key.opacityPressed,
            keyUseUnpressedFlag: key.opacityPressedUseUnpressed === true,
            globalUnpressedValue: CONFIG.keyOpacity,
            globalPressedValue: CONFIG.keyOpacityPressed,
            globalUseUnpressedFlag: CONFIG.keyOpacityPressedUseUnpressed === true
        }),
        CONFIG.keyOpacity
    );
    const bgOpacity = clampUnit(
        resolveStateValue({
            isPressed,
            unpressedValue: key.bgOpacity,
            pressedValue: key.bgOpacityPressed,
            keyUseUnpressedFlag: key.bgOpacityPressedUseUnpressed === true,
            globalUnpressedValue: 1,
            globalPressedValue: 1,
            globalUseUnpressedFlag: true
        }),
        1
    );

    ctx.save();

    // 创建圆角矩形路径用于裁剪
    ctx.beginPath();
    roundRect(ctx, key.x, key.y, w, h, 8);
    ctx.closePath();

    // 如果有按键独立背景图片，优先绘制（按下时可切换为专用图，共用缩放/偏移/模式）
    const bgDrawObj =
        isPressed && key._bgPressedImageObj ? key._bgPressedImageObj : key._bgImageObj;
    if (key.bgImage && key._bgImageObj) {
        ctx.save();
        // 根据显示模式决定是否裁剪到按键范围
        // clipped模式 或 非编辑模式时裁剪，full模式且在编辑该按键时不裁剪
        if (keyBgViewMode === 'clipped' || editingKey !== key) {
            ctx.clip();
        }
        ctx.globalAlpha = bgOpacity; // 背景图片只受背景透明度影响
        
        // 计算背景变换
        let bgScaleX, bgScaleY, bgOffsetX, bgOffsetY;
        
        // 简单模式：变形图片填满按键（stretch模式）
        if (key.bgMode === 'simple') {
            const imgW = bgDrawObj.width;
            const imgH = bgDrawObj.height;
            // 分别计算X和Y方向的缩放，使图片变形填满按键
            bgScaleX = w / imgW;
            bgScaleY = h / imgH;
            bgOffsetX = 0;
            bgOffsetY = 0;
        } else {
            // 高级模式：使用手动设置的参数
            const bgScaleValue = key.bgScale !== undefined ? key.bgScale : 1.0;
            bgScaleX = bgScaleValue;
            bgScaleY = bgScaleValue;
            bgOffsetX = key.bgOffsetX !== undefined ? key.bgOffsetX : 0;
            bgOffsetY = key.bgOffsetY !== undefined ? key.bgOffsetY : 0;
        }
        
        ctx.save();
        ctx.translate(key.x + bgOffsetX, key.y + bgOffsetY);
        ctx.scale(bgScaleX, bgScaleY);
        ctx.drawImage(bgDrawObj, 0, 0);
        ctx.restore();
        ctx.restore();
        
        // 绘制半透明颜色层（根据按下状态）
        ctx.save();
        ctx.clip();
        ctx.fillStyle = faceColor;
        ctx.shadowColor = faceColor;
        ctx.shadowBlur = isPressed ? 15 : 0;
        ctx.globalAlpha = keyOpacity; // 颜色层只受按键透明度影响
        ctx.fill();
        ctx.restore();
    } else {
        // 按键背景（纯色）
        ctx.globalAlpha = keyOpacity;
        ctx.fillStyle = faceColor;
        ctx.shadowColor = faceColor;
        ctx.shadowBlur = isPressed ? 15 : 0;
        ctx.fill();
    }

    // 边框颜色/透明度独立于按键本体透明度
    ctx.beginPath();
    roundRect(ctx, key.x, key.y, w, h, 8);
    ctx.closePath();
    ctx.globalAlpha = 1;
    const borderColor = resolveStateValue({
        isPressed,
        unpressedValue: key.borderColor,
        pressedValue: key.borderColorPressed,
        keyUseUnpressedFlag: key.borderColorPressedUseUnpressed === true,
        globalUnpressedValue: CONFIG.borderColor,
        globalPressedValue: CONFIG.borderColorPressed,
        globalUseUnpressedFlag: CONFIG.borderColorPressedUseUnpressed === true
    });
    const borderAlpha = clampUnit(
        resolveStateValue({
            isPressed,
            unpressedValue: key.borderOpacity,
            pressedValue: key.borderOpacityPressed,
            keyUseUnpressedFlag: key.borderOpacityPressedUseUnpressed === true,
            globalUnpressedValue: CONFIG.borderOpacity,
            globalPressedValue: CONFIG.borderOpacityPressed,
            globalUseUnpressedFlag: CONFIG.borderOpacityPressedUseUnpressed === true
        }),
        CONFIG.borderOpacity
    );
    ctx.strokeStyle = canvasFillStyleWithAlpha(borderColor, borderAlpha);
    ctx.lineWidth = 2;
    ctx.stroke();

    // 拖动 / 缩放时绘制调整手柄
    if (key === draggedKey || key === resizingKey) {
        drawResizeHandles(key);
    }

    // 文字颜色/透明度独立于按键本体透明度
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    const labelColor = resolveStateValue({
        isPressed,
        unpressedValue: key.textColor,
        pressedValue: key.textColorPressed,
        keyUseUnpressedFlag: key.textColorPressedUseUnpressed === true,
        globalUnpressedValue: CONFIG.textColor,
        globalPressedValue: CONFIG.textColorPressed,
        globalUseUnpressedFlag: CONFIG.textColorPressedUseUnpressed === true
    });
    const labelAlpha = clampUnit(
        resolveStateValue({
            isPressed,
            unpressedValue: key.textOpacity,
            pressedValue: key.textOpacityPressed,
            keyUseUnpressedFlag: key.textOpacityPressedUseUnpressed === true,
            globalUnpressedValue: CONFIG.textOpacity,
            globalPressedValue: CONFIG.textOpacityPressed,
            globalUseUnpressedFlag: CONFIG.textOpacityPressedUseUnpressed === true
        }),
        CONFIG.textOpacity
    );
    ctx.fillStyle = canvasFillStyleWithAlpha(labelColor, labelAlpha);
    ctx.font = `bold ${Math.min(w > 60 ? 16 : 14, h / 2)}px Microsoft YaHei`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(key.label, key.x + w / 2, key.y + h / 2);

    // 选中高亮：画在按键内容之上，路径在键体外侧，不改动内部填充/按下预览色
    if (key === selectedKey && key !== draggedKey && key !== resizingKey) {
        drawSelectedKeyOutline(key, w, h);
    }

    ctx.restore();
}

/** 仅外缘描边 + 柔光，globalAlpha 独立于按键，避免透明键上看不清 */
function drawSelectedKeyOutline(key, w, h) {
    const pad = 5;
    const r = 10;
    const ox = key.x - pad;
    const oy = key.y - pad;
    const ow = w + pad * 2;
    const oh = h + pad * 2;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.strokeStyle = 'rgba(0, 188, 212, 0.45)';
    ctx.lineWidth = 10;
    ctx.setLineDash([]);
    ctx.beginPath();
    roundRect(ctx, ox - 2, oy - 2, ow + 4, oh + 4, r + 2);
    ctx.stroke();

    ctx.strokeStyle = '#4DD0E1';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    roundRect(ctx, ox, oy, ow, oh, r);
    ctx.stroke();

    ctx.strokeStyle = '#E0F7FA';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    roundRect(ctx, ox + 1.5, oy + 1.5, ow - 3, oh - 3, Math.max(4, r - 2));
    ctx.stroke();

    ctx.restore();
}

// 绘制调整大小的手柄
function drawResizeHandles(key) {
    const w = key.width || CONFIG.keySize;
    const h = key.height || CONFIG.keySize;

    ctx.fillStyle = '#2196F3';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;

    // 四个角的手柄
    const handles = [
        { x: key.x, y: key.y }, // 左上
        { x: key.x + w, y: key.y }, // 右上
        { x: key.x, y: key.y + h }, // 左下
        { x: key.x + w, y: key.y + h } // 右下
    ];

    handles.forEach(handle => {
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, RESIZE_HANDLE_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });
}

/** 将颜色（#rgb / #rrggbb / rgb()）与 0–1 透明度合成为 canvas fillStyle */
function canvasFillStyleWithAlpha(color, alpha) {
    const a = Math.max(0, Math.min(1, alpha === undefined || alpha === null || Number.isNaN(Number(alpha)) ? 1 : Number(alpha)));
    if (!color || typeof color !== 'string') {
        return 'rgba(255,255,255,' + a + ')';
    }
    const c = color.trim();
    if (c.startsWith('rgba(')) {
        return c;
    }
    if (c.startsWith('rgb(')) {
        const m = c.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
        if (m) {
            return 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + a + ')';
        }
    }
    let hex = c.replace('#', '');
    if (hex.length === 3) {
        hex = hex
            .split('')
            .map((ch) => ch + ch)
            .join('');
    }
    if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if ([r, g, b].every((n) => !Number.isNaN(n))) {
            return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
        }
    }
    return c;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ==================== 键盘事件处理 ====================
function isTypingInField(target) {
    return inputModule.isTypingInField(target);
}

function handleKeyDown(e) {
    inputModule.handleKeyDown(inputCtx(), e);
}

function handleKeyUp(e) {
    inputModule.handleKeyUp(inputCtx(), e);
}

// ==================== 鼠标交互 ====================

// 检测鼠标位置对应的调整手柄
function getResizeHandle(key, x, y) {
    return mouseHelpersModule.getResizeHandle(mouseHelpersCtx(), key, x, y);
}

// 检测是否在边缘（用于调整大小）- 只在按键外部或边缘附近检测
function getEdgePosition(key, x, y) {
    return mouseHelpersModule.getEdgePosition(mouseHelpersCtx(), key, x, y);
}

// 更新鼠标光标样式
function updateCursor(position) {
    mouseHelpersModule.updateCursor(mouseHelpersCtx(), position);
}

function handleMouseDown(e) {
    mouseDownModule.handleMouseDown(mouseDownCtx(), e);
}

function handleMouseMove(e) {
    mouseMoveModule.handleMouseMove(mouseMoveCtx(), e);
}

function handleMouseUp() {
    const hadDrag = !!draggedKey;
    const didLayoutGesture = hadDrag || !!resizingKey;

    dragCandidateKey = null;

    if (draggedKey) {
        draggedKey = null;
        snapLines = []; // 清除对齐线
        updateKeyList();
    }
    if (resizingKey) {
        resizingKey = null;
        resizeHandle = null;
        snapLines = []; // 清除对齐线
        updateKeyList();
    }

    if (didLayoutGesture) {
        maybeCommitGestureHistory(true);
    }
    if (isDraggingBg) {
        isDraggingBg = false;
        canvas.style.cursor = 'default';
    }
    if (isDraggingKeyBg) {
        isDraggingKeyBg = false;
        draggedKeyBg = null;
        canvas.style.cursor = 'default';
    }
    invalidateCanvas();
}

// 处理鼠标滚轮事件
function handleMouseWheel(e) {
    e.preventDefault();
    
    // 如果正在编辑某个按键且有独立背景图片，滚轮调整该按键的背景缩放
    if (editingKey && editingKey.bgImage && editingKey._bgImageObj) {
        // 计算新的缩放值
        let newScale = editingKey.bgScale !== undefined ? editingKey.bgScale : 1.0;
        
        // 根据当前缩放比例动态调整步长
        // 小缩放时用更小的步长，大缩放时用更大的步长
        let step;
        if (newScale < 0.1) {
            step = 0.01; // 10%以下，每次调整1%
        } else if (newScale < 0.3) {
            step = 0.02; // 10%-30%，每次调整2%
        } else if (newScale < 0.5) {
            step = 0.03; // 30%-50%，每次调整3%
        } else {
            step = 0.05; // 50%以上，每次调整5%
        }
        
        if (e.deltaY < 0) {
            // 滚轮向上，放大
            newScale += step;
        } else {
            // 滚轮向下，缩小
            newScale -= step;
        }
        // 限制缩放范围 1% - 500%
        newScale = Math.max(0.01, Math.min(5.0, newScale));
        editingKey.bgScale = newScale;
        
        // 更新UI
        if (document.getElementById('edit-key-bg-scale')) {
            document.getElementById('edit-key-bg-scale').value = Math.round(newScale * 100);
            document.getElementById('edit-key-bg-scale-val').textContent = Math.round(newScale * 100);
        }
        invalidateCanvas();
    }
}

// 处理双击事件
function handleDoubleClick(e) {
    const { x, y } = canvasClientToLogical(e.clientX, e.clientY);

    // 从后往前找，优先选中上层的按键
    for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        const w = key.width || CONFIG.keySize;
        const h = key.height || CONFIG.keySize;

        // 检查是否在按键内部
        if (x >= key.x && x <= key.x + w && y >= key.y && y <= key.y + h) {
            openKeyEdit(key);
            return;
        }
    }
}
// ==================== 按键编辑功能 ====================

/** One-time listeners; handlers read `editingKey` when events fire (avoids duplicate binds on each open). */
function setupKeyEditModalListeners() {
    keyEditModule.setupKeyEditModalListeners(keyEditCtx());
}

function openKeyEdit(key) {
    keyEditModule.openKeyEdit(keyEditCtx(), key);
}

// 设置按键背景图片UI
function setupKeyBackgroundImageUI(key) {
    keyBgModule.setupKeyBackgroundImageUI(keyBgCtx(), key);
}

// 加载按键背景图片
function loadKeyBackgroundImage(event) {
    keyBgModule.loadKeyBackgroundImage(keyBgCtx(), event);
}

// 删除按键背景图片
function removeKeyBackgroundImage() {
    keyBgModule.removeKeyBackgroundImage(keyBgCtx());
}

// 按下时专用背景图（需先设按键背景图）
function setupKeyBackgroundPressedImageUI(key) {
    keyBgModule.setupKeyBackgroundPressedImageUI(keyBgCtx(), key);
}

function loadKeyBackgroundPressedImage(event) {
    keyBgModule.loadKeyBackgroundPressedImage(keyBgCtx(), event);
}

function removeKeyBackgroundPressedImage() {
    keyBgModule.removeKeyBackgroundPressedImage(keyBgCtx());
}

function toggleKeyTextColor() {
    keyEditModule.toggleKeyTextColor(keyEditCtx());
}

function toggleKeyActiveUseInactive() {
    keyEditModule.toggleKeyActiveUseInactive(keyEditCtx());
}

function toggleKeyTextOpacity() {
    keyEditModule.toggleKeyTextOpacity(keyEditCtx());
}

function updateKeyTextOpacityPreview(value) {
    keyEditModule.updateKeyTextOpacityPreview(keyEditCtx(), value);
}

function toggleKeyOpacityPressedUseUnpressedInEdit() {
    keyEditModule.toggleKeyOpacityPressedUseUnpressedInEdit(keyEditCtx());
}

function updateKeyOpacityPressedPreview(value) {
    keyEditModule.updateKeyOpacityPressedPreview(keyEditCtx(), value);
}

function toggleKeyTextColorPressedUseUnpressed() {
    keyEditModule.toggleKeyTextColorPressedUseUnpressed(keyEditCtx());
}

function toggleKeyTextOpacityPressedUseUnpressed() {
    keyEditModule.toggleKeyTextOpacityPressedUseUnpressed(keyEditCtx());
}

function updateKeyTextOpacityPressedPreview(value) {
    keyEditModule.updateKeyTextOpacityPressedPreview(keyEditCtx(), value);
}

function toggleKeyBorderColor() {
    keyEditModule.toggleKeyBorderColor(keyEditCtx());
}

function toggleKeyBorderOpacity() {
    keyEditModule.toggleKeyBorderOpacity(keyEditCtx());
}

function updateKeyBorderOpacityPreview(value) {
    keyEditModule.updateKeyBorderOpacityPreview(keyEditCtx(), value);
}

function toggleKeyBorderColorPressedUseUnpressed() {
    keyEditModule.toggleKeyBorderColorPressedUseUnpressed(keyEditCtx());
}

function toggleKeyBorderOpacityPressedUseUnpressed() {
    keyEditModule.toggleKeyBorderOpacityPressedUseUnpressed(keyEditCtx());
}

function updateKeyBorderOpacityPressedPreview(value) {
    keyEditModule.updateKeyBorderOpacityPressedPreview(keyEditCtx(), value);
}

// 切换按键透明度使用全局/自定义
function toggleKeyOpacity() {
    keyBgModule.toggleKeyOpacity(keyBgCtx());
}

// 更新按键透明度预览
function updateKeyOpacityPreview(value) {
    keyBgModule.updateKeyOpacityPreview(keyBgCtx(), value);
}

// 更新编辑菜单中的数值
function updateEditMenuValues() {
    if (!editingKey) return;
    
    // 更新位置和大小
    if (document.getElementById('edit-key-x')) {
        document.getElementById('edit-key-x').value = Math.round(editingKey.x);
        document.getElementById('edit-key-y').value = Math.round(editingKey.y);
        document.getElementById('edit-key-width').value = editingKey.width || CONFIG.keySize;
        document.getElementById('edit-key-height').value = editingKey.height || CONFIG.keySize;
    }
}

// 更新按键背景图片透明度预览
function updateKeyBgOpacityPreview(value) {
    keyBgModule.updateKeyBgOpacityPreview(keyBgCtx(), value);
}

function toggleKeyBgOpacityPressedUseUnpressed() {
    keyBgModule.toggleKeyBgOpacityPressedUseUnpressed(keyBgCtx());
}

function updateKeyBgOpacityPressedPreview(value) {
    keyBgModule.updateKeyBgOpacityPressedPreview(keyBgCtx(), value);
}

// 更新按键背景缩放预览
function updateKeyBgScalePreview(value) {
    keyBgModule.updateKeyBgScalePreview(keyBgCtx(), value);
}

// 更新按键背景位置预览
function updateKeyBgPositionPreview() {
    keyBgModule.updateKeyBgPositionPreview(keyBgCtx());
}

// 重置按键背景变换
function resetKeyBgTransform() {
    keyBgModule.resetKeyBgTransform(keyBgCtx());
}

// 切换独立背景显示模式
function toggleKeyBgViewMode() {
    keyBgModule.toggleKeyBgViewMode(keyBgCtx());
}

// 设置背景设置模式
function setKeyBgMode(mode) {
    keyBgModule.setKeyBgMode(keyBgCtx(), mode);
}

// 更新背景设置模式UI
function updateKeyBgModeUI() {
    keyBgModule.updateKeyBgModeUI(keyBgCtx());
}

function closeKeyEdit() {
    keyEditModule.closeKeyEdit(keyEditCtx());
}

function toggleKeyActiveColor() {
    keyEditModule.toggleKeyActiveColor(keyEditCtx());
}

function toggleKeyInactiveColor() {
    keyEditModule.toggleKeyInactiveColor(keyEditCtx());
}

function handleKeyActiveColorPreview(e) {
    keyEditModule.handleKeyActiveColorPreview(keyEditCtx(), e);
}

function handleKeyInactiveColorPreview(e) {
    keyEditModule.handleKeyInactiveColorPreview(keyEditCtx(), e);
}

function saveKeyEdit() {
    keyEditModule.saveKeyEdit(keyEditCtx());
}

function cancelKeyEdit() {
    keyEditModule.cancelKeyEdit(keyEditCtx());
}

// ==================== 控制面板功能 ====================
function toggleControls() {
    panelModule.toggleControls({ refreshSavedConfigSelect });
}

function hideControls() {
    panelModule.hideControls();
}

function updateOpacity(val) {
    panelModule.updateOpacity({ CONFIG, invalidateCanvas }, val);
}

function updateOpacityPressed(val) {
    panelModule.updateOpacityPressed({ CONFIG, invalidateCanvas }, val);
}

function toggleKeyOpacityPressedUseUnpressed() {
    panelModule.toggleKeyOpacityPressedUseUnpressed({ CONFIG, invalidateCanvas });
}

function updateTextOpacity(val) {
    panelModule.updateTextOpacity({ CONFIG, invalidateCanvas }, val);
}

function updateTextOpacityPressed(val) {
    panelModule.updateTextOpacityPressed({ CONFIG, invalidateCanvas }, val);
}

function toggleTextOpacityPressedUseUnpressed() {
    panelModule.toggleTextOpacityPressedUseUnpressed({ CONFIG, invalidateCanvas });
}

function updateBorderOpacity(val) {
    panelModule.updateBorderOpacity({ CONFIG, invalidateCanvas }, val);
}

function updateBorderOpacityPressed(val) {
    panelModule.updateBorderOpacityPressed({ CONFIG, invalidateCanvas }, val);
}

function toggleBorderOpacityPressedUseUnpressed() {
    panelModule.toggleBorderOpacityPressedUseUnpressed({ CONFIG, invalidateCanvas });
}

// ==================== 背景图片功能 ====================

function loadBackground(event) {
    panelModule.loadBackground(
        {
            setBgImage: (value) => {
                bgImage = value;
            },
            invalidateCanvas
        },
        event
    );
}

function updateOpacityControlsVisibility(hasBackground) {
    panelModule.updateOpacityControlsVisibility(hasBackground);
}

function updateBgScale(val) {
    panelModule.updateBgScale(
        {
            setBgScale: (value) => {
                bgScale = value;
            },
            invalidateCanvas
        },
        val
    );
}

function updateBgKeyOpacity(val) {
    panelModule.updateBgKeyOpacity(
        {
            setBgKeyOpacity: (value) => {
                bgKeyOpacity = value;
            },
            getBgKeyOpacity: () => bgKeyOpacity,
            getBgKeyOpacityPressedUseUnpressed: () => bgKeyOpacityPressedUseUnpressed,
            setBgKeyOpacityPressed: (value) => {
                bgKeyOpacityPressed = value;
            },
            invalidateCanvas
        },
        val
    );
}

function updateBgKeyOpacityPressed(val) {
    panelModule.updateBgKeyOpacityPressed(
        {
            getBgKeyOpacity: () => bgKeyOpacity,
            getBgKeyOpacityPressedUseUnpressed: () => bgKeyOpacityPressedUseUnpressed,
            setBgKeyOpacityPressedUseUnpressed: (value) => {
                bgKeyOpacityPressedUseUnpressed = !!value;
            },
            setBgKeyOpacityPressed: (value) => {
                bgKeyOpacityPressed = value;
            },
            invalidateCanvas
        },
        val
    );
}

function toggleBgKeyOpacityPressedUseUnpressed() {
    panelModule.toggleBgKeyOpacityPressedUseUnpressed({
        getBgKeyOpacity: () => bgKeyOpacity,
        setBgKeyOpacityPressed: (value) => {
            bgKeyOpacityPressed = value;
        },
        setBgKeyOpacityPressedUseUnpressed: (value) => {
            bgKeyOpacityPressedUseUnpressed = !!value;
        },
        invalidateCanvas
    });
}

function updateBgNonKeyOpacity(val) {
    panelModule.updateBgNonKeyOpacity(
        {
            setBgNonKeyOpacity: (value) => {
                bgNonKeyOpacity = value;
            },
            invalidateCanvas
        },
        val
    );
}

function setColorPreviewInteractive(id, enabled) {
    const el = byId(id);
    if (!el) return;
    el.style.pointerEvents = enabled ? 'auto' : 'none';
    el.style.opacity = enabled ? '1' : '0.45';
}

function toggleGlobalActiveColorUseInactive() {
    const cb = byId('active-color-use-inactive');
    if (!cb) return;
    CONFIG.activeColorUseInactive = !!(cb && cb.checked);
    if (CONFIG.activeColorUseInactive) {
        CONFIG.activeColor = CONFIG.inactiveColor;
        setStyle('active-color-preview', 'backgroundColor', CONFIG.activeColor);
    }
    setColorPreviewInteractive('active-color-preview', !CONFIG.activeColorUseInactive);
    invalidateCanvas();
}

function toggleGlobalTextColorPressedUseUnpressed() {
    const cb = byId('text-color-pressed-use-unpressed');
    if (!cb) return;
    CONFIG.textColorPressedUseUnpressed = !!(cb && cb.checked);
    if (CONFIG.textColorPressedUseUnpressed) {
        CONFIG.textColorPressed = CONFIG.textColor;
        setStyle('text-color-pressed-preview', 'backgroundColor', CONFIG.textColorPressed);
    }
    setColorPreviewInteractive('text-color-pressed-preview', !CONFIG.textColorPressedUseUnpressed);
    invalidateCanvas();
}

function toggleGlobalBorderColorPressedUseUnpressed() {
    const cb = byId('border-color-pressed-use-unpressed');
    if (!cb) return;
    CONFIG.borderColorPressedUseUnpressed = !!(cb && cb.checked);
    if (CONFIG.borderColorPressedUseUnpressed) {
        CONFIG.borderColorPressed = CONFIG.borderColor;
        setStyle('border-color-pressed-preview', 'backgroundColor', CONFIG.borderColorPressed);
    }
    setColorPreviewInteractive('border-color-pressed-preview', !CONFIG.borderColorPressedUseUnpressed);
    invalidateCanvas();
}

function removeBackground() {
    panelModule.removeBackground({
        setBgImage: (value) => {
            bgImage = value;
        },
        setBgPosition: (value) => {
            bgPosition = value;
        },
        setBgScale: (value) => {
            bgScale = value;
        },
        setBgKeyOpacity: (value) => {
            bgKeyOpacity = value;
        },
        setBgKeyOpacityPressed: (value) => {
            bgKeyOpacityPressed = value;
        },
        setBgKeyOpacityPressedUseUnpressed: (value) => {
            bgKeyOpacityPressedUseUnpressed = !!value;
        },
        setBgNonKeyOpacity: (value) => {
            bgNonKeyOpacity = value;
        },
        invalidateCanvas
    });
}

// ==================== 颜色选择器功能 ====================
let currentColorTarget = null; // 'active' | 'inactive' | 'text' | 'text_pressed' | 'border' | 'border_pressed'
let originalColor = null; // 保存原始颜色用于取消
let previewActiveState = false; // 预览时是否显示按下状态
let lastSelectedColor = null; // 上一次选择的颜色（用于记录历史）

// 经典颜色预设（8个常用颜色）
const CLASSIC_COLORS = [
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
    '#FF00FF', '#00FFFF', '#FFFFFF', '#000000'
];

// 历史颜色记录
let colorHistory = [];
const MAX_HISTORY = 8;

// 初始化经典颜色
function initClassicColors() {
    colorPickerModule.initClassicColors(colorPickerCtx());
}

// 更新历史颜色显示
function updateHistoryColors() {
    colorPickerModule.updateHistoryColors(colorPickerCtx());
}

// 添加颜色到历史记录
function addToHistory(color) {
    colorPickerModule.addToHistory(colorPickerCtx(), color);
}

// 选择颜色
function selectColor(color) {
    colorPickerModule.selectColor(colorPickerCtx(), color);
}

function openColorPicker(target) {
    colorPickerModule.openColorPicker(colorPickerCtx(), target);
}

function handleColorPreview(e) {
    colorPickerModule.handleColorPreview(colorPickerCtx(), e);
}

function handleColorChange(e) {
    colorPickerModule.handleColorChange(colorPickerCtx(), e);
}

function confirmColorPick() {
    colorPickerModule.confirmColorPick(colorPickerCtx());
}

function cancelColorPick() {
    colorPickerModule.cancelColorPick(colorPickerCtx());
}

function closeColorPicker() {
    colorPickerModule.closeColorPicker(colorPickerCtx());
}

// ==================== 按键管理 ====================
function startAddKey() {
    keyListModule.startAddKey(keyListCtx());
}

function cancelAddKey() {
    keyListModule.cancelAddKey(keyListCtx());
}

function addKey(code, label) {
    keyListModule.addKey(keyListCtx(), code, label);
}

function removeKey(code) {
    keyListModule.removeKey(keyListCtx(), code);
}

function clearAllKeys() {
    keyListModule.clearAllKeys(keyListCtx());
}

function updateKeyList() {
    keyListModule.updateKeyList(keyListCtx());
}

function selectKeyByCode(code) {
    keyListModule.selectKeyByCode(keyListCtx(), code);
}

function openKeyEditByCode(code) {
    keyListModule.openKeyEditByCode(keyListCtx(), code);
}

// ==================== 配置保存/加载 ====================

// 清理按键对象，只保留需要持久化的属性
function cleanKeyForSave(key) {
    return pureUtils.cleanKeyForSave(key);
}

function keyFromPersistedData(keyData) {
    return pureUtils.keyFromPersistedData(keyData, { onInvalidate: invalidateCanvas });
}

function snapshotKeysLayout() {
    return pureUtils.snapshotKeysLayout(keys);
}

function snapshotsLayoutEqual(a, b) {
    return pureUtils.snapshotsLayoutEqual(a, b);
}

function pushUndoCurrentState() {
    historyModule.pushUndoCurrentState(historyCtx());
}

function beginLayoutGesture() {
    historyModule.beginLayoutGesture(historyCtx());
}

function maybeCommitGestureHistory(didDragOrResize) {
    historyModule.maybeCommitGestureHistory(historyCtx(), didDragOrResize);
}

function applyKeysArrayFromSnapshot(snapshot) {
    historyModule.applyKeysArrayFromSnapshot(historyCtx(), snapshot);
}

function isLayoutUndoRedoShortcut(e) {
    return historyModule.isLayoutUndoRedoShortcut(e);
}

function undoLayout() {
    historyModule.undoLayout(historyCtx());
}

function redoLayout() {
    historyModule.redoLayout(historyCtx());
}

function updateUndoRedoButtons() {
    historyModule.updateUndoRedoButtons(historyCtx());
}

function resetLayoutHistory() {
    historyModule.resetLayoutHistory(historyCtx());
}

function buildCurrentConfigObject() {
    return pureUtils.buildCurrentConfigObject({
        keys,
        CONFIG,
        bgImage,
        bgPosition,
        bgScale,
        bgKeyOpacity,
        bgKeyOpacityPressed,
        bgKeyOpacityPressedUseUnpressed,
        bgNonKeyOpacity,
        getBgImageElement: () => byId('bg-image')
    });
}

async function refreshSavedConfigSelect() {
    await networkModule.refreshSavedConfigSelect({
        selectEl: byId('saved-config-select'),
        onNames: renderSavedConfigRepoList
    });
    syncObsProfileNameEverywhere(getCurrentConfigName());
    updateObsOverlayUrlField();
}

async function saveConfigToProject() {
    const profileName = getCurrentConfigName();
    if (
        hasSavedProfile(profileName) &&
        !confirm('将覆盖已有配置：configs/' + profileName + '.json\n\n是否继续保存？')
    ) {
        setObsFlowStatus('已取消保存。');
        return false;
    }
    const ok = await networkModule.saveConfigToProject({
        nameInput: { value: profileName },
        getCurrentConfig: () => {
            const o = buildCurrentConfigObject();
            return {
                ...o,
                meta: {
                    author: String(profileMeta.author || '').trim(),
                    updatedAt: new Date().toISOString()
                }
            };
        },
        onSaved: refreshSavedConfigSelect,
        retainNameInput: true,
        suppressSuccessAlert: true
    });
    if (ok) {
        currentConfigName = profileName;
        profileMeta = {
            author: String(profileMeta.author || '').trim(),
            updatedAt: new Date().toISOString()
        };
        try {
            capturePristineFingerprintBaseline();
        } catch (_) {
            lastPristineFingerprint = '';
            isConfigDirty = true;
        }
        syncObsProfileNameEverywhere(profileName);
        persistLastActiveProfile(profileName);
        scheduleBaselineResync();
        setObsFlowStatus('已保存配置：configs/' + profileName + '.json', 'success');
    }
    return ok;
}

async function loadSelectedProjectConfig() {
    const sel = byId('saved-config-select');
    if (!sel || !sel.value) {
        alert('请先从列表或下拉框选择一个配置');
        return false;
    }
    return loadProjectConfigByName(sel.value);
}

async function deleteSelectedProjectConfig() {
    const ok = await networkModule.deleteSelectedProjectConfig({
        selectEl: byId('saved-config-select'),
        onDeleted: refreshSavedConfigSelect
    });
    return ok;
}

async function openConfigsFolder() {
    const ok = await networkModule.openConfigsFolder();
    if (ok) {
        setObsFlowStatus('已尝试打开配置文件夹。把 .json 放进去后点「刷新列表」。', 'success');
    }
}

function loadSavedConfig() {
    configModule.loadSavedConfig({
        storage: localStorage,
        applyConfig
    });
}

function applyConfig(config) {
    configModule.applyConfig(config, {
        CONFIG,
        resetConfigDefaults: () => {
            Object.assign(CONFIG, DEFAULT_CONFIG_TEMPLATE);
        },
        keyFromPersistedData,
        setKeys: (nextKeys) => {
            keys = nextKeys;
        },
        setBgImage: (img) => {
            bgImage = img;
        },
        setBgPosition: (pos) => {
            bgPosition = pos;
        },
        setBgScale: (value) => {
            bgScale = value;
        },
        getBgScale: () => bgScale,
        setBgKeyOpacity: (value) => {
            bgKeyOpacity = value;
        },
        getBgKeyOpacity: () => bgKeyOpacity,
        setBgKeyOpacityPressed: (value) => {
            bgKeyOpacityPressed = value;
        },
        getBgKeyOpacityPressed: () => bgKeyOpacityPressed,
        setBgKeyOpacityPressedUseUnpressed: (value) => {
            bgKeyOpacityPressedUseUnpressed = !!value;
        },
        getBgKeyOpacityPressedUseUnpressed: () => bgKeyOpacityPressedUseUnpressed,
        setBgNonKeyOpacity: (value) => {
            bgNonKeyOpacity = value;
        },
        getBgNonKeyOpacity: () => bgNonKeyOpacity,
        setInputValue,
        setChecked,
        setDisabled,
        setText,
        setStyle,
        setDisplay,
        setImageSrc,
        updateOpacityControlsVisibility,
        invalidateCanvas,
        syncCanvasSize: () => {
            if (canvas && CONFIG.canvasWidth && CONFIG.canvasHeight) {
                canvas.width = CONFIG.canvasWidth;
                canvas.height = CONFIG.canvasHeight;
                fitConsoleCanvasToPreviewStage();
            }
            syncPreviewCanvasDimensionUi();
        },
        ensureKeySizeDefaults: () => {
            keys.forEach((k) => {
                if (!k.width) k.width = CONFIG.keySize;
                if (!k.height) k.height = CONFIG.keySize;
            });
        },
        updateKeyList,
        resetLayoutHistory
    });
    toggleGlobalActiveColorUseInactive();
    toggleGlobalTextColorPressedUseUnpressed();
    toggleGlobalBorderColorPressedUseUnpressed();
    toggleKeyOpacityPressedUseUnpressed();
    toggleTextOpacityPressedUseUnpressed();
    toggleBorderOpacityPressedUseUnpressed();
    toggleBgKeyOpacityPressedUseUnpressed();
    if (config && typeof config === 'object' && config.meta && typeof config.meta === 'object') {
        profileMeta = {
            author: String(config.meta.author != null ? config.meta.author : '').trim(),
            updatedAt: String(config.meta.updatedAt != null ? config.meta.updatedAt : '').trim()
        };
    } else {
        profileMeta = { author: '', updatedAt: '' };
    }
}

// 配置保存说明（用户向）
function showConfigLocation() {
    const message = `配置保存说明：

1. 推荐操作流程（最简单）
   - 使用 start-keyboard.bat 启动后，用 http://localhost:8080 打开页面
   - 会自动载入你上次用的方案；没有的话会试「默认87键」，再没有则用内置模板
   - 在「配置」里点列表名字切换 → 到「外观」「键位」里改 → 回「配置」点「保存」
   - 想改名用「另存为」；当前名字看最上面 OBS 区域
   - 需要给 OBS 用时，点最上面的「保存并复制」最省事
   - 换电脑时把整个项目文件夹拷走即可带上这些 json

2. OBS 浏览器源（重要）
   - OBS 里的浏览器和桌面 Chrome 各记各的，控制台里改完不会自动出现在 OBS
   - 请用最上面输入框里的地址（/overlay?config=…）做浏览器源
   - 有没保存的改动时，「复制链接」仍是旧版本；建议「保存并复制」
   - 不要用本页主页地址当 OBS 源（会带整页编辑界面）

3. 浏览器本地缓存
   - 每次保存到项目时，会同时记在浏览器里
   - 同一浏览器再打开会尽量恢复上次方案（缓存须为含 keys 的 JSON；异常格式会丢弃以免盖住项目内配置）

4. 从别人发来的 json
   - 点「打开配置文件夹」，把 .json 文件放进去
   - 回到页面点「刷新列表」就能选到

5. 配置内容包含
   - 按键位置、大小、文字、单键颜色与背景图等
   - 全局透明度与颜色、全局背景图（多为 base64，文件会较大）
    `;

    alert(message);
}

// ==================== WebSocket 功能 ====================

function connectWebSocket() {
    networkModule.connectWebSocket({
        url: 'ws://localhost:8765',
        state: {
            get ws() {
                return ws;
            },
            set ws(v) {
                ws = v;
            },
            get wsConnected() {
                return wsConnected;
            },
            set wsConnected(v) {
                wsConnected = v;
            },
            get useWebSocket() {
                return useWebSocket;
            },
            set useWebSocket(v) {
                useWebSocket = v;
            },
            get wsReconnectTimerId() {
                return wsReconnectTimerId;
            },
            set wsReconnectTimerId(v) {
                wsReconnectTimerId = v;
            },
            get wsStatusFadeTimerId() {
                return wsStatusFadeTimerId;
            },
            set wsStatusFadeTimerId(v) {
                wsStatusFadeTimerId = v;
            },
            suppressStatus: IS_OVERLAY_MODE
        },
        pressedKeys,
        invalidateCanvas
    });
}

function handleWebSocketMessage(data) {
    networkModule.handleWebSocketMessage(data, pressedKeys, invalidateCanvas);
}

function showConnectionStatus(connected) {
    wsStatusFadeTimerId = networkModule.showConnectionStatus(connected, {
        wsStatusFadeTimerId
    });
}

// ==================== 吸附功能控制 ====================
function enableAllSnap() {
    snapControlsModule.enableAllSnap(snapConfig);
}

function disableAllSnap() {
    snapControlsModule.disableAllSnap(snapConfig);
}

function toggleSnapToEdges() {
    snapControlsModule.toggleSnapToEdges(snapConfig);
}

function toggleSnapToCenter() {
    snapControlsModule.toggleSnapToCenter(snapConfig);
}

function toggleSnapToAssist() {
    snapControlsModule.toggleSnapToAssist(snapConfig);
}

function updateSnapDistance(val) {
    snapControlsModule.updateSnapDistance(snapConfig, val);
}

function updateSnapAssistThreshold(val) {
    snapControlsModule.updateSnapAssistThreshold(snapConfig, val);
}

function updateSnapEdgesThreshold(val) {
    snapControlsModule.updateSnapEdgesThreshold(snapConfig, val);
}

function updateSnapCenterThreshold(val) {
    snapControlsModule.updateSnapCenterThreshold(snapConfig, val);
}
