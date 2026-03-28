/**
 * DOTA 键盘按键显示插件
 * 用于OBS直播时显示键盘按键状态
 */

// ==================== 配置 ====================
const CONFIG = {
    keySize: 50,
    keyGap: 5,
    keyOpacity: 0.8,
    activeColor: '#00ff00',
    inactiveColor: '#333333',
    textColor: '#ffffff',
    borderColor: '#555555',
    canvasWidth: 1200,
    canvasHeight: 400
};

// ==================== 状态 ====================
let keys = []; // 按键列表
let pressedKeys = new Set(); // 当前按下的按键
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

// OBS 快速预览态：记录切换前当前编辑态，便于一键回退
let obsFlowPreviewBaseConfig = null;
let obsFlowPreviewBaseProfileName = '';
let obsFlowPreviewActiveName = '';

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
const BUILTIN_DEFAULT_CONFIG_URL = 'configs/default.json';
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

function updateObsPreviewUiState() {
    const btn = byId('obs-back-to-current-btn');
    if (!btn) return;
    btn.disabled = !(obsFlowPreviewBaseConfig && obsFlowPreviewActiveName);
}

function getObsProfileNameForOverlayLink() {
    const obsNameInput = byId('obs-profile-name');
    const obsName = obsNameInput && obsNameInput.value ? String(obsNameInput.value).trim() : '';
    if (obsName) return obsName;

    const sel = byId('saved-config-select');
    const v = sel && sel.value ? String(sel.value).trim() : '';
    return v || configModule.OVERLAY_FALLBACK_PROFILE_NAME;
}

function getOverlayUrl() {
    const u = new URL(window.location.href);
    const profile = getObsProfileNameForOverlayLink();
    return `${u.origin}/overlay?config=${encodeURIComponent(profile)}`;
}

function updateObsOverlayUrlField() {
    const input = byId('obs-overlay-url');
    if (!input) return;
    input.value = getOverlayUrl();
}

function handleObsProfileInput() {
    updateObsOverlayUrlField();
}

async function useObsQuickProfile() {
    const quick = byId('obs-profile-quick-select');
    const input = byId('obs-profile-name');
    if (!quick || !input) return;
    const name = String(quick.value || '').trim();
    if (!name) return;

    if (!obsFlowPreviewBaseConfig) {
        obsFlowPreviewBaseConfig = buildCurrentConfigObject();
        obsFlowPreviewBaseProfileName = input && input.value ? String(input.value).trim() : '';
    }

    const loaded = await configModule.loadProjectConfigByName({
        name,
        applyConfig
    });
    if (!loaded) {
        setObsFlowStatus('读取配置失败：configs/' + name + '.json 不可用。', 'error');
        return;
    }

    input.value = name;
    obsFlowPreviewActiveName = name;
    updateObsOverlayUrlField();
    updateObsPreviewUiState();
    setObsFlowStatus(
        '正在预览 configs/' + name + '.json。可直接一键复制 OBS 地址；若要回到刚才编辑中的样子，点「回到当前编辑态」。',
        'success'
    );
}

function restoreObsCurrentConfig() {
    if (!obsFlowPreviewBaseConfig) {
        setObsFlowStatus('当前就是编辑态，无需回退。');
        return;
    }
    applyConfig(obsFlowPreviewBaseConfig);
    const input = byId('obs-profile-name');
    if (input) {
        input.value = obsFlowPreviewBaseProfileName;
    }
    obsFlowPreviewBaseConfig = null;
    obsFlowPreviewBaseProfileName = '';
    obsFlowPreviewActiveName = '';
    const quick = byId('obs-profile-quick-select');
    if (quick) quick.value = '';
    updateObsOverlayUrlField();
    syncObsQuickProfileSelect();
    updateObsPreviewUiState();
    setObsFlowStatus('已回到切换前的当前编辑态（未保存）。');
}

function syncObsQuickProfileSelect() {
    const quick = byId('obs-profile-quick-select');
    const saved = byId('saved-config-select');
    const input = byId('obs-profile-name');
    if (!quick || !saved) return;

    const current = input && input.value ? String(input.value).trim() : '';
    quick.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '从已保存配置中选择（可选）';
    quick.appendChild(opt0);

    Array.from(saved.options || []).forEach((opt) => {
        if (!opt.value) return;
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.value;
        quick.appendChild(o);
    });

    if (current && Array.from(quick.options).some((o) => o.value === current)) {
        quick.value = current;
    } else {
        quick.value = '';
    }
    if (obsFlowPreviewActiveName && Array.from(quick.options).some((o) => o.value === obsFlowPreviewActiveName)) {
        quick.value = obsFlowPreviewActiveName;
    }
    updateObsPreviewUiState();
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

function adoptSavedConfigAsObsProfile() {
    const sel = byId('saved-config-select');
    const input = byId('obs-profile-name');
    if (sel && input && sel.value) {
        input.value = sel.value;
    }
    updateObsOverlayUrlField();
    syncObsQuickProfileSelect();
    if (sel && sel.value) {
        setObsFlowStatus('已把「已保存配置」同步为 OBS 配置名：' + sel.value);
    }
    updateObsPreviewUiState();
}

async function quickSaveAndCopyObsUrl() {
    const input = byId('obs-profile-name');
    if (!input) return;
    const raw = String(input.value || '').trim();
    const profileName = raw || configModule.OVERLAY_FALLBACK_PROFILE_NAME;
    input.value = profileName;

    const saved = await networkModule.saveConfigToProject({
        nameInput: { value: profileName },
        getCurrentConfig: buildCurrentConfigObject,
        onSaved: refreshSavedConfigSelect,
        suppressSuccessAlert: true
    });
    if (!saved) return;

    const savedSelect = byId('saved-config-select');
    if (savedSelect) {
        const hit = Array.from(savedSelect.options || []).some((opt) => {
            if (opt.value === profileName) {
                savedSelect.value = profileName;
                return true;
            }
            return false;
        });
        if (!hit) savedSelect.value = '';
    }

    const copiedUrl = await copyObsOverlayUrl(false);
    setObsFlowStatus('完成：已保存 configs/' + profileName + '.json，并复制 OBS 地址。', 'success');
    console.log('OBS 地址已复制:', copiedUrl);
}

function switchConsoleTab(tabId) {
    const target = ['appearance', 'layout', 'config'].includes(tabId) ? tabId : 'appearance';

    const appearance = byId('tab-appearance');
    const layout = byId('tab-layout');
    const snap = byId('tab-snap');
    const config = byId('tab-config');

    if (appearance) appearance.classList.toggle('active', target === 'appearance');
    if (layout) layout.classList.toggle('active', target === 'layout');
    if (snap) snap.classList.toggle('active', target === 'layout');
    if (config) config.classList.toggle('active', target === 'config');

    const appearanceBtn = byId('tab-btn-appearance');
    const layoutBtn = byId('tab-btn-layout');
    const configBtn = byId('tab-btn-config');
    if (appearanceBtn) appearanceBtn.classList.toggle('active', target === 'appearance');
    if (layoutBtn) layoutBtn.classList.toggle('active', target === 'layout');
    if (configBtn) configBtn.classList.toggle('active', target === 'config');
}

function fitConsoleCanvasToPreviewStage() {
    if (IS_OVERLAY_MODE || !canvas) return;
    const stage = byId('preview-stage');
    if (!stage) return;

    const stageStyle = getComputedStyle(stage);
    const padLeft = parseFloat(stageStyle.paddingLeft || '0') || 0;
    const padRight = parseFloat(stageStyle.paddingRight || '0') || 0;
    const available = Math.max(1200, Math.floor(stage.clientWidth - padLeft - padRight - 24));

    if (CONFIG.canvasWidth !== available) {
        CONFIG.canvasWidth = available;
        canvas.width = CONFIG.canvasWidth;
        canvas.height = CONFIG.canvasHeight;
        invalidateCanvas();
    }
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
    updateObsOverlayUrlField();
    switchConsoleTab('appearance');
    setupVerticalLayoutSplitter();

    canvas = document.getElementById('keyboard-canvas');
    ctx = canvas.getContext('2d');

    canvas.width = CONFIG.canvasWidth;
    canvas.height = CONFIG.canvasHeight;
    fitConsoleCanvasToPreviewStage();

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

    await loadBuiltinDefaultConfig();

    if (IS_OVERLAY_MODE) {
        await configModule.loadOverlayServerProfile({ applyConfig });
    } else {
        loadSavedConfig();
    }

    updateKeyList();
    invalidateCanvas();

    if (!IS_OVERLAY_MODE) {
        setupKeyEditModalListeners();
    }

    connectWebSocket();

    await refreshSavedConfigSelect();

    updateUndoRedoButtons();
    fitConsoleCanvasToPreviewStage();
});

/**
 * Load repo default layout from configs/default.json (requires same-origin HTTP, e.g. localhost:8080).
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

function drawKey(key) {
    // 检查是否处于预览状态（设置按下颜色时）
    const isPressed = pressedKeys.has(key.code) || key._previewPressed;
    const w = key.width || CONFIG.keySize;
    const h = key.height || CONFIG.keySize;

    // 获取颜色：优先使用按键自定义颜色，否则使用全局颜色
    const activeColor = key.activeColor || CONFIG.activeColor;
    const inactiveColor = key.inactiveColor || CONFIG.inactiveColor;
    
    // 获取透明度：优先使用按键自定义透明度，否则使用全局透明度
    const keyOpacity = key.opacity !== undefined ? key.opacity : CONFIG.keyOpacity;
    const bgOpacity = key.bgOpacity !== undefined ? key.bgOpacity : 1.0;

    ctx.save();

    // 创建圆角矩形路径用于裁剪
    ctx.beginPath();
    roundRect(ctx, key.x, key.y, w, h, 8);
    ctx.closePath();

    // 如果有按键独立背景图片，优先绘制
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
            const imgW = key._bgImageObj.width;
            const imgH = key._bgImageObj.height;
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
        ctx.drawImage(key._bgImageObj, 0, 0);
        ctx.restore();
        ctx.restore();
        
        // 绘制半透明颜色层（根据按下状态）
        ctx.save();
        ctx.clip();
        if (isPressed) {
            ctx.fillStyle = activeColor;
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = 15;
        } else {
            ctx.fillStyle = inactiveColor;
            ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = keyOpacity; // 颜色层只受按键透明度影响
        ctx.fill();
        ctx.restore();
    } else {
        // 按键背景（纯色）
        ctx.globalAlpha = keyOpacity;
        if (isPressed) {
            ctx.fillStyle = activeColor;
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = 15;
        } else {
            ctx.fillStyle = inactiveColor;
            ctx.shadowBlur = 0;
        }
        ctx.fill();
    }

    // 边框（应用按键透明度）
    ctx.globalAlpha = keyOpacity;
    ctx.strokeStyle = CONFIG.borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 拖动 / 缩放时绘制调整手柄
    if (key === draggedKey || key === resizingKey) {
        drawResizeHandles(key);
    }

    // 文字（应用按键透明度）
    ctx.shadowBlur = 0;
    ctx.globalAlpha = keyOpacity;
    ctx.fillStyle = CONFIG.textColor;
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
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
            invalidateCanvas
        },
        val
    );
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
        setBgNonKeyOpacity: (value) => {
            bgNonKeyOpacity = value;
        },
        invalidateCanvas
    });
}

// ==================== 颜色选择器功能 ====================
let currentColorTarget = null; // 'active' 或 'inactive'
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
        bgNonKeyOpacity,
        getBgImageElement: () => byId('bg-image')
    });
}

async function refreshSavedConfigSelect() {
    await networkModule.refreshSavedConfigSelect({
        selectEl: byId('saved-config-select')
    });
    syncObsQuickProfileSelect();
    updateObsOverlayUrlField();
}

async function saveConfigToProject() {
    const ok = await networkModule.saveConfigToProject({
        nameInput: byId('config-save-name'),
        getCurrentConfig: buildCurrentConfigObject,
        onSaved: refreshSavedConfigSelect
    });
    if (ok) {
        setObsFlowStatus('已保存到项目。可在顶部直接复制新的 OBS 地址。', 'success');
    }
    return ok;
}

function exportConfigJsonFile() {
    const config = buildCurrentConfigObject();
    configModule.exportConfigJsonFile(config);
}

async function loadSelectedProjectConfig() {
    const sel = byId('saved-config-select');
    await networkModule.loadSelectedProjectConfig({
        selectEl: sel,
        applyConfig
    });
    if (sel && sel.value) {
        const input = byId('obs-profile-name');
        if (input) input.value = sel.value;
        setObsFlowStatus('已加载配置：' + sel.value + '。可直接复制或一键保存并复制 OBS 地址。');
    }
    updateObsOverlayUrlField();
    syncObsQuickProfileSelect();
}

async function deleteSelectedProjectConfig() {
    return networkModule.deleteSelectedProjectConfig({
        selectEl: byId('saved-config-select'),
        onDeleted: refreshSavedConfigSelect
    });
}

function loadConfig(event) {
    configModule.loadConfigFromFile(event, applyConfig, refreshSavedConfigSelect);
}

/** 低于此版本的浏览器缓存会被忽略，避免旧版默认布局覆盖仓库 configs/default.json。 */
const PERSISTED_CONFIG_MIN_VERSION = configModule.PERSISTED_CONFIG_MIN_VERSION;

function loadSavedConfig() {
    configModule.loadSavedConfig({
        storage: localStorage,
        applyConfig
    });
}

function applyConfig(config) {
    configModule.applyConfig(config, {
        CONFIG,
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
        setBgNonKeyOpacity: (value) => {
            bgNonKeyOpacity = value;
        },
        getBgNonKeyOpacity: () => bgNonKeyOpacity,
        setInputValue,
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
}

// 配置保存说明（用户向）
function showConfigLocation() {
    const message = `配置保存说明：

1. 项目内配置（推荐）
   - 内置默认键位来自仓库内 configs/default.json（可编辑该文件改默认布局）
   - 使用 start-keyboard.bat 启动后，用 http://localhost:8080 打开页面
   - 在设置里填写名称，点「保存到项目」→ 写入本仓库 configs/ 目录（*.json）
   - 下拉框「刷新列表」后可选中并「加载所选」
   - 换电脑时把整个项目文件夹拷走即可带上这些 json

2. OBS 浏览器源（重要）
   - OBS 内嵌浏览器与桌面 Chrome 的 localStorage 不互通，不能指望「控制台里调好的样子」自动出现在 OBS
   - 推荐直接用页顶「⚡ 一键保存并复制 OBS 地址」：会保存到 configs/配置名.json 并复制带 ?config= 的链接
   - 若不走一键，也可手动保存一份名为 obs 的配置（configs/obs.json），叠加层会优先从服务端加载该文件
   - 请勿把控制台主页 http://localhost:8080/ 当作 OBS 源（会带整页 UI，且仍无本地缓存）

3. 浏览器本地缓存
   - 每次成功保存到项目或导出时，会同步写入当前浏览器的 localStorage
   - 同一浏览器再次打开页面会自动尝试恢复上次配置（配置版本 ≥5；更旧的缓存会被丢弃以免盖住新版默认布局）

4. 导出 / 导入文件
   - 「导出 JSON」：下载到本机任意位置，便于备份或发给别人
   - 「从文件加载」：选择 .json 文件导入（不经过 configs/ 目录也可以）

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
