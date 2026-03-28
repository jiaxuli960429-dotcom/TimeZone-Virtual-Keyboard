(function initKeyboardSnapModule(globalObj) {
    'use strict';

    function calculateSnapForKey(state, key, options) {
        const s = state || {};
        const opts = options || {};
        const isResize = !!opts.isResize;
        const resizeHandle = opts.resizeHandle || null;

        const keys = s.keys || [];
        const canvas = s.canvas || null;
        const CONFIG = s.CONFIG || {};
        const snapConfig = s.snapConfig || {};

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
        let snapLockedX = false;
        let snapLockedY = false;

        const otherKeys = keys.filter((k) => k !== key);
        const allEdges = [];

        otherKeys.forEach((k) => {
            const kw = k.width || CONFIG.keySize;
            const kh = k.height || CONFIG.keySize;

            if (snapConfig.toEdges) {
                allEdges.push(
                    { type: 'x', value: k.x, label: 'left' },
                    { type: 'x', value: k.x + kw, label: 'right' },
                    { type: 'y', value: k.y, label: 'top' },
                    { type: 'y', value: k.y + kh, label: 'bottom' }
                );
            }

            if (snapConfig.toCenter) {
                allEdges.push(
                    { type: 'x', value: k.x + kw / 2, label: 'centerX' },
                    { type: 'y', value: k.y + kh / 2, label: 'centerY' }
                );
            }
        });

        let edgesToCheckX = [];
        let edgesToCheckY = [];

        if (isResize && resizeHandle) {
            if (resizeHandle.includes('w')) edgesToCheckX.push('left');
            if (resizeHandle.includes('e')) edgesToCheckX.push('right');
            if (resizeHandle.includes('n')) edgesToCheckY.push('top');
            if (resizeHandle.includes('s')) edgesToCheckY.push('bottom');
        } else {
            if (snapConfig.toEdges) {
                edgesToCheckX.push('left', 'right');
                edgesToCheckY.push('top', 'bottom');
            }
            if (snapConfig.toCenter) {
                edgesToCheckX.push('centerX');
                edgesToCheckY.push('centerY');
            }
        }

        if (snapConfig.toEdges || snapConfig.toCenter) {
            const xTargets = allEdges.filter((e) => e.type === 'x');
            let bestX = null;

            for (let edge of edgesToCheckX) {
                const currentValue = currentEdges[edge];
                const threshold = edge === 'centerX' ? snapConfig.thresholds.center : snapConfig.thresholds.edges;
                for (let target of xTargets) {
                    const delta = Math.abs(currentValue - target.value);
                    if (delta > threshold) continue;
                    const match = { edge, targetValue: target.value, delta };
                    if (!bestX || delta < bestX.delta) {
                        bestX = match;
                    }
                }
            }

            if (bestX) {
                if (!isResize) {
                    if (bestX.edge === 'left') snapX = bestX.targetValue;
                    else if (bestX.edge === 'right') snapX = bestX.targetValue - w;
                    else if (bestX.edge === 'centerX') snapX = bestX.targetValue - w / 2;
                    lines.push({ type: 'vertical', x: bestX.targetValue });
                    snapLockedX = true;
                } else {
                    if (bestX.edge === 'left') {
                        const newLeft = bestX.targetValue;
                        snapW = currentEdges.right - newLeft;
                        snapX = newLeft;
                    } else if (bestX.edge === 'right') {
                        snapW = bestX.targetValue - currentEdges.left;
                    }
                    lines.push({ type: 'vertical', x: bestX.targetValue });
                }
            }
        }

        if (snapConfig.toEdges || snapConfig.toCenter) {
            const yTargets = allEdges.filter((e) => e.type === 'y');
            let bestY = null;

            for (let edge of edgesToCheckY) {
                const currentValue = currentEdges[edge];
                const threshold = edge === 'centerY' ? snapConfig.thresholds.center : snapConfig.thresholds.edges;
                for (let target of yTargets) {
                    const delta = Math.abs(currentValue - target.value);
                    if (delta > threshold) continue;
                    const match = { edge, targetValue: target.value, delta };
                    if (!bestY || delta < bestY.delta) {
                        bestY = match;
                    }
                }
            }

            if (bestY) {
                if (!isResize) {
                    if (bestY.edge === 'top') snapY = bestY.targetValue;
                    else if (bestY.edge === 'bottom') snapY = bestY.targetValue - h;
                    else if (bestY.edge === 'centerY') snapY = bestY.targetValue - h / 2;
                    lines.push({ type: 'horizontal', y: bestY.targetValue });
                    snapLockedY = true;
                } else {
                    if (bestY.edge === 'top') {
                        const newTop = bestY.targetValue;
                        snapH = currentEdges.bottom - newTop;
                        snapY = newTop;
                    } else if (bestY.edge === 'bottom') {
                        snapH = bestY.targetValue - currentEdges.top;
                    }
                    lines.push({ type: 'horizontal', y: bestY.targetValue });
                }
            }
        }

        if (!isResize && snapConfig.enabled && snapConfig.toAssist) {
            const yProjectionOverlaps = (y0, h0, y1, h1) => y0 < y1 + h1 && y1 < y0 + h0;
            const xProjectionOverlaps = (x0, w0, x1, w1) => x0 < x1 + w1 && x1 < x0 + w0;
            const ASSIST_LINE_OUTSET = 22;
            const cw = canvas ? canvas.width : 99999;
            const ch = canvas ? canvas.height : 99999;
            const assistUnionXSeg = (ax, aw, kx, kw) => {
                const lo = Math.min(ax, kx) - ASSIST_LINE_OUTSET;
                const hi = Math.max(ax + aw, kx + kw) + ASSIST_LINE_OUTSET;
                return { x1: Math.max(0, lo), x2: Math.min(cw, hi) };
            };
            const assistUnionYSeg = (ay, ah, ky, kh) => {
                const lo = Math.min(ay, ky) - ASSIST_LINE_OUTSET;
                const hi = Math.max(ay + ah, ky + kh) + ASSIST_LINE_OUTSET;
                return { y1: Math.max(0, lo), y2: Math.min(ch, hi) };
            };

            const distance = snapConfig.distance;
            const thresholds = snapConfig.thresholds.assist;

            if (!snapLockedX) {
                for (let k of otherKeys) {
                    const kw = k.width || CONFIG.keySize;
                    const kh = k.height || CONFIG.keySize;
                    if (!yProjectionOverlaps(snapY, h, k.y, kh)) continue;

                    const leftAssist = k.x - distance - w;
                    const rightAssist = k.x + kw + distance;
                    const ySeg = assistUnionYSeg(snapY, h, k.y, kh);

                    if (Math.abs(snapX - leftAssist) <= thresholds) {
                        lines.push({ type: 'vertical', x: k.x, ...ySeg });
                        lines.push({ type: 'vertical', x: leftAssist + w, ...ySeg });
                        snapX = leftAssist;
                        break;
                    }
                    if (Math.abs(snapX - rightAssist) <= thresholds) {
                        lines.push({ type: 'vertical', x: k.x + kw, ...ySeg });
                        lines.push({ type: 'vertical', x: rightAssist, ...ySeg });
                        snapX = rightAssist;
                        break;
                    }
                }
            }

            if (!snapLockedY) {
                for (let k of otherKeys) {
                    const kw = k.width || CONFIG.keySize;
                    const kh = k.height || CONFIG.keySize;
                    if (!xProjectionOverlaps(snapX, w, k.x, kw)) continue;

                    const topAssist = k.y - distance - h;
                    const bottomAssist = k.y + kh + distance;
                    const xSeg = assistUnionXSeg(snapX, w, k.x, kw);

                    if (Math.abs(snapY - topAssist) <= thresholds) {
                        lines.push({ type: 'horizontal', y: k.y, ...xSeg });
                        lines.push({ type: 'horizontal', y: topAssist + h, ...xSeg });
                        snapY = topAssist;
                        break;
                    }
                    if (Math.abs(snapY - bottomAssist) <= thresholds) {
                        lines.push({ type: 'horizontal', y: k.y + kh, ...xSeg });
                        lines.push({ type: 'horizontal', y: bottomAssist, ...xSeg });
                        snapY = bottomAssist;
                        break;
                    }
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

    globalObj.KeyboardSnapModule = {
        calculateSnapForKey
    };
})(window);
