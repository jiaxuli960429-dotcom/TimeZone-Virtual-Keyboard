(function initKeyboardHistoryModule(globalObj) {
    'use strict';

    function isLayoutUndoRedoShortcut(e) {
        if ((!e.ctrlKey && !e.metaKey) || e.altKey) return false;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
            return false;
        }
        const k = e.key;
        return k === 'z' || k === 'Z' || k === 'y' || k === 'Y';
    }

    function updateUndoRedoButtons(ctx) {
        const u = document.getElementById('layout-undo-btn');
        const r = document.getElementById('layout-redo-btn');
        const undoLen = ctx.getLayoutUndoStack().length;
        const redoLen = ctx.getLayoutRedoStack().length;
        if (u) u.disabled = undoLen === 0;
        if (r) r.disabled = redoLen === 0;
    }

    function pushUndoCurrentState(ctx) {
        if (ctx.getHistorySuspended()) return;
        const undo = ctx.getLayoutUndoStack();
        const redo = ctx.getLayoutRedoStack();
        undo.push(ctx.snapshotKeysLayout());
        while (undo.length > ctx.maxLayoutHistory) {
            undo.shift();
        }
        redo.length = 0;
        updateUndoRedoButtons(ctx);
    }

    function beginLayoutGesture(ctx) {
        if (ctx.getHistorySuspended()) return;
        ctx.setPendingGestureHistorySnapshot(ctx.snapshotKeysLayout());
    }

    function maybeCommitGestureHistory(ctx, didDragOrResize) {
        if (!didDragOrResize) return;
        const pending = ctx.getPendingGestureHistorySnapshot();
        if (!pending || ctx.getHistorySuspended()) {
            ctx.setPendingGestureHistorySnapshot(null);
            return;
        }
        const now = ctx.snapshotKeysLayout();
        if (!ctx.snapshotsLayoutEqual(pending, now)) {
            const undo = ctx.getLayoutUndoStack();
            const redo = ctx.getLayoutRedoStack();
            undo.push(pending);
            while (undo.length > ctx.maxLayoutHistory) {
                undo.shift();
            }
            redo.length = 0;
            updateUndoRedoButtons(ctx);
        }
        ctx.setPendingGestureHistorySnapshot(null);
    }

    function applyKeysArrayFromSnapshot(ctx, snapshot) {
        const modalEl = document.getElementById('key-edit-modal');
        const modalWasOpen = modalEl && !modalEl.classList.contains('hidden');
        const wasEditingCode = ctx.getEditingKey() ? ctx.getEditingKey().code : null;

        ctx.setKeys(snapshot.map(ctx.keyFromPersistedData));

        const selectedKey = ctx.getSelectedKey();
        if (selectedKey) {
            const selCode = selectedKey.code;
            const nextSelected = ctx.getKeys().find((k) => k.code === selCode) || null;
            ctx.setSelectedKey(nextSelected);
        }

        if (wasEditingCode) {
            const nextEditing = ctx.getKeys().find((k) => k.code === wasEditingCode) || null;
            ctx.setEditingKey(nextEditing);
            if (modalWasOpen) {
                if (!nextEditing) {
                    ctx.closeKeyEdit();
                } else {
                    ctx.setEditingKeyBackup(JSON.parse(JSON.stringify(nextEditing)));
                    ctx.updateEditMenuValues();
                }
            }
        }

        ctx.updateKeyList();
        ctx.invalidateCanvas();
    }

    function undoLayout(ctx) {
        const undo = ctx.getLayoutUndoStack();
        const redo = ctx.getLayoutRedoStack();
        if (undo.length === 0 || ctx.getHistorySuspended()) return;
        ctx.setHistorySuspended(true);
        try {
            const previous = undo.pop();
            redo.push(ctx.snapshotKeysLayout());
            applyKeysArrayFromSnapshot(ctx, previous);
        } finally {
            ctx.setHistorySuspended(false);
        }
        updateUndoRedoButtons(ctx);
    }

    function redoLayout(ctx) {
        const undo = ctx.getLayoutUndoStack();
        const redo = ctx.getLayoutRedoStack();
        if (redo.length === 0 || ctx.getHistorySuspended()) return;
        ctx.setHistorySuspended(true);
        try {
            const next = redo.pop();
            undo.push(ctx.snapshotKeysLayout());
            applyKeysArrayFromSnapshot(ctx, next);
        } finally {
            ctx.setHistorySuspended(false);
        }
        updateUndoRedoButtons(ctx);
    }

    function resetLayoutHistory(ctx) {
        ctx.getLayoutUndoStack().length = 0;
        ctx.getLayoutRedoStack().length = 0;
        ctx.setPendingGestureHistorySnapshot(null);
        ctx.setDragCandidateKey(null);
        ctx.setSelectedKey(null);
        updateUndoRedoButtons(ctx);
    }

    globalObj.KeyboardHistoryModule = {
        isLayoutUndoRedoShortcut,
        pushUndoCurrentState,
        beginLayoutGesture,
        maybeCommitGestureHistory,
        applyKeysArrayFromSnapshot,
        undoLayout,
        redoLayout,
        updateUndoRedoButtons,
        resetLayoutHistory
    };
})(window);
