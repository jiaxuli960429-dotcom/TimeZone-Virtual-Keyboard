(function initKeyboardMouseDownModule(globalObj) {
    'use strict';

    function handleMouseDown(ctx, e) {
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

        if (e.target === canvas && typeof canvas.focus === 'function') {
            try {
                canvas.focus({ preventScroll: true });
            } catch (_) {
                canvas.focus();
            }
        }

        const keys = ctx.getKeys();
        let clickedOnKey = false;
        let clickedKey = null;

        for (let i = keys.length - 1; i >= 0; i--) {
            const key = keys[i];
            const w = key.width || ctx.CONFIG.keySize;
            const h = key.height || ctx.CONFIG.keySize;

            const handle = ctx.getResizeHandle(key, x, y);
            if (handle) {
                ctx.setResizingKey(key);
                ctx.setResizeHandle(handle);
                ctx.setResizeStart({ x, y, w, h, keyX: key.x, keyY: key.y });
                clickedOnKey = true;
                ctx.setSelectedKey(key);
                ctx.beginLayoutGesture();
                ctx.updateKeyList();
                ctx.invalidateCanvas();
                return;
            }

            const edge = ctx.getEdgePosition(key, x, y);
            if (edge) {
                ctx.setResizingKey(key);
                ctx.setResizeHandle(edge);
                ctx.setResizeStart({ x, y, w, h, keyX: key.x, keyY: key.y });
                clickedOnKey = true;
                ctx.setSelectedKey(key);
                ctx.beginLayoutGesture();
                ctx.updateKeyList();
                ctx.invalidateCanvas();
                return;
            }

            if (x >= key.x && x <= key.x + w && y >= key.y && y <= key.y + h) {
                clickedKey = key;
                clickedOnKey = true;
                break;
            }
        }

        if (clickedOnKey && clickedKey) {
            const editingKey = ctx.getEditingKey();
            if (editingKey) {
                if (clickedKey === editingKey) {
                    ctx.setSelectedKey(clickedKey);
                    ctx.setDragCandidateKey(clickedKey);
                    ctx.setDragCandidateFrom({ clientX: e.clientX, clientY: e.clientY });
                    ctx.dragOffset.x = x - clickedKey.x;
                    ctx.dragOffset.y = y - clickedKey.y;
                } else {
                    return;
                }
            } else {
                ctx.setSelectedKey(clickedKey);
                ctx.setDragCandidateKey(clickedKey);
                ctx.setDragCandidateFrom({ clientX: e.clientX, clientY: e.clientY });
                ctx.dragOffset.x = x - clickedKey.x;
                ctx.dragOffset.y = y - clickedKey.y;
            }
            ctx.updateKeyList();
            ctx.invalidateCanvas();
            return;
        }

        const editingKey = ctx.getEditingKey();
        if (editingKey) {
            ctx.setSelectedKey(editingKey);
        } else {
            ctx.setSelectedKey(null);
        }
        ctx.updateKeyList();

        if (editingKey && editingKey.bgImage && editingKey._bgImageObj) {
            ctx.setIsDraggingKeyBg(true);
            ctx.setDraggedKeyBg(editingKey);
            ctx.keyBgDragOffset.x = x - (editingKey.x + (editingKey.bgOffsetX || 0));
            ctx.keyBgDragOffset.y = y - (editingKey.y + (editingKey.bgOffsetY || 0));
            canvas.style.cursor = 'move';
            ctx.invalidateCanvas();
            return;
        }

        if (editingKey) {
            ctx.setSelectedKey(editingKey);
            return;
        }

        if (ctx.getBgImage()) {
            ctx.setIsDraggingBg(true);
            ctx.bgDragOffset.x = x - ctx.bgPosition.x;
            ctx.bgDragOffset.y = y - ctx.bgPosition.y;
            canvas.style.cursor = 'move';
        }
        ctx.invalidateCanvas();
    }

    globalObj.KeyboardMouseDownModule = {
        handleMouseDown
    };
})(window);
