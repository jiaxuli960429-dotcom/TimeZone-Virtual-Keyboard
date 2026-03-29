(function initKeyboardMouseMoveModule(globalObj) {
    'use strict';

    function handleMouseMove(ctx, e) {
        const canvas = ctx.canvas;
        const pt =
            typeof ctx.canvasClientToLogical === 'function'
                ? ctx.canvasClientToLogical(e.clientX, e.clientY)
                : (() => {
                      const rect = canvas.getBoundingClientRect();
                      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
                  })();
        const x = pt.x;
        const y = pt.y;

        if (ctx.getDragCandidateKey() && !ctx.getDraggedKey()) {
            const from = ctx.getDragCandidateFrom();
            if (from && typeof from.clientX === 'number') {
                const dx = e.clientX - from.clientX;
                const dy = e.clientY - from.clientY;
                if (dx * dx + dy * dy >= ctx.CLICK_DRAG_THRESHOLD_PX * ctx.CLICK_DRAG_THRESHOLD_PX) {
                    ctx.setDraggedKey(ctx.getDragCandidateKey());
                    ctx.setDragCandidateKey(null);
                    ctx.beginLayoutGesture();
                }
            }
        }

        if (ctx.getResizingKey()) {
            const resizingKey = ctx.getResizingKey();
            const resizeStart = ctx.getResizeStart();
            const resizeHandle = ctx.getResizeHandleState();
            const dx = x - resizeStart.x;
            const dy = y - resizeStart.y;

            let newW = resizeStart.w;
            let newH = resizeStart.h;
            let newX = resizeStart.keyX;
            let newY = resizeStart.keyY;

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
            resizingKey.x = Math.max(0, Math.min(resizingKey.x, canvas.width - resizingKey.width));
            resizingKey.y = Math.max(0, Math.min(resizingKey.y, canvas.height - resizingKey.height));

            const snap = ctx.calculateSnap(resizingKey, true, resizeHandle);
            ctx.setSnapLines(snap.snapLines);
            resizingKey.x = snap.adjustedX;
            resizingKey.y = snap.adjustedY;
            resizingKey.width = snap.adjustedW;
            resizingKey.height = snap.adjustedH;
            ctx.updateEditMenuValues();
            ctx.invalidateCanvas();
            return;
        }

        if (ctx.getDraggedKey()) {
            const draggedKey = ctx.getDraggedKey();
            let newX = x - ctx.dragOffset.x;
            let newY = y - ctx.dragOffset.y;
            draggedKey.x = newX;
            draggedKey.y = newY;

            const snap = ctx.calculateSnap(draggedKey, false);
            ctx.setSnapLines(snap.snapLines);
            draggedKey.x = snap.adjustedX;
            draggedKey.y = snap.adjustedY;
            draggedKey.x = Math.max(0, Math.min(draggedKey.x, canvas.width - (draggedKey.width || ctx.CONFIG.keySize)));
            draggedKey.y = Math.max(0, Math.min(draggedKey.y, canvas.height - (draggedKey.height || ctx.CONFIG.keySize)));

            ctx.updateEditMenuValues();
            ctx.invalidateCanvas();
            return;
        }

        if (ctx.getIsDraggingBg()) {
            ctx.bgPosition.x = x - ctx.bgDragOffset.x;
            ctx.bgPosition.y = y - ctx.bgDragOffset.y;
            ctx.invalidateCanvas();
            return;
        }

        if (ctx.getIsDraggingKeyBg() && ctx.getDraggedKeyBg()) {
            const draggedKeyBg = ctx.getDraggedKeyBg();
            draggedKeyBg.bgOffsetX = x - draggedKeyBg.x - ctx.keyBgDragOffset.x;
            draggedKeyBg.bgOffsetY = y - draggedKeyBg.y - ctx.keyBgDragOffset.y;
            ctx.invalidateCanvas();
            return;
        }

        let found = false;
        let hoveredKey = null;
        const keys = ctx.getKeys();
        for (let i = keys.length - 1; i >= 0; i--) {
            const key = keys[i];
            const w = key.width || ctx.CONFIG.keySize;
            const h = key.height || ctx.CONFIG.keySize;
            const inRange =
                x >= key.x - ctx.RESIZE_EDGE_THRESHOLD &&
                x <= key.x + w + ctx.RESIZE_EDGE_THRESHOLD &&
                y >= key.y - ctx.RESIZE_EDGE_THRESHOLD &&
                y <= key.y + h + ctx.RESIZE_EDGE_THRESHOLD;
            if (inRange) {
                hoveredKey = key;
                break;
            }
        }

        if (hoveredKey) {
            const handle = ctx.getResizeHandle(hoveredKey, x, y);
            if (handle) {
                ctx.updateCursor(handle);
                found = true;
            } else {
                const edge = ctx.getEdgePosition(hoveredKey, x, y);
                if (edge) {
                    ctx.updateCursor(edge);
                    found = true;
                } else {
                    const w = hoveredKey.width || ctx.CONFIG.keySize;
                    const h = hoveredKey.height || ctx.CONFIG.keySize;
                    if (x >= hoveredKey.x && x <= hoveredKey.x + w && y >= hoveredKey.y && y <= hoveredKey.y + h) {
                        canvas.style.cursor = 'move';
                        canvas.className = 'cursor-move';
                        found = true;
                    }
                }
            }
        } else if (ctx.getBgImage()) {
            canvas.style.cursor = 'move';
            found = true;
        }

        if (!found) {
            canvas.style.cursor = 'default';
            canvas.className = '';
        }
    }

    globalObj.KeyboardMouseMoveModule = {
        handleMouseMove
    };
})(window);
