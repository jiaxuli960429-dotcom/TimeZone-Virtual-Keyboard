(function initKeyboardRenderModule(globalObj) {
    'use strict';

    function drawSnapLines(ctx, canvas, snapLines) {
        if (!ctx || !canvas || !Array.isArray(snapLines) || snapLines.length === 0) return;

        ctx.save();
        ctx.strokeStyle = '#FF6B6B';
        ctx.fillStyle = '#FF6B6B';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        snapLines.forEach((line) => {
            const isVertical = line.type === 'v' || line.type === 'vertical';
            const isHorizontal = line.type === 'h' || line.type === 'horizontal';
            const x1 = line.x1 !== undefined ? line.x1 : line.x;
            const y1 = line.y1 !== undefined ? line.y1 : line.y;
            const x2 = line.x2 !== undefined ? line.x2 : line.x;
            const y2 = line.y2 !== undefined ? line.y2 : line.y;

            ctx.beginPath();
            if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
            } else if (isVertical) {
                ctx.moveTo(line.x, 0);
                ctx.lineTo(line.x, canvas.height);
            } else if (isHorizontal) {
                ctx.moveTo(0, line.y);
                ctx.lineTo(canvas.width, line.y);
            } else {
                // 未知类型时，按是否存在 x / y 兜底，避免线条丢失
                if (line.x !== undefined) {
                    ctx.moveTo(line.x, 0);
                    ctx.lineTo(line.x, canvas.height);
                } else if (line.y !== undefined) {
                    ctx.moveTo(0, line.y);
                    ctx.lineTo(canvas.width, line.y);
                } else {
                    return;
                }
            }
            ctx.stroke();
        });

        ctx.restore();
    }

    function renderFrame(state, deps) {
        const s = state || {};
        const d = deps || {};
        const ctx = s.ctx;
        const canvas = s.canvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (s.bgImage) {
            ctx.save();
            ctx.globalAlpha = s.bgNonKeyOpacity;
            ctx.translate(s.bgPosition.x, s.bgPosition.y);
            ctx.scale(s.bgScale, s.bgScale);
            ctx.drawImage(s.bgImage, 0, 0, s.bgImage.width, s.bgImage.height);
            ctx.restore();

            (s.keys || []).forEach((key) => {
                const w = key.width || s.CONFIG.keySize;
                const h = key.height || s.CONFIG.keySize;
                ctx.save();
                ctx.globalAlpha = s.bgKeyOpacity;
                ctx.beginPath();
                d.roundRect(ctx, key.x, key.y, w, h, 8);
                ctx.clip();
                ctx.translate(s.bgPosition.x, s.bgPosition.y);
                ctx.scale(s.bgScale, s.bgScale);
                ctx.drawImage(s.bgImage, 0, 0, s.bgImage.width, s.bgImage.height);
                ctx.restore();
            });
        }

        if (s.editingKey) {
            (s.keys || []).filter((key) => key !== s.editingKey).forEach((key) => d.drawKey(key));
            d.drawKey(s.editingKey);
        } else {
            (s.keys || []).forEach((key) => d.drawKey(key));
        }

        drawSnapLines(ctx, canvas, s.snapLines || []);

        const needsNextFrame =
            s.draggedKey !== null ||
            s.resizingKey !== null ||
            !!s.isDraggingBg ||
            !!s.isDraggingKeyBg ||
            ((s.snapLines || []).length > 0);
        if (needsNextFrame && typeof d.invalidateCanvas === 'function') {
            d.invalidateCanvas();
        }
    }

    globalObj.KeyboardRenderModule = {
        renderFrame,
        drawSnapLines
    };
})(window);
