(function initKeyboardInputModule(globalObj) {
    'use strict';

    function isTypingInField(target) {
        if (!target) return false;
        const t = target.tagName;
        if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return true;
        return !!target.isContentEditable;
    }

    function handleKeyDown(ctx, e) {
        if (ctx.getIsAddingKey()) {
            e.preventDefault();
            e.stopPropagation();
            const keyLabel = e.key ? e.key.toUpperCase() : e.code;
            ctx.addKey(e.code, keyLabel);
            ctx.setIsAddingKey(false);
            const hint = document.getElementById('add-key-hint');
            if (hint) hint.style.display = 'none';
            return;
        }

        if ((e.key === 'Delete' || e.code === 'Delete') && ctx.getSelectedKey() && !isTypingInField(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            ctx.removeKey(ctx.getSelectedKey().code);
            return;
        }

        if (ctx.isLayoutUndoRedoShortcut(e)) {
            e.preventDefault();
            e.stopPropagation();
            const k = e.key;
            if (k === 'y' || k === 'Y' || ((k === 'z' || k === 'Z') && e.shiftKey)) {
                ctx.redoLayout();
            } else {
                ctx.undoLayout();
            }
            return;
        }

        if (ctx.getWsConnected() && ctx.getUseWebSocket()) {
            return;
        }

        ctx.getPressedKeys().add(e.code);
        ctx.invalidateCanvas();
    }

    function handleKeyUp(ctx, e) {
        if (ctx.getIsAddingKey()) return;
        if (ctx.getWsConnected() && ctx.getUseWebSocket()) return;
        ctx.getPressedKeys().delete(e.code);
        ctx.invalidateCanvas();
    }

    globalObj.KeyboardInputModule = {
        isTypingInField,
        handleKeyDown,
        handleKeyUp
    };
})(window);
