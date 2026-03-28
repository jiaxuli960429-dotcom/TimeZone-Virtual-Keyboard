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
let keyBgViewMode = 'full'; // 独立背景显示模式: 'full' = 完整背景, 'clipped' = 只显示按键内
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

// 辅助对齐线相关
let snapLines = []; // 当前显示的对齐线
let isSnapping = false; // 是否正在吸附

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

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
    canvas = document.getElementById('keyboard-canvas');
    ctx = canvas.getContext('2d');

    canvas.width = CONFIG.canvasWidth;
    canvas.height = CONFIG.canvasHeight;

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

    // F2显示控制面板
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
            toggleControls();
        }
    });

    // 初始化透明度控件可见性
    updateOpacityControlsVisibility(false);

    // 初始化吸附功能参数设置条的可见性
    document.getElementById('snap-edges-controls').style.display = snapConfig.toEdges ? 'block' : 'none';
    document.getElementById('snap-center-controls').style.display = snapConfig.toCenter ? 'block' : 'none';
    document.getElementById('snap-assist-controls').style.display = snapConfig.toAssist ? 'block' : 'none';

    await loadBuiltinDefaultConfig();

    loadSavedConfig();

    updateKeyList();
    invalidateCanvas();

    setupKeyEditModalListeners();

    connectWebSocket();

    refreshSavedConfigSelect();
});

/**
 * Load repo default layout from configs/default.json (requires same-origin HTTP, e.g. localhost:8080).
 */
async function loadBuiltinDefaultConfig() {
    try {
        const r = await fetch(BUILTIN_DEFAULT_CONFIG_URL, { cache: 'no-store' });
        if (!r.ok) {
            throw new Error('HTTP ' + r.status);
        }
        const config = await r.json();
        applyConfig(config);
    } catch (e) {
        console.warn(
            '未加载 configs/default.json（请用 http://localhost:8080 打开页面；若用 file:// 打开则无内置布局）。将使用空按键列表。',
            e
        );
        keys = [];
    }
}

// ==================== 渲染 ====================
function invalidateCanvas() {
    if (canvasRafId !== null) return;
    canvasRafId = requestAnimationFrame(render);
}

function render() {
    canvasRafId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制背景图片（分层透明度效果）
    if (bgImage) {
        // 1. 先绘制完整的背景图片（非按键区域）
        ctx.save();
        ctx.globalAlpha = bgNonKeyOpacity;
        ctx.translate(bgPosition.x, bgPosition.y);
        ctx.scale(bgScale, bgScale);
        ctx.drawImage(
            bgImage,
            0,
            0,
            bgImage.width,
            bgImage.height
        );
        ctx.restore();

        // 2. 用按键形状作为遮罩，绘制按键区域的背景图片
        // 为每个按键单独绘制，这样可以确保所有按键都生效
        keys.forEach(key => {
            const w = key.width || CONFIG.keySize;
            const h = key.height || CONFIG.keySize;
            
            ctx.save();
            ctx.globalAlpha = bgKeyOpacity;
            
            // 创建按键形状的遮罩
            ctx.beginPath();
            roundRect(ctx, key.x, key.y, w, h, 8);
            ctx.clip();
            
            // 绘制背景图片
            ctx.translate(bgPosition.x, bgPosition.y);
            ctx.scale(bgScale, bgScale);
            ctx.drawImage(
                bgImage,
                0,
                0,
                bgImage.width,
                bgImage.height
            );
            
            ctx.restore();
        });
    }

    // 绘制按键
    // 如果有正在编辑的按键，先绘制其他按键，最后绘制编辑的按键（确保其独立背景在最上层）
    if (editingKey) {
        // 先绘制非编辑的按键
        keys.filter(key => key !== editingKey).forEach(key => {
            drawKey(key);
        });
        // 最后绘制正在编辑的按键（在最上层）
        drawKey(editingKey);
    } else {
        // 没有编辑时，正常绘制所有按键
        keys.forEach(key => {
            drawKey(key);
        });
    }

    // 绘制辅助对齐线
    drawSnapLines();

    const needsNextFrame =
        draggedKey !== null ||
        resizingKey !== null ||
        isDraggingBg ||
        isDraggingKeyBg ||
        snapLines.length > 0;
    if (needsNextFrame) {
        invalidateCanvas();
    }
}

// 绘制辅助对齐线
function drawSnapLines() {
    if (snapLines.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#FF6B6B'; // 红色对齐线
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]); // 虚线

    snapLines.forEach(line => {
        ctx.beginPath();
        if (line.type === 'horizontal') {
            // 绘制水平辅助线，显示在正确的y位置
            ctx.moveTo(0, line.y);
            ctx.lineTo(canvas.width, line.y);
        } else {
            // 绘制垂直辅助线，显示在正确的x位置
            ctx.moveTo(line.x, 0);
            ctx.lineTo(line.x, canvas.height);
        }
        ctx.stroke();
    });

    ctx.restore();
}

// 计算对齐线和吸附位置
function calculateSnap(key, isResize = false, resizeHandle = null) {
    // 如果吸附功能未启用，直接返回原始位置
    if (!snapConfig.enabled) {
        const w = key.width || CONFIG.keySize;
        const h = key.height || CONFIG.keySize;
        return {
            snapLines: [],
            adjustedX: key.x,
            adjustedY: key.y,
            adjustedW: w,
            adjustedH: h
        };
    }

    const w = key.width || CONFIG.keySize;
    const h = key.height || CONFIG.keySize;

    // 当前按键的边和中线
    let currentEdges = {
        left: key.x,
        right: key.x + w,
        top: key.y,
        bottom: key.y + h,
        centerX: key.x + w / 2,
        centerY: key.y + h / 2
    };

    let lines = [];
    let snapX = key.x;
    let snapY = key.y;
    let snapW = w;
    let snapH = h;
    let snapped = false;

    // 收集所有其他按键的边和中线
    const otherKeys = keys.filter(k => k !== key);
    const allEdges = [];

    otherKeys.forEach(k => {
        const kw = k.width || CONFIG.keySize;
        const kh = k.height || CONFIG.keySize;
        
        // 根据配置添加边缘
        if (snapConfig.toEdges) {
            allEdges.push(
                { type: 'x', value: k.x, label: 'left' },
                { type: 'x', value: k.x + kw, label: 'right' },
                { type: 'y', value: k.y, label: 'top' },
                { type: 'y', value: k.y + kh, label: 'bottom' }
            );
        }
        
        // 根据配置添加中心
        if (snapConfig.toCenter) {
            allEdges.push(
                { type: 'x', value: k.x + kw / 2, label: 'centerX' },
                { type: 'y', value: k.y + kh / 2, label: 'centerY' }
            );
        }
    });



    // 确定调整大小时需要检测的边
    let edgesToCheckX = [];
    let edgesToCheckY = [];

    if (isResize && resizeHandle) {
        // 根据调整手柄确定需要检测的边
        if (resizeHandle.includes('w')) edgesToCheckX.push('left');
        if (resizeHandle.includes('e')) edgesToCheckX.push('right');
        if (resizeHandle.includes('n')) edgesToCheckY.push('top');
        if (resizeHandle.includes('s')) edgesToCheckY.push('bottom');
    } else {
        // 移动模式下，根据配置确定需要检测的边
        if (snapConfig.toEdges) {
            edgesToCheckX.push('left', 'right');
            edgesToCheckY.push('top', 'bottom');
        }
        if (snapConfig.toCenter) {
            edgesToCheckX.push('centerX');
            edgesToCheckY.push('centerY');
        }
    }

    // 检查水平对齐（X轴）
    if (snapConfig.toEdges || snapConfig.toCenter) {
        for (let edge of edgesToCheckX) {
            let currentValue = currentEdges[edge];
            // 根据边缘类型选择阈值
            const threshold = edge === 'centerX' ? snapConfig.thresholds.center : snapConfig.thresholds.edges;
            for (let target of allEdges.filter(e => e.type === 'x')) {
                if (Math.abs(currentValue - target.value) <= threshold) {
                    lines.push({ type: 'vertical', x: target.value });

                    // 计算吸附后的位置和大小
                    if (!isResize) {
                        // 移动模式
                        if (edge === 'left') snapX = target.value;
                        else if (edge === 'right') snapX = target.value - w;
                        else if (edge === 'centerX') snapX = target.value - w / 2;
                    } else {
                        // 调整大小模式
                        if (edge === 'left') {
                            // 左边吸附，调整宽度和位置
                            const newLeft = target.value;
                            snapW = currentEdges.right - newLeft;
                            snapX = newLeft;
                        } else if (edge === 'right') {
                            // 右边吸附，只调整宽度
                            snapW = target.value - currentEdges.left;
                        }
                    }
                    snapped = true;
                    break;
                }
            }
            if (snapped) break;
        }
    }

    // 检查垂直对齐（Y轴）
    if (snapConfig.toEdges || snapConfig.toCenter) {
        snapped = false;
        for (let edge of edgesToCheckY) {
            let currentValue = currentEdges[edge];
            // 根据边缘类型选择阈值
            const threshold = edge === 'centerY' ? snapConfig.thresholds.center : snapConfig.thresholds.edges;
            for (let target of allEdges.filter(e => e.type === 'y')) {
                if (Math.abs(currentValue - target.value) <= threshold) {
                    lines.push({ type: 'horizontal', y: target.value });

                    // 计算吸附后的位置和大小
                    if (!isResize) {
                        // 移动模式
                        if (edge === 'top') snapY = target.value;
                        else if (edge === 'bottom') snapY = target.value - h;
                        else if (edge === 'centerY') snapY = target.value - h / 2;
                    } else {
                        // 调整大小模式
                        if (edge === 'top') {
                            // 顶边吸附，调整高度和位置
                            const newTop = target.value;
                            snapH = currentEdges.bottom - newTop;
                            snapY = newTop;
                        } else if (edge === 'bottom') {
                            // 底边吸附，只调整高度
                            snapH = target.value - currentEdges.top;
                        }
                    }
                    snapped = true;
                    break;
                }
            }
            if (snapped) break;
        }
    }

    // 检查辅助排列距离吸附（只在移动模式下）
    if (!isResize && !snapped && snapConfig.enabled && snapConfig.toAssist) {
        // 为每个按键的边缘添加辅助排列距离的吸附点
        for (let k of otherKeys) {
            const kw = k.width || CONFIG.keySize;
            const kh = k.height || CONFIG.keySize;
            
            // 计算辅助排列距离的吸附点
            const distance = snapConfig.distance;
            const thresholds = snapConfig.thresholds.assist;
            
            // 水平方向的辅助吸附点（只针对边缘）
            const leftAssist = k.x - distance - w;
            const rightAssist = (k.x + kw) + distance;
            
            // 垂直方向的辅助吸附点（只针对边缘）
            const topAssist = k.y - distance - h;
            const bottomAssist = (k.y + kh) + distance;
            
            // 检查水平辅助吸附（只针对边缘）
            if (Math.abs(key.x - leftAssist) <= thresholds) {
                // 显示两条垂直辅助线：左边按键的右侧边缘和当前按键的左侧边缘
                lines.push({ type: 'vertical', x: k.x + kw });
                lines.push({ type: 'vertical', x: leftAssist });
                snapX = leftAssist;
                snapped = true;
                break;
            } else if (Math.abs(key.x - rightAssist) <= thresholds) {
                // 显示两条垂直辅助线：左边按键的右侧边缘和当前按键的左侧边缘
                lines.push({ type: 'vertical', x: k.x + kw });
                lines.push({ type: 'vertical', x: rightAssist });
                snapX = rightAssist;
                snapped = true;
                break;
            }
            
            // 检查垂直辅助吸附（只针对边缘）
            if (Math.abs(key.y - topAssist) <= thresholds) {
                // 显示两条水平辅助线：上边按键的底部边缘和当前按键的顶部边缘
                lines.push({ type: 'horizontal', y: k.y + kh });
                lines.push({ type: 'horizontal', y: topAssist });
                snapY = topAssist;
                snapped = true;
                break;
            } else if (Math.abs(key.y - bottomAssist) <= thresholds) {
                // 显示两条水平辅助线：上边按键的底部边缘和当前按键的顶部边缘
                lines.push({ type: 'horizontal', y: k.y + kh });
                lines.push({ type: 'horizontal', y: bottomAssist });
                snapY = bottomAssist;
                snapped = true;
                break;
            }
        }
    }

    return {
        snapLines: lines,
        adjustedX: snapX,
        adjustedY: snapY,
        adjustedW: Math.max(20, snapW),
        adjustedH: Math.max(20, snapH)
    };
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

    // 如果是选中状态，绘制调整手柄
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
function handleKeyDown(e) {
    // 如果正在添加按键，始终处理本地事件（不管 WebSocket 是否连接）
    if (isAddingKey) {
        e.preventDefault(); // 阻止默认行为（防止 F1、F5 等触发快捷键）
        e.stopPropagation();
        addKey(e.code, e.key.toUpperCase());
        isAddingKey = false;
        document.getElementById('add-key-hint').style.display = 'none';
        return;
    }

    // 如果 WebSocket 已连接，不处理本地键盘事件（避免与 WebSocket 重复）
    // F2 显示/隐藏面板由下方专用 keydown 监听器统一处理（勿在此处再 toggle，否则会触发两次）
    if (wsConnected && useWebSocket) {
        return;
    }

    // 本地模式下的原有逻辑
    pressedKeys.add(e.code);
    invalidateCanvas();
}

function handleKeyUp(e) {
    // 如果正在添加按键，不处理
    if (isAddingKey) {
        return;
    }

    // 如果 WebSocket 已连接，不处理本地键盘事件
    if (wsConnected && useWebSocket) {
        return;
    }

    pressedKeys.delete(e.code);
    invalidateCanvas();
}

// ==================== 鼠标交互 ====================

// 检测鼠标位置对应的调整手柄
function getResizeHandle(key, x, y) {
    const w = key.width || CONFIG.keySize;
    const h = key.height || CONFIG.keySize;

    const handles = [
        { name: 'nw', x: key.x, y: key.y },
        { name: 'ne', x: key.x + w, y: key.y },
        { name: 'sw', x: key.x, y: key.y + h },
        { name: 'se', x: key.x + w, y: key.y + h }
    ];

    for (let handle of handles) {
        const dist = Math.sqrt(Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2));
        if (dist <= RESIZE_HANDLE_SIZE) {
            return handle.name;
        }
    }

    return null;
}

// 检测是否在边缘（用于调整大小）- 只在按键外部或边缘附近检测
function getEdgePosition(key, x, y) {
    const w = key.width || CONFIG.keySize;
    const h = key.height || CONFIG.keySize;

    // 扩展检测区域（边缘内外各RESIZE_EDGE_THRESHOLD像素）
    const leftEdge = key.x;
    const rightEdge = key.x + w;
    const topEdge = key.y;
    const bottomEdge = key.y + h;

    // 检查是否在按键的水平范围内（包括边缘扩展区）
    const inHorizontalRange = x >= leftEdge - RESIZE_EDGE_THRESHOLD && x <= rightEdge + RESIZE_EDGE_THRESHOLD;
    const inVerticalRange = y >= topEdge - RESIZE_EDGE_THRESHOLD && y <= bottomEdge + RESIZE_EDGE_THRESHOLD;

    // 如果不在按键附近，直接返回null
    if (!inHorizontalRange || !inVerticalRange) {
        return null;
    }

    // 检查是否在边缘上
    const onLeft = Math.abs(x - leftEdge) <= RESIZE_EDGE_THRESHOLD;
    const onRight = Math.abs(x - rightEdge) <= RESIZE_EDGE_THRESHOLD;
    const onTop = Math.abs(y - topEdge) <= RESIZE_EDGE_THRESHOLD;
    const onBottom = Math.abs(y - bottomEdge) <= RESIZE_EDGE_THRESHOLD;

    // 检查是否在按键内部（用于判断是否可以调整大小）
    const insideKey = x >= leftEdge && x <= rightEdge && y >= topEdge && y <= bottomEdge;

    // 只有在边缘上，或者在按键内部但靠近边缘时才返回调整方向
    if (onTop && onLeft) return 'nw';
    if (onTop && onRight) return 'ne';
    if (onBottom && onLeft) return 'sw';
    if (onBottom && onRight) return 'se';
    if (onTop && insideKey) return 'n';
    if (onBottom && insideKey) return 's';
    if (onLeft && insideKey) return 'w';
    if (onRight && insideKey) return 'e';

    return null;
}

// 更新鼠标光标样式
function updateCursor(position) {
    const cursorMap = {
        'nw': 'nw-resize',
        'ne': 'ne-resize',
        'sw': 'sw-resize',
        'se': 'se-resize',
        'n': 'n-resize',
        's': 's-resize',
        'w': 'w-resize',
        'e': 'e-resize'
    };

    if (position) {
        canvas.style.cursor = cursorMap[position];
        canvas.className = `cursor-resize-${position}`;
    } else {
        canvas.style.cursor = 'default';
        canvas.className = '';
    }
}

function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 从后往前找，优先选中上层的按键
    let clickedOnKey = false;
    let clickedKey = null;
    for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        const w = key.width || CONFIG.keySize;
        const h = key.height || CONFIG.keySize;

        // 检查是否在手柄上
        const handle = getResizeHandle(key, x, y);
        if (handle) {
            resizingKey = key;
            resizeHandle = handle;
            resizeStart = { x: x, y: y, w: w, h: h, keyX: key.x, keyY: key.y };
            clickedOnKey = true;
            invalidateCanvas();
            return;
        }

        // 检查是否在边缘
        const edge = getEdgePosition(key, x, y);
        if (edge) {
            resizingKey = key;
            resizeHandle = edge;
            resizeStart = { x: x, y: y, w: w, h: h, keyX: key.x, keyY: key.y };
            clickedOnKey = true;
            invalidateCanvas();
            return;
        }

        // 检查是否在按键内部
        if (x >= key.x && x <= key.x + w && y >= key.y && y <= key.y + h) {
            clickedKey = key;
            clickedOnKey = true;
            break;
        }
    }

    // 如果点击了按键
    if (clickedOnKey && clickedKey) {
        // 检查是否正在编辑某个按键
        if (editingKey) {
            // 编辑菜单打开时，只允许拖动正在编辑的按键
            if (clickedKey === editingKey) {
                // 无论是否有独立背景，按住按键内都拖动按键
                draggedKey = clickedKey;
                dragOffset.x = x - clickedKey.x;
                dragOffset.y = y - clickedKey.y;
            } else {
                // 编辑菜单打开时，禁用其他按键的拖动
                return;
            }
        } else {
            // 正常拖动按键
            draggedKey = clickedKey;
            dragOffset.x = x - clickedKey.x;
            dragOffset.y = y - clickedKey.y;
        }
        invalidateCanvas();
        return;
    }

    // 如果没有点击到按键
    // 检查是否正在编辑某个按键且有独立背景图片
    if (editingKey && editingKey.bgImage && editingKey._bgImageObj) {
        // 在空白区域拖动独立背景
        isDraggingKeyBg = true;
        draggedKeyBg = editingKey;
        keyBgDragOffset.x = x - (editingKey.x + (editingKey.bgOffsetX || 0));
        keyBgDragOffset.y = y - (editingKey.y + (editingKey.bgOffsetY || 0));
        canvas.style.cursor = 'move';
        invalidateCanvas();
        return;
    }

    // 编辑菜单打开时，即使没有独立背景，也禁用全局背景的拖动
    if (editingKey) {
        return;
    }

    // 如果没有点击到按键，且有全局背景图片，则拖拽全局背景
    if (bgImage) {
        isDraggingBg = true;
        bgDragOffset.x = x - bgPosition.x;
        bgDragOffset.y = y - bgPosition.y;
        canvas.style.cursor = 'move';
    }
    invalidateCanvas();
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 如果正在调整大小
    if (resizingKey) {
        const dx = x - resizeStart.x;
        const dy = y - resizeStart.y;

        let newW = resizeStart.w;
        let newH = resizeStart.h;
        let newX = resizeStart.keyX;
        let newY = resizeStart.keyY;

        // 根据调整方向计算新的大小和位置
        switch (resizeHandle) {
            case 'se':
            case 'e':
                newW = Math.max(20, resizeStart.w + dx);
                break;
            case 'sw':
            case 'w':
                newW = Math.max(20, resizeStart.w - dx);
                newX = resizeStart.keyX + dx;
                break;
            case 'ne':
            case 'n':
                newH = Math.max(20, resizeStart.h - dy);
                newY = resizeStart.keyY + dy;
                break;
            case 'nw':
                newW = Math.max(20, resizeStart.w - dx);
                newH = Math.max(20, resizeStart.h - dy);
                newX = resizeStart.keyX + dx;
                newY = resizeStart.keyY + dy;
                break;
            case 's':
                newH = Math.max(20, resizeStart.h + dy);
                break;
        }

        resizingKey.width = newW;
        resizingKey.height = newH;
        resizingKey.x = newX;
        resizingKey.y = newY;

        // 边界限制
        resizingKey.x = Math.max(0, Math.min(resizingKey.x, canvas.width - resizingKey.width));
        resizingKey.y = Math.max(0, Math.min(resizingKey.y, canvas.height - resizingKey.height));

        // 计算对齐线和吸附位置
        const snap = calculateSnap(resizingKey, true, resizeHandle);
        snapLines = snap.snapLines;

        // 应用吸附后的位置和大小
        resizingKey.x = snap.adjustedX;
        resizingKey.y = snap.adjustedY;
        resizingKey.width = snap.adjustedW;
        resizingKey.height = snap.adjustedH;

        // 更新编辑菜单中的数值
        updateEditMenuValues();

        invalidateCanvas();
        return;
    }

    // 如果正在拖拽按键
    if (draggedKey) {
        // 先计算原始位置
        let newX = x - dragOffset.x;
        let newY = y - dragOffset.y;

        // 临时设置位置用于计算对齐
        draggedKey.x = newX;
        draggedKey.y = newY;

        // 计算对齐线和吸附位置
        const snap = calculateSnap(draggedKey, false);
        snapLines = snap.snapLines;

        // 应用吸附后的位置
        draggedKey.x = snap.adjustedX;
        draggedKey.y = snap.adjustedY;

        // 边界限制
        draggedKey.x = Math.max(0, Math.min(draggedKey.x, canvas.width - (draggedKey.width || CONFIG.keySize)));
        draggedKey.y = Math.max(0, Math.min(draggedKey.y, canvas.height - (draggedKey.height || CONFIG.keySize)));

        // 更新编辑菜单中的数值
        updateEditMenuValues();

        invalidateCanvas();
        return;
    }

    // 如果正在拖拽背景
    if (isDraggingBg) {
        bgPosition.x = x - bgDragOffset.x;
        bgPosition.y = y - bgDragOffset.y;
        
        invalidateCanvas();
        return;
    }

    // 如果正在拖拽按键独立背景
    if (isDraggingKeyBg && draggedKeyBg) {
        draggedKeyBg.bgOffsetX = x - draggedKeyBg.x - keyBgDragOffset.x;
        draggedKeyBg.bgOffsetY = y - draggedKeyBg.y - keyBgDragOffset.y;
        
        invalidateCanvas();
        return;
    }

    // 检测鼠标悬停位置，更新光标
    let found = false;
    let hoveredKey = null;

    // 先找到鼠标所在的按键（从后往前，优先上层）
    for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        const w = key.width || CONFIG.keySize;
        const h = key.height || CONFIG.keySize;

        // 检查是否在按键范围内（包括边缘扩展区）
        const inRange = x >= key.x - RESIZE_EDGE_THRESHOLD &&
                       x <= key.x + w + RESIZE_EDGE_THRESHOLD &&
                       y >= key.y - RESIZE_EDGE_THRESHOLD &&
                       y <= key.y + h + RESIZE_EDGE_THRESHOLD;

        if (inRange) {
            hoveredKey = key;
            break;
        }
    }

    // 如果找到了按键，检测具体位置
    if (hoveredKey) {
        // 优先检查手柄
        const handle = getResizeHandle(hoveredKey, x, y);
        if (handle) {
            updateCursor(handle);
            found = true;
        } else {
            // 然后检查边缘
            const edge = getEdgePosition(hoveredKey, x, y);
            if (edge) {
                updateCursor(edge);
                found = true;
            } else {
                // 最后在内部显示移动光标
                const w = hoveredKey.width || CONFIG.keySize;
                const h = hoveredKey.height || CONFIG.keySize;
                if (x >= hoveredKey.x && x <= hoveredKey.x + w &&
                    y >= hoveredKey.y && y <= hoveredKey.y + h) {
                    canvas.style.cursor = 'move';
                    canvas.className = 'cursor-move';
                    found = true;
                }
            }
        }
    } else if (bgImage) {
        // 如果没有找到按键但有背景图片，显示移动光标
        canvas.style.cursor = 'move';
        found = true;
    }

    if (!found) {
        canvas.style.cursor = 'default';
        canvas.className = '';
    }
}

function handleMouseUp() {
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
let keyEditModalDrag = {
    isDragging: false,
    offsetX: 0,
    offsetY: 0
};

/** One-time listeners; handlers read `editingKey` when events fire (avoids duplicate binds on each open). */
function setupKeyEditModalListeners() {
    document.getElementById('edit-key-active-color').addEventListener('input', handleKeyActiveColorPreview);
    document.getElementById('edit-key-inactive-color').addEventListener('input', handleKeyInactiveColorPreview);
    document.getElementById('key-edit-drag-handle').addEventListener('mousedown', startDragKeyEditModal);
}

function openKeyEdit(key) {
    // 备份按键原始状态，用于取消操作
    editingKeyBackup = JSON.parse(JSON.stringify(key));
    
    editingKey = key;
    document.getElementById('edit-key-label').value = key.label;
    document.getElementById('edit-key-width').value = key.width || CONFIG.keySize;
    document.getElementById('edit-key-height').value = key.height || CONFIG.keySize;
    document.getElementById('edit-key-x').value = Math.round(key.x);
    document.getElementById('edit-key-y').value = Math.round(key.y);

    // 设置颜色复选框和颜色选择器
    const hasActiveColor = !!key.activeColor;
    const hasInactiveColor = !!key.inactiveColor;

    document.getElementById('use-global-active').checked = !hasActiveColor;
    document.getElementById('use-global-inactive').checked = !hasInactiveColor;

    document.getElementById('edit-key-active-color').value = key.activeColor || CONFIG.activeColor;
    document.getElementById('edit-key-inactive-color').value = key.inactiveColor || CONFIG.inactiveColor;

    document.getElementById('edit-key-active-color').disabled = !hasActiveColor;
    document.getElementById('edit-key-inactive-color').disabled = !hasInactiveColor;

    // 设置透明度（与全局一致：0=不透明，100=透明）
    const hasCustomOpacity = key.opacity !== undefined;
    document.getElementById('use-global-opacity').checked = !hasCustomOpacity;
    const opacityValue = key.opacity !== undefined ? key.opacity : CONFIG.keyOpacity;
    document.getElementById('edit-key-opacity').value = Math.round((1 - opacityValue) * 100);
    document.getElementById('edit-key-opacity-val').textContent = Math.round((1 - opacityValue) * 100);
    document.getElementById('edit-key-opacity').disabled = !hasCustomOpacity;
    
    // 设置背景图片透明度（0=不透明，100=透明）
    const bgOpacityRow = document.getElementById('key-bg-opacity-row');
    const bgModeRow = document.getElementById('key-bg-mode-row');
    const bgAdvancedRow = document.getElementById('key-bg-advanced-row');
    if (key.bgImage) {
        bgOpacityRow.style.display = 'flex';
        bgModeRow.style.display = 'flex';
        const bgOpacityValue = key.bgOpacity !== undefined ? key.bgOpacity : 1.0;
        document.getElementById('edit-key-bg-opacity').value = Math.round((1 - bgOpacityValue) * 100);
        document.getElementById('edit-key-bg-opacity-val').textContent = Math.round((1 - bgOpacityValue) * 100);
        
        // 初始化背景设置模式
        keyBgMode = key.bgMode || 'advanced';
        updateKeyBgModeUI();
        
        // 设置背景变换参数
        const bgScaleValue = key.bgScale !== undefined ? key.bgScale : 1.0;
        document.getElementById('edit-key-bg-scale').value = Math.round(bgScaleValue * 100);
        document.getElementById('edit-key-bg-scale-val').textContent = Math.round(bgScaleValue * 100);
    } else {
        bgOpacityRow.style.display = 'none';
        bgModeRow.style.display = 'none';
        bgAdvancedRow.style.display = 'none';
    }

    // 设置按键背景图片
    setupKeyBackgroundImageUI(key);

    // 重置弹窗位置到中心
    const modal = document.getElementById('key-edit-modal-content');
    modal.style.position = 'relative';
    modal.style.left = 'auto';
    modal.style.top = 'auto';
    modal.style.transform = 'none';

    // 重置背景显示模式为完整背景
    keyBgViewMode = 'full';
    const viewModeBtn = document.getElementById('toggle-bg-view-mode');
    if (viewModeBtn) {
        viewModeBtn.textContent = '显示模式: 完整背景';
    }

    document.getElementById('key-edit-modal').classList.remove('hidden');
    invalidateCanvas();
}

// 设置按键背景图片UI
function setupKeyBackgroundImageUI(key) {
    const fileInput = document.getElementById('edit-key-bg-image');
    const removeBtn = document.getElementById('remove-key-bg-btn');
    const previewDiv = document.getElementById('key-bg-preview');
    const previewImg = document.getElementById('key-bg-preview-img');
    
    // 清空文件输入
    fileInput.value = '';
    
    if (key.bgImage) {
        // 显示已有图片预览
        previewImg.src = key.bgImage;
        previewDiv.style.display = 'block';
        removeBtn.style.display = 'inline-block';
    } else {
        // 没有图片
        previewDiv.style.display = 'none';
        removeBtn.style.display = 'none';
    }
}

// 加载按键背景图片
function loadKeyBackgroundImage(event) {
    const file = event.target.files[0];
    if (!file || !editingKey) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageData = e.target.result;
        
        // 创建图片对象预加载
        const img = new Image();
        img.onload = () => {
            // 保存到按键
            editingKey.bgImage = imageData;
            editingKey._bgImageObj = img;
            
            // 设置默认背景透明度（1.0 = 不透明，对应滑块值 0）
            editingKey.bgOpacity = 1.0;
            
            // 更新UI
            const previewDiv = document.getElementById('key-bg-preview');
            const previewImg = document.getElementById('key-bg-preview-img');
            const removeBtn = document.getElementById('remove-key-bg-btn');
            const bgOpacityRow = document.getElementById('key-bg-opacity-row');
            const bgModeRow = document.getElementById('key-bg-mode-row');
            
            previewImg.src = imageData;
            previewDiv.style.display = 'block';
            removeBtn.style.display = 'inline-block';
            
            // 显示背景透明度控制（滑块 0 = 不透明）
            bgOpacityRow.style.display = 'flex';
            document.getElementById('edit-key-bg-opacity').value = 0;
            document.getElementById('edit-key-bg-opacity-val').textContent = 0;
            
            // 显示背景设置模式选择
            bgModeRow.style.display = 'flex';
            
            // 默认使用高级模式
            keyBgMode = 'advanced';
            if (editingKey) {
                editingKey.bgMode = 'advanced';
            }
            updateKeyBgModeUI();
            invalidateCanvas();
        };
        img.src = imageData;
    };
    reader.readAsDataURL(file);
}

// 删除按键背景图片
function removeKeyBackgroundImage() {
    if (!editingKey) return;
    
    // 删除按键的背景图片
    delete editingKey.bgImage;
    delete editingKey._bgImageObj;
    delete editingKey.bgOpacity;
    delete editingKey.bgMode;
    delete editingKey.bgScale;
    delete editingKey.bgOffsetX;
    delete editingKey.bgOffsetY;
    
    // 更新UI
    const fileInput = document.getElementById('edit-key-bg-image');
    const removeBtn = document.getElementById('remove-key-bg-btn');
    const previewDiv = document.getElementById('key-bg-preview');
    const bgOpacityRow = document.getElementById('key-bg-opacity-row');
    const bgModeRow = document.getElementById('key-bg-mode-row');
    const bgAdvancedRow = document.getElementById('key-bg-advanced-row');
    
    fileInput.value = '';
    previewDiv.style.display = 'none';
    removeBtn.style.display = 'none';
    bgOpacityRow.style.display = 'none';
    bgModeRow.style.display = 'none';
    bgAdvancedRow.style.display = 'none';
    invalidateCanvas();
}

// 切换按键透明度使用全局/自定义
function toggleKeyOpacity() {
    const useGlobal = document.getElementById('use-global-opacity').checked;
    const opacityInput = document.getElementById('edit-key-opacity');
    const opacityValue = document.getElementById('edit-key-opacity-val');
    
    if (useGlobal) {
        // 使用全局透明度时，同步滑块数值为全局透明度
        const globalOpacityValue = Math.round((1 - CONFIG.keyOpacity) * 100);
        opacityInput.value = globalOpacityValue;
        opacityValue.textContent = globalOpacityValue;
        opacityInput.disabled = true;
        
        // 清除按键的自定义透明度
        if (editingKey) {
            delete editingKey.opacity;
        }
    } else {
        // 不使用全局透明度时，启用滑块并设置按键透明度
        opacityInput.disabled = false;
        if (editingKey) {
            // 滑块值 0=不透明, 100=透明，转换为 opacity 值
            editingKey.opacity = (100 - parseInt(opacityInput.value)) / 100;
        }
    }
    invalidateCanvas();
}

// 更新按键透明度预览
function updateKeyOpacityPreview(value) {
    document.getElementById('edit-key-opacity-val').textContent = value;
    if (editingKey) {
        // 滑块值 0=不透明, 100=透明，转换为 opacity 值
        editingKey.opacity = (100 - parseInt(value)) / 100;
    }
    invalidateCanvas();
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
    document.getElementById('edit-key-bg-opacity-val').textContent = value;
    if (editingKey) {
        // 滑块值 0=不透明, 100=透明，转换为 opacity 值
        editingKey.bgOpacity = (100 - parseInt(value)) / 100;
    }
    invalidateCanvas();
}

// 更新按键背景缩放预览
function updateKeyBgScalePreview(value) {
    document.getElementById('edit-key-bg-scale-val').textContent = value;
    if (editingKey) {
        editingKey.bgScale = parseInt(value) / 100;
    }
    invalidateCanvas();
}

// 更新按键背景位置预览
function updateKeyBgPositionPreview() {
    const x = parseInt(document.getElementById('edit-key-bg-x').value) || 0;
    const y = parseInt(document.getElementById('edit-key-bg-y').value) || 0;
    document.getElementById('edit-key-bg-x-val').textContent = x;
    document.getElementById('edit-key-bg-y-val').textContent = y;
    if (editingKey) {
        editingKey.bgOffsetX = x;
        editingKey.bgOffsetY = y;
    }
    invalidateCanvas();
}

// 重置按键背景变换
function resetKeyBgTransform() {
    document.getElementById('edit-key-bg-scale').value = 100;
    document.getElementById('edit-key-bg-scale-val').textContent = 100;
    if (editingKey) {
        editingKey.bgScale = 1.0;
        editingKey.bgOffsetX = 0;
        editingKey.bgOffsetY = 0;
    }
    invalidateCanvas();
}

// 切换独立背景显示模式
function toggleKeyBgViewMode() {
    keyBgViewMode = keyBgViewMode === 'full' ? 'clipped' : 'full';
    const btn = document.getElementById('toggle-bg-view-mode');
    if (btn) {
        btn.textContent = keyBgViewMode === 'full' ? '显示模式: 完整背景' : '显示模式: 按键内裁剪';
    }
    invalidateCanvas();
}

// 设置背景设置模式
function setKeyBgMode(mode) {
    keyBgMode = mode;
    if (editingKey) {
        editingKey.bgMode = mode;
    }
    updateKeyBgModeUI();
    
    // 如果是简单模式，重置偏移（变形填满由渲染时自动计算）
    if (mode === 'simple' && editingKey) {
        editingKey.bgOffsetX = 0;
        editingKey.bgOffsetY = 0;
        // 简单模式下不使用bgScale，变形填满在drawKey中实时计算
    }
    invalidateCanvas();
}

// 更新背景设置模式UI
function updateKeyBgModeUI() {
    const simpleBtn = document.getElementById('key-bg-mode-simple');
    const advancedBtn = document.getElementById('key-bg-mode-advanced');
    const advancedRow = document.getElementById('key-bg-advanced-row');
    
    if (simpleBtn && advancedBtn) {
        if (keyBgMode === 'simple') {
            simpleBtn.classList.add('btn-primary');
            advancedBtn.classList.remove('btn-primary');
            advancedRow.style.display = 'none';
        } else {
            simpleBtn.classList.remove('btn-primary');
            advancedBtn.classList.add('btn-primary');
            advancedRow.style.display = 'flex';
        }
    }
}

function startDragKeyEditModal(e) {
    e.preventDefault();
    keyEditModalDrag.isDragging = true;
    const modal = document.getElementById('key-edit-modal-content');
    const rect = modal.getBoundingClientRect();
    keyEditModalDrag.offsetX = e.clientX - rect.left;
    keyEditModalDrag.offsetY = e.clientY - rect.top;
    
    // 将position改为fixed以便拖动
    modal.style.position = 'fixed';
    modal.style.left = rect.left + 'px';
    modal.style.top = rect.top + 'px';
    
    document.addEventListener('mousemove', dragKeyEditModal);
    document.addEventListener('mouseup', stopDragKeyEditModal);
}

function dragKeyEditModal(e) {
    if (!keyEditModalDrag.isDragging) return;
    
    const modal = document.getElementById('key-edit-modal-content');
    let newX = e.clientX - keyEditModalDrag.offsetX;
    let newY = e.clientY - keyEditModalDrag.offsetY;
    
    // 限制在窗口内
    const maxX = window.innerWidth - modal.offsetWidth;
    const maxY = window.innerHeight - modal.offsetHeight;
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    modal.style.left = newX + 'px';
    modal.style.top = newY + 'px';
}

function stopDragKeyEditModal() {
    keyEditModalDrag.isDragging = false;
    document.removeEventListener('mousemove', dragKeyEditModal);
    document.removeEventListener('mouseup', stopDragKeyEditModal);
}

function closeKeyEdit() {
    // 清除按键背景拖拽状态
    isDraggingKeyBg = false;
    draggedKeyBg = null;

    // 关闭弹窗
    document.getElementById('key-edit-modal').classList.add('hidden');
    editingKey = null;
    editingKeyBackup = null;
    invalidateCanvas();
}

function toggleKeyActiveColor() {
    const useGlobal = document.getElementById('use-global-active').checked;
    const colorInput = document.getElementById('edit-key-active-color');
    colorInput.disabled = useGlobal;
    
    // 如果启用自定义颜色，立即预览
    if (!useGlobal && editingKey) {
        editingKey.activeColor = colorInput.value;
        editingKey._previewPressed = true;
    }
    invalidateCanvas();
}

function toggleKeyInactiveColor() {
    const useGlobal = document.getElementById('use-global-inactive').checked;
    const colorInput = document.getElementById('edit-key-inactive-color');
    colorInput.disabled = useGlobal;
    
    // 如果启用自定义颜色，清除预览状态以显示未按下状态
    if (!useGlobal && editingKey) {
        editingKey.inactiveColor = colorInput.value;
        delete editingKey._previewPressed;
    }
    invalidateCanvas();
}

function handleKeyActiveColorPreview(e) {
    if (!editingKey) return;
    
    const color = e.target.value;
    editingKey.activeColor = color;
    editingKey._previewPressed = true;
    invalidateCanvas();
}

function handleKeyInactiveColorPreview(e) {
    if (!editingKey) return;
    
    const color = e.target.value;
    editingKey.inactiveColor = color;
    delete editingKey._previewPressed;
    invalidateCanvas();
}

function saveKeyEdit() {
    if (!editingKey) return;

    editingKey.label = document.getElementById('edit-key-label').value || editingKey.label;
    editingKey.width = parseInt(document.getElementById('edit-key-width').value) || CONFIG.keySize;
    editingKey.height = parseInt(document.getElementById('edit-key-height').value) || CONFIG.keySize;
    editingKey.x = parseInt(document.getElementById('edit-key-x').value) || 0;
    editingKey.y = parseInt(document.getElementById('edit-key-y').value) || 0;

    // 颜色设置
    const useGlobalActive = document.getElementById('use-global-active').checked;
    const useGlobalInactive = document.getElementById('use-global-inactive').checked;

    if (useGlobalActive) {
        delete editingKey.activeColor;
    } else {
        editingKey.activeColor = document.getElementById('edit-key-active-color').value;
    }

    if (useGlobalInactive) {
        delete editingKey.inactiveColor;
    } else {
        editingKey.inactiveColor = document.getElementById('edit-key-inactive-color').value;
    }

    // 透明度设置（滑块值 0=不透明, 100=透明）
    const useGlobalOpacity = document.getElementById('use-global-opacity').checked;
    if (useGlobalOpacity) {
        delete editingKey.opacity;
    } else {
        editingKey.opacity = (100 - parseInt(document.getElementById('edit-key-opacity').value)) / 100;
    }
    
    // 背景图片透明度设置（滑块值 0=不透明, 100=透明）
    if (editingKey.bgImage) {
        editingKey.bgOpacity = (100 - parseInt(document.getElementById('edit-key-bg-opacity').value)) / 100;
        // 简单模式下不保存手动设置的缩放和偏移
        if (keyBgMode === 'advanced') {
            editingKey.bgScale = parseInt(document.getElementById('edit-key-bg-scale').value) / 100;
        }
        editingKey.bgMode = keyBgMode;
    }

    // 清除预览状态
    delete editingKey._previewPressed;

    closeKeyEdit();
    updateKeyList();
}

function cancelKeyEdit() {
    if (!editingKey || !editingKeyBackup) return;
    
    // 恢复备份的按键状态
    const keyIndex = keys.findIndex(key => key.code === editingKey.code);
    if (keyIndex !== -1) {
        // 深拷贝恢复，保留_bgImageObj等非JSON可序列化属性
        const originalKey = keys[keyIndex];
        const restoredKey = JSON.parse(JSON.stringify(editingKeyBackup));
        
        // 保留原始的_bgImageObj（如果存在）
        if (originalKey._bgImageObj) {
            restoredKey._bgImageObj = originalKey._bgImageObj;
        }
        
        keys[keyIndex] = restoredKey;
    }
    
    closeKeyEdit();
    updateKeyList();
}

// ==================== 控制面板功能 ====================
function toggleControls() {
    const panel = document.getElementById('controls-panel');
    const btn = document.getElementById('toggle-controls');

    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        btn.textContent = '⚙️ 设置';
        refreshSavedConfigSelect();
    } else {
        panel.classList.add('hidden');
        btn.textContent = '⚙️ 设置';
    }
}

function hideControls() {
    document.getElementById('controls-panel').classList.add('hidden');
    document.getElementById('toggle-controls').textContent = '⚙️ 设置';
}

function updateOpacity(val) {
    CONFIG.keyOpacity = (100 - val) / 100;
    document.getElementById('key-opacity-val').textContent = val;
    invalidateCanvas();
}

// ==================== 背景图片功能 ====================

function loadBackground(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        bgImage = new Image();
        bgImage.onload = () => {
            document.getElementById('bg-image').src = e.target.result;
            document.getElementById('bg-image').style.display = 'block';
            // 显示删除按钮
            document.getElementById('remove-bg-btn').style.display = 'inline-block';
            // 显示背景相关控件，隐藏按键透明度
            updateOpacityControlsVisibility(true);
            invalidateCanvas();
        };
        bgImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function updateOpacityControlsVisibility(hasBackground) {
    // 根据是否有背景图更新透明度控件的可见性
    const controlGroups = document.querySelectorAll('.control-group');
    
    controlGroups.forEach((group) => {
        const label = group.querySelector('label');
        if (label) {
            const labelText = label.textContent;
            const isBackgroundControl = 
                labelText.includes('背景缩放') ||
                labelText.includes('按键区域背景透明度') ||
                labelText.includes('非按键区域背景透明度');
            
            const isKeyOpacityControl = labelText.includes('按键透明度');
            
            if (isBackgroundControl) {
                // 背景相关控件：有背景图时显示，无背景图时隐藏
                group.style.display = hasBackground ? 'block' : 'none';
            } else if (isKeyOpacityControl) {
                // 按键透明度控件：始终显示
                group.style.display = 'block';
            }
        }
    });
}

function updateBgScale(val) {
    bgScale = parseInt(val) / 100;
    document.getElementById('bg-scale-val').textContent = val;
    invalidateCanvas();
}

function updateBgKeyOpacity(val) {
    bgKeyOpacity = (100 - val) / 100;
    document.getElementById('bg-key-opacity-val').textContent = val;
    invalidateCanvas();
}

function updateBgNonKeyOpacity(val) {
    bgNonKeyOpacity = (100 - val) / 100;
    document.getElementById('bg-non-key-opacity-val').textContent = val;
    invalidateCanvas();
}

function removeBackground() {
    // 删除背景图片
    bgImage = null;
    document.getElementById('bg-image').src = '';
    document.getElementById('bg-image').style.display = 'none';
    bgPosition = { x: 0, y: 0 };
    bgScale = 1.0;
    bgKeyOpacity = 0.8;
    bgNonKeyOpacity = 0.8;
    
    // 重置UI
    document.getElementById('bg-scale').value = 100;
    document.getElementById('bg-scale-val').textContent = 100;
    document.getElementById('bg-key-opacity').value = 80;
    document.getElementById('bg-key-opacity-val').textContent = 80;
    document.getElementById('bg-non-key-opacity').value = 20;
    document.getElementById('bg-non-key-opacity-val').textContent = 20;
    
    // 清空文件输入框，这样同一幅图可以再次选择
    document.getElementById('bg-upload').value = '';
    
    // 隐藏删除按钮
    document.getElementById('remove-bg-btn').style.display = 'none';
    
    // 隐藏背景相关控件，显示按键透明度
    updateOpacityControlsVisibility(false);
    invalidateCanvas();
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
    const container = document.getElementById('classic-colors');
    container.innerHTML = '';
    
    CLASSIC_COLORS.forEach(color => {
        const colorBox = document.createElement('div');
        colorBox.style.cssText = `
            width: 24px;
            height: 24px;
            background-color: ${color};
            border-radius: 4px;
            cursor: pointer;
            border: 2px solid #555;
            transition: transform 0.2s;
        `;
        colorBox.onmouseover = () => colorBox.style.transform = 'scale(1.1)';
        colorBox.onmouseout = () => colorBox.style.transform = 'scale(1)';
        colorBox.onclick = () => selectColor(color);
        container.appendChild(colorBox);
    });
}

// 更新历史颜色显示
function updateHistoryColors() {
    const container = document.getElementById('history-colors');
    const section = document.getElementById('history-colors-section');
    container.innerHTML = '';
    
    if (colorHistory.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    
    colorHistory.forEach(color => {
        const colorBox = document.createElement('div');
        colorBox.style.cssText = `
            width: 24px;
            height: 24px;
            background-color: ${color};
            border-radius: 4px;
            cursor: pointer;
            border: 2px solid #555;
            transition: transform 0.2s;
        `;
        colorBox.onmouseover = () => colorBox.style.transform = 'scale(1.1)';
        colorBox.onmouseout = () => colorBox.style.transform = 'scale(1)';
        colorBox.onclick = () => selectColor(color);
        container.appendChild(colorBox);
    });
}

// 添加颜色到历史记录
function addToHistory(color) {
    // 移除重复的颜色
    colorHistory = colorHistory.filter(c => c !== color);
    // 添加到开头
    colorHistory.unshift(color);
    // 限制数量
    if (colorHistory.length > MAX_HISTORY) {
        colorHistory = colorHistory.slice(0, MAX_HISTORY);
    }
}

// 选择颜色
function selectColor(color) {
    const input = document.getElementById('color-picker-input');
    
    // 如果颜色发生变化，将旧颜色加入历史记录
    const oldColor = input.value;
    if (color !== oldColor) {
        addToHistory(oldColor);
        updateHistoryColors();
        lastSelectedColor = color;
    }
    
    input.value = color;
    
    // 触发预览
    handleColorPreview({ target: { value: color } });
}

function openColorPicker(target) {
    // 如果颜色选择器已经打开，先关闭它（这会清除之前的预览状态）
    const modal = document.getElementById('color-picker-modal');
    if (!modal.classList.contains('hidden')) {
        closeColorPicker();
    }
    
    currentColorTarget = target;
    const input = document.getElementById('color-picker-input');
    const title = document.getElementById('color-picker-title');
    
    // 设置标题
    title.textContent = target === 'active' ? '选择按下颜色' : '选择未按下颜色';
    
    // 获取当前颜色
    const currentColor = target === 'active' ? CONFIG.activeColor : CONFIG.inactiveColor;
    input.value = currentColor;
    originalColor = currentColor; // 保存原始颜色
    lastSelectedColor = currentColor; // 初始化上一次选择的颜色
    
    // 如果是设置按下颜色，临时将所有按键设为按下状态以便预览
    if (target === 'active') {
        previewActiveState = true;
        // 临时将所有按键标记为按下
        keys.forEach(key => {
            key._previewPressed = true;
        });
    } else {
        previewActiveState = false;
    }
    
    // 初始化经典颜色
    initClassicColors();
    
    // 更新历史颜色
    updateHistoryColors();
    
    // 显示弹窗
    modal.classList.remove('hidden');
    invalidateCanvas();

    // 添加实时预览监听
    input.addEventListener('input', handleColorPreview);
    
    // 添加change事件监听（颜色选择器松开鼠标时）
    input.addEventListener('change', handleColorChange);
}

function handleColorPreview(e) {
    const color = e.target.value;
    
    // 实时更新预览（不添加历史记录）
    if (currentColorTarget === 'active') {
        CONFIG.activeColor = color;
        document.getElementById('active-color-preview').style.backgroundColor = color;
    } else {
        CONFIG.inactiveColor = color;
        document.getElementById('inactive-color-preview').style.backgroundColor = color;
    }
    invalidateCanvas();
}

function handleColorChange(e) {
    const color = e.target.value;
    
    // 颜色选择器松开鼠标时，将旧颜色加入历史记录
    if (color !== lastSelectedColor) {
        addToHistory(lastSelectedColor);
        updateHistoryColors();
        lastSelectedColor = color;
    }
}

function confirmColorPick() {
    const input = document.getElementById('color-picker-input');
    const color = input.value;
    
    // 确认颜色选择
    if (currentColorTarget === 'active') {
        CONFIG.activeColor = color;
        document.getElementById('active-color-preview').style.backgroundColor = color;
    } else {
        CONFIG.inactiveColor = color;
        document.getElementById('inactive-color-preview').style.backgroundColor = color;
    }
    
    // 关闭弹窗并清理
    closeColorPicker();
}

function cancelColorPick() {
    // 恢复原始颜色
    if (currentColorTarget === 'active') {
        CONFIG.activeColor = originalColor;
        document.getElementById('active-color-preview').style.backgroundColor = originalColor;
    } else {
        CONFIG.inactiveColor = originalColor;
        document.getElementById('inactive-color-preview').style.backgroundColor = originalColor;
    }
    
    // 关闭弹窗并清理
    closeColorPicker();
}

function closeColorPicker() {
    const modal = document.getElementById('color-picker-modal');
    const input = document.getElementById('color-picker-input');
    
    // 移除事件监听
    input.removeEventListener('input', handleColorPreview);
    input.removeEventListener('change', handleColorChange);
    
    // 清除预览状态
    if (previewActiveState) {
        keys.forEach(key => {
            delete key._previewPressed;
        });
        previewActiveState = false;
    }
    
    // 隐藏弹窗
    modal.classList.add('hidden');
    
    // 重置状态
    currentColorTarget = null;
    originalColor = null;
    lastSelectedColor = null;
    invalidateCanvas();
}

// ==================== 按键管理 ====================
function startAddKey() {
    isAddingKey = true;
    document.getElementById('add-key-hint').style.display = 'block';
}

function cancelAddKey() {
    isAddingKey = false;
    document.getElementById('add-key-hint').style.display = 'none';
}

function addKey(code, label) {
    // 检查是否已存在
    if (keys.some(k => k.code === code)) {
        alert('该按键已存在！');
        return;
    }

    const newKey = {
        code: code,
        label: label.length > 3 ? code.replace('Key', '').replace('Digit', '') : label,
        x: 100,
        y: 100,
        width: CONFIG.keySize,
        height: CONFIG.keySize
    };

    keys.push(newKey);
    updateKeyList();

    // 自动打开编辑窗口
    openKeyEdit(newKey);
}

function removeKey(code) {
    keys = keys.filter(k => k.code !== code);
    updateKeyList();
    invalidateCanvas();
}

function clearAllKeys() {
    if (confirm('确定要清空所有按键吗？')) {
        keys = [];
        updateKeyList();
        invalidateCanvas();
    }
}

function updateKeyList() {
    const list = document.getElementById('key-list');
    list.innerHTML = '';

    keys.forEach(key => {
        const item = document.createElement('div');
        item.className = 'key-item';
        item.innerHTML = `
            <span style="cursor:pointer;" onclick="openKeyEditByCode('${key.code}')" ondblclick="removeKey('${key.code}')">
                ${key.label} [${key.width || 50}x${key.height || 50}] - (${Math.round(key.x)}, ${Math.round(key.y)})
            </span>
            <button class="btn btn-danger" onclick="removeKey('${key.code}')">Delete</button>
        `;
        list.appendChild(item);
    });
}

function openKeyEditByCode(code) {
    const key = keys.find(k => k.code === code);
    if (key) {
        openKeyEdit(key);
    }
}

// ==================== 配置保存/加载 ====================

// 需要保存的按键属性列表
const KEY_PERSISTENT_PROPS = [
    'code', 'label', 'x', 'y', 'width', 'height',
    'activeColor', 'inactiveColor', 'opacity',
    'bgImage', 'bgOpacity', 'bgScale', 'bgOffsetX', 'bgOffsetY', 'bgMode'
];

// 清理按键对象，只保留需要持久化的属性
function cleanKeyForSave(key) {
    const cleaned = {};
    KEY_PERSISTENT_PROPS.forEach(prop => {
        if (key[prop] !== undefined) {
            cleaned[prop] = key[prop];
        }
    });
    return cleaned;
}

function buildCurrentConfigObject() {
    const cleanedKeys = keys.map(cleanKeyForSave);
    return {
        version: 4,
        keys: cleanedKeys,
        config: CONFIG,
        bgImage: bgImage ? document.getElementById('bg-image').src : '',
        bgPosition: bgPosition,
        bgScale: bgScale,
        bgKeyOpacity: bgKeyOpacity,
        bgNonKeyOpacity: bgNonKeyOpacity
    };
}

async function refreshSavedConfigSelect() {
    const sel = document.getElementById('saved-config-select');
    if (!sel) return;
    try {
        const r = await fetch('/api/configs');
        if (!r.ok) throw new Error('bad status');
        const data = await r.json();
        const names = data.names || [];
        sel.innerHTML = '';
        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = names.length ? '-- 选择已保存配置 --' : '-- 暂无，请先「保存到项目」--';
        sel.appendChild(opt0);
        names.forEach((name) => {
            const o = document.createElement('option');
            o.value = name;
            o.textContent = name;
            sel.appendChild(o);
        });
    } catch (e) {
        console.warn('配置列表不可用（请用 start-keyboard.bat 启动，并以 http://localhost:8080 打开）', e);
        sel.innerHTML = '';
        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = '-- 需本机 HTTP 服务（见控制台说明）--';
        sel.appendChild(opt0);
    }
}

async function saveConfigToProject() {
    const nameInput = document.getElementById('config-save-name');
    const name = (nameInput && nameInput.value ? nameInput.value : '').trim();
    if (!name) {
        alert('请填写配置名称（将保存为项目内 configs/名称.json）');
        return;
    }
    const config = buildCurrentConfigObject();
    const dataStr = JSON.stringify(config);
    try {
        const url = new URL('/api/config/save', window.location.origin);
        const r = await fetch(url.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ name, config }),
        });
        const text = await r.text();
        let data = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch (_) {
            data = {};
        }
        if (!r.ok) {
            if (r.status === 404) {
                alert(
                    '保存失败 (HTTP 404)：当前地址上的服务不认识 /api/config/save。\n\n' +
                    '常见原因：8080 端口仍是旧的「仅静态文件」服务（例如以前 bat 起的 PowerShell）。\n' +
                    '请结束占用 8080 的进程后，只用新版 start-keyboard.bat 启动（由 key_server 同时提供网页与保存接口），\n' +
                    '并用 http://localhost:8080 打开本页（不要用本地磁盘 file:// 打开）。'
                );
                return;
            }
            alert(data.error || ('保存失败 (HTTP ' + r.status + ')'));
            return;
        }
        localStorage.setItem('dotaKeyboardConfig', dataStr);
        alert('已保存到项目 configs/ 目录：' + (data.name || name) + '.json');
        if (nameInput) nameInput.value = '';
        refreshSavedConfigSelect();
    } catch (err) {
        console.error(err);
        alert('保存失败（请确认已用 http://localhost:8080 打开页面，且 key_server 正在运行）');
    }
}

function exportConfigJsonFile() {
    const config = buildCurrentConfigObject();
    const dataStr = JSON.stringify(config, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dota-keyboard-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    localStorage.setItem('dotaKeyboardConfig', dataStr);
    alert('已导出 JSON 下载，并已写入本浏览器 localStorage 缓存。');
}

async function loadSelectedProjectConfig() {
    const sel = document.getElementById('saved-config-select');
    const name = sel && sel.value;
    if (!name) {
        alert('请先从下拉框选择一个配置');
        return;
    }
    try {
        const r = await fetch('/api/config?name=' + encodeURIComponent(name));
        if (!r.ok) {
            alert('加载失败 (HTTP ' + r.status + ')');
            return;
        }
        const config = await r.json();
        applyConfig(config);
        localStorage.setItem('dotaKeyboardConfig', JSON.stringify(config));
        alert('已从项目 configs/ 加载：' + name);
    } catch (e) {
        console.error(e);
        alert('加载失败（请确认本机服务已启动）');
    }
}

async function deleteSelectedProjectConfig() {
    const sel = document.getElementById('saved-config-select');
    const name = sel && sel.value;
    if (!name) {
        alert('请先选择要删除的配置');
        return;
    }
    if (!confirm('确定删除项目内配置：configs/' + name + '.json ?')) return;
    try {
        const r = await fetch('/api/config?name=' + encodeURIComponent(name), { method: 'DELETE' });
        let data = {};
        try {
            data = await r.json();
        } catch (_) { /* empty */ }
        if (!r.ok) {
            alert(data.error || '删除失败');
            return;
        }
        refreshSavedConfigSelect();
    } catch (e) {
        alert('删除失败');
    }
}

function loadConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const config = JSON.parse(e.target.result);
            applyConfig(config);
            alert('配置已加载！');
            refreshSavedConfigSelect();
        } catch (err) {
            console.error('配置加载错误:', err);
            alert('配置文件格式错误！');
        }
    };
    reader.readAsText(file);
}

/** 低于此版本的浏览器缓存会被忽略，避免旧版默认布局覆盖仓库 configs/default.json。 */
const PERSISTED_CONFIG_MIN_VERSION = 4;

function loadSavedConfig() {
    const saved = localStorage.getItem('dotaKeyboardConfig');
    if (!saved) return;
    try {
        const config = JSON.parse(saved);
        if (typeof config.version !== 'number' || config.version < PERSISTED_CONFIG_MIN_VERSION) {
            localStorage.removeItem('dotaKeyboardConfig');
            console.log(
                '已忽略旧版本地缓存（version < ' +
                    PERSISTED_CONFIG_MIN_VERSION +
                    '），当前以 configs/default.json 为准。若需保留旧布局请用「导出 JSON」备份后再升级。'
            );
            return;
        }
        applyConfig(config);
        console.log('已自动加载保存的配置');
    } catch (e) {
        console.log('加载保存的配置失败:', e);
    }
}

function applyConfig(config) {
    if (!config) {
        console.error('配置为空');
        return;
    }

    // 加载按键配置
    if (config.keys && Array.isArray(config.keys)) {
        // 创建新的keys数组，确保不保留任何旧状态
        keys = config.keys.map(keyData => {
            // 创建干净的按键对象
            const key = cleanKeyForSave(keyData);

            // 如果有背景图片，异步加载
            if (key.bgImage) {
                const img = new Image();
                img.onload = () => {
                    key._bgImageObj = img;
                    console.log('按键背景加载成功:', key.code);
                    invalidateCanvas();
                };
                img.onerror = () => {
                    console.warn('按键背景加载失败:', key.code);
                    // 保留bgImage配置，但标记为加载失败
                    key._bgImageLoadFailed = true;
                    invalidateCanvas();
                };
                img.src = key.bgImage;
            }

            return key;
        });
    }

    // 加载全局配置
    if (config.config && typeof config.config === 'object') {
        Object.assign(CONFIG, config.config);

        // 更新UI控件
        const opacitySliderValue = Math.round((1 - CONFIG.keyOpacity) * 100);
        const keyOpacityEl = document.getElementById('key-opacity');
        const keyOpacityValEl = document.getElementById('key-opacity-val');
        if (keyOpacityEl) keyOpacityEl.value = opacitySliderValue;
        if (keyOpacityValEl) keyOpacityValEl.textContent = opacitySliderValue;

        const activeColorPreview = document.getElementById('active-color-preview');
        const inactiveColorPreview = document.getElementById('inactive-color-preview');
        if (activeColorPreview) activeColorPreview.style.backgroundColor = CONFIG.activeColor;
        if (inactiveColorPreview) inactiveColorPreview.style.backgroundColor = CONFIG.inactiveColor;
    }

    // 加载背景图片配置
    if (config.bgImage && config.bgImage !== '' && config.bgImage !== window.location.href) {
        bgImage = new Image();
        bgImage.onload = () => {
            const bgImageEl = document.getElementById('bg-image');
            const removeBgBtn = document.getElementById('remove-bg-btn');
            if (bgImageEl) {
                bgImageEl.src = config.bgImage;
                bgImageEl.style.display = 'block';
            }
            // 显示删除按钮
            if (removeBgBtn) removeBgBtn.style.display = 'inline-block';
            // 显示背景相关控件，隐藏按键透明度
            updateOpacityControlsVisibility(true);
            invalidateCanvas();
        };
        bgImage.onerror = () => {
            console.warn('全局背景图片加载失败');
            bgImage = null;
            invalidateCanvas();
        };
        bgImage.src = config.bgImage;
    } else {
        // 没有背景图，重置状态
        bgImage = null;
        const bgImageEl = document.getElementById('bg-image');
        const removeBgBtn = document.getElementById('remove-bg-btn');
        if (bgImageEl) {
            bgImageEl.src = '';
            bgImageEl.style.display = 'none';
        }
        if (removeBgBtn) removeBgBtn.style.display = 'none';
        updateOpacityControlsVisibility(false);
        invalidateCanvas();
    }

    // 加载背景位置和缩放
    if (config.bgPosition && typeof config.bgPosition === 'object') {
        bgPosition = {
            x: config.bgPosition.x || 0,
            y: config.bgPosition.y || 0
        };
    } else {
        bgPosition = { x: 0, y: 0 };
    }

    // 加载背景缩放
    if (config.bgScale !== undefined && !isNaN(config.bgScale)) {
        bgScale = parseFloat(config.bgScale);
    } else {
        bgScale = 1.0;
    }
    const bgScaleEl = document.getElementById('bg-scale');
    const bgScaleValEl = document.getElementById('bg-scale-val');
    if (bgScaleEl) bgScaleEl.value = Math.round(bgScale * 100);
    if (bgScaleValEl) bgScaleValEl.textContent = Math.round(bgScale * 100);

    // 加载按键区域背景透明度
    if (config.bgKeyOpacity !== undefined && !isNaN(config.bgKeyOpacity)) {
        bgKeyOpacity = parseFloat(config.bgKeyOpacity);
    } else {
        bgKeyOpacity = 0.8;
    }
    const bgKeyOpacityEl = document.getElementById('bg-key-opacity');
    const bgKeyOpacityValEl = document.getElementById('bg-key-opacity-val');
    if (bgKeyOpacityEl) bgKeyOpacityEl.value = Math.round((1 - bgKeyOpacity) * 100);
    if (bgKeyOpacityValEl) bgKeyOpacityValEl.textContent = Math.round((1 - bgKeyOpacity) * 100);

    // 加载非按键区域背景透明度
    if (config.bgNonKeyOpacity !== undefined && !isNaN(config.bgNonKeyOpacity)) {
        bgNonKeyOpacity = parseFloat(config.bgNonKeyOpacity);
    } else {
        bgNonKeyOpacity = 0.8;
    }
    const bgNonKeyOpacityEl = document.getElementById('bg-non-key-opacity');
    const bgNonKeyOpacityValEl = document.getElementById('bg-non-key-opacity-val');
    if (bgNonKeyOpacityEl) bgNonKeyOpacityEl.value = Math.round((1 - bgNonKeyOpacity) * 100);
    if (bgNonKeyOpacityValEl) bgNonKeyOpacityValEl.textContent = Math.round((1 - bgNonKeyOpacity) * 100);

    if (typeof canvas !== 'undefined' && canvas && CONFIG.canvasWidth && CONFIG.canvasHeight) {
        canvas.width = CONFIG.canvasWidth;
        canvas.height = CONFIG.canvasHeight;
    }

    keys.forEach((k) => {
        if (!k.width) k.width = CONFIG.keySize;
        if (!k.height) k.height = CONFIG.keySize;
    });

    // 更新按键列表显示
    updateKeyList();

    console.log('配置加载完成');
    invalidateCanvas();
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

2. 浏览器本地缓存
   - 每次成功保存到项目或导出时，会同步写入当前浏览器的 localStorage
   - 同一浏览器再次打开页面会自动尝试恢复上次配置（配置版本 ≥4；更旧的缓存会被丢弃以免盖住新版默认布局）

3. 导出 / 导入文件
   - 「导出 JSON」：下载到本机任意位置，便于备份或发给别人
   - 「从文件加载」：选择 .json 文件导入（不经过 configs/ 目录也可以）

4. 配置内容包含
   - 按键位置、大小、文字、单键颜色与背景图等
   - 全局透明度与颜色、全局背景图（多为 base64，文件会较大）
    `;

    alert(message);
}

// ==================== WebSocket 功能 ====================

function connectWebSocket() {
    // 连接 WebSocket 服务器（全局按键捕获）
    try {
        ws = new WebSocket('ws://localhost:8765');

        ws.onopen = () => {
            if (wsReconnectTimerId !== null) {
                clearTimeout(wsReconnectTimerId);
                wsReconnectTimerId = null;
            }
            console.log('WebSocket Connected - Global key capture enabled');
            wsConnected = true;
            useWebSocket = true;
            showConnectionStatus(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (e) {
                console.error('WebSocket message parse error:', e);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            wsConnected = false;
            showConnectionStatus(false);
            if (wsReconnectTimerId !== null) {
                clearTimeout(wsReconnectTimerId);
            }
            wsReconnectTimerId = setTimeout(() => {
                wsReconnectTimerId = null;
                connectWebSocket();
            }, 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            wsConnected = false;
            showConnectionStatus(false);
        };
    } catch (e) {
        console.error('WebSocket connection failed:', e);
        showConnectionStatus(false);
    }
}

function handleWebSocketMessage(data) {
    // 处理 WebSocket 消息
    if (data.type === 'key') {
        // 单个按键状态更新
        if (data.pressed) {
            pressedKeys.add(data.code);
        } else {
            pressedKeys.delete(data.code);
        }
    } else if (data.type === 'full_state' && Array.isArray(data.pressed_keys)) {
        // 完整按键状态（服务端可扩展；当前 key_server 未发送）
        pressedKeys.clear();
        data.pressed_keys.forEach(code => pressedKeys.add(code));
    }
    invalidateCanvas();
}

function showConnectionStatus(connected) {
    let statusDiv = document.getElementById('ws-status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'ws-status';
        statusDiv.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            transition: all 0.3s;
        `;
        document.body.appendChild(statusDiv);
    }

    if (wsStatusFadeTimerId !== null) {
        clearTimeout(wsStatusFadeTimerId);
        wsStatusFadeTimerId = null;
    }
    statusDiv.style.opacity = '1';

    if (connected) {
        statusDiv.textContent = '全局按键捕获：已连接';
        statusDiv.style.background = 'rgba(0, 200, 0, 0.8)';
        statusDiv.style.color = 'white';
    } else {
        statusDiv.textContent = '全局按键捕获：未连接（请运行 key_server.py）';
        statusDiv.style.background = 'rgba(200, 0, 0, 0.8)';
        statusDiv.style.color = 'white';
    }

    wsStatusFadeTimerId = setTimeout(() => {
        statusDiv.style.opacity = '0.5';
        wsStatusFadeTimerId = null;
    }, 5000);
}

// ==================== 吸附功能控制 ====================
function enableAllSnap() {
    // 开启全部吸附
    snapConfig.enabled = true;
    snapConfig.toEdges = true;
    snapConfig.toCenter = true;
    snapConfig.toAssist = true;
    snapConfig.status = 'selected';
    document.getElementById('snap-to-edges').checked = true;
    document.getElementById('snap-to-center').checked = true;
    document.getElementById('snap-to-assist').checked = true;
    
    // 显示所有参数设置条
    document.getElementById('snap-edges-controls').style.display = 'block';
    document.getElementById('snap-center-controls').style.display = 'block';
    document.getElementById('snap-assist-controls').style.display = 'block';
}

function disableAllSnap() {
    // 关闭全部吸附
    snapConfig.enabled = false;
    snapConfig.toEdges = false;
    snapConfig.toCenter = false;
    snapConfig.toAssist = false;
    snapConfig.status = 'unselected';
    document.getElementById('snap-to-edges').checked = false;
    document.getElementById('snap-to-center').checked = false;
    document.getElementById('snap-to-assist').checked = false;
    
    // 隐藏所有参数设置条
    document.getElementById('snap-edges-controls').style.display = 'none';
    document.getElementById('snap-center-controls').style.display = 'none';
    document.getElementById('snap-assist-controls').style.display = 'none';
}

function toggleSnapToEdges() {
    const checkbox = document.getElementById('snap-to-edges');
    snapConfig.toEdges = checkbox.checked;
    
    // 显示或隐藏边缘吸附的参数设置条
    document.getElementById('snap-edges-controls').style.display = checkbox.checked ? 'block' : 'none';
    
    // 即使关闭边缘吸附，辅助排列仍然可以工作
    // 只在所有吸附功能都关闭时才禁用整个吸附系统
    if (!snapConfig.toEdges && !snapConfig.toCenter && !snapConfig.toAssist) {
        snapConfig.enabled = false;
        snapConfig.status = 'unselected';
    } else {
        snapConfig.enabled = true;
        snapConfig.status = 'half-selected';
    }
}

function toggleSnapToCenter() {
    const checkbox = document.getElementById('snap-to-center');
    snapConfig.toCenter = checkbox.checked;
    
    // 显示或隐藏中心吸附的参数设置条
    document.getElementById('snap-center-controls').style.display = checkbox.checked ? 'block' : 'none';
    
    // 即使关闭中心吸附，辅助排列仍然可以工作
    // 只在所有吸附功能都关闭时才禁用整个吸附系统
    if (!snapConfig.toEdges && !snapConfig.toCenter && !snapConfig.toAssist) {
        snapConfig.enabled = false;
        snapConfig.status = 'unselected';
    } else {
        snapConfig.enabled = true;
        snapConfig.status = 'half-selected';
    }
}

function toggleSnapToAssist() {
    const checkbox = document.getElementById('snap-to-assist');
    snapConfig.toAssist = checkbox.checked;
    
    // 显示或隐藏辅助排列的参数设置条
    document.getElementById('snap-assist-controls').style.display = checkbox.checked ? 'block' : 'none';
    
    // 即使关闭辅助排列，其他吸附仍然可以工作
    // 只在所有吸附功能都关闭时才禁用整个吸附系统
    if (!snapConfig.toEdges && !snapConfig.toCenter && !snapConfig.toAssist) {
        snapConfig.enabled = false;
        snapConfig.status = 'unselected';
    } else {
        snapConfig.enabled = true;
        snapConfig.status = 'half-selected';
    }
}

function updateSnapDistance(val) {
    snapConfig.distance = parseInt(val);
    document.getElementById('snap-distance-val').textContent = val;
}

function updateSnapAssistThreshold(val) {
    snapConfig.thresholds.assist = parseInt(val);
    document.getElementById('snap-assist-threshold-val').textContent = val;
}

function updateSnapEdgesThreshold(val) {
    snapConfig.thresholds.edges = parseInt(val);
    document.getElementById('snap-edges-threshold-val').textContent = val;
}

function updateSnapCenterThreshold(val) {
    snapConfig.thresholds.center = parseInt(val);
    document.getElementById('snap-center-threshold-val').textContent = val;
}
