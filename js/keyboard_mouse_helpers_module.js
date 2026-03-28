(function initKeyboardMouseHelpersModule(globalObj) {
    'use strict';

    function getResizeHandle(ctx, key, x, y) {
        const w = key.width || ctx.CONFIG.keySize;
        const h = key.height || ctx.CONFIG.keySize;
        const handles = [
            { name: 'nw', x: key.x, y: key.y },
            { name: 'ne', x: key.x + w, y: key.y },
            { name: 'sw', x: key.x, y: key.y + h },
            { name: 'se', x: key.x + w, y: key.y + h }
        ];

        for (let i = 0; i < handles.length; i++) {
            const handle = handles[i];
            const dx = x - handle.x;
            const dy = y - handle.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= ctx.RESIZE_HANDLE_SIZE) {
                return handle.name;
            }
        }
        return null;
    }

    function getEdgePosition(ctx, key, x, y) {
        const w = key.width || ctx.CONFIG.keySize;
        const h = key.height || ctx.CONFIG.keySize;
        const leftEdge = key.x;
        const rightEdge = key.x + w;
        const topEdge = key.y;
        const bottomEdge = key.y + h;
        const threshold = ctx.RESIZE_EDGE_THRESHOLD;

        const inHorizontalRange = x >= leftEdge - threshold && x <= rightEdge + threshold;
        const inVerticalRange = y >= topEdge - threshold && y <= bottomEdge + threshold;
        if (!inHorizontalRange || !inVerticalRange) return null;

        const onLeft = Math.abs(x - leftEdge) <= threshold;
        const onRight = Math.abs(x - rightEdge) <= threshold;
        const onTop = Math.abs(y - topEdge) <= threshold;
        const onBottom = Math.abs(y - bottomEdge) <= threshold;
        const insideKey = x >= leftEdge && x <= rightEdge && y >= topEdge && y <= bottomEdge;

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

    function updateCursor(ctx, position) {
        const cursorMap = {
            nw: 'nw-resize',
            ne: 'ne-resize',
            sw: 'sw-resize',
            se: 'se-resize',
            n: 'n-resize',
            s: 's-resize',
            w: 'w-resize',
            e: 'e-resize'
        };
        const canvas = ctx.canvas;
        if (!canvas) return;

        if (position) {
            canvas.style.cursor = cursorMap[position];
            canvas.className = `cursor-resize-${position}`;
        } else {
            canvas.style.cursor = 'default';
            canvas.className = '';
        }
    }

    globalObj.KeyboardMouseHelpersModule = {
        getResizeHandle,
        getEdgePosition,
        updateCursor
    };
})(window);
