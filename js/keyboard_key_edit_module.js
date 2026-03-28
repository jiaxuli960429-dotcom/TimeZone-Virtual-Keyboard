(function initKeyboardKeyEditModule(globalObj) {
    'use strict';

    const keyEditModalDrag = {
        isDragging: false,
        offsetX: 0,
        offsetY: 0
    };

    function dragKeyEditModal(e) {
        if (!keyEditModalDrag.isDragging) return;
        const modal = document.getElementById('key-edit-modal-content');
        if (!modal) return;

        let newX = e.clientX - keyEditModalDrag.offsetX;
        let newY = e.clientY - keyEditModalDrag.offsetY;
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

    function startDragKeyEditModal(e) {
        e.preventDefault();
        const modal = document.getElementById('key-edit-modal-content');
        if (!modal) return;

        keyEditModalDrag.isDragging = true;
        const rect = modal.getBoundingClientRect();
        keyEditModalDrag.offsetX = e.clientX - rect.left;
        keyEditModalDrag.offsetY = e.clientY - rect.top;
        modal.style.position = 'fixed';
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        document.addEventListener('mousemove', dragKeyEditModal);
        document.addEventListener('mouseup', stopDragKeyEditModal);
    }

    function handleKeyActiveColorPreview(ctx, e) {
        if (!ctx) return;
        const editingKey = ctx.getEditingKey();
        if (!editingKey) return;
        const color = e.target.value;
        editingKey.activeColor = color;
        editingKey._previewPressed = true;
        ctx.invalidateCanvas();
    }

    function handleKeyInactiveColorPreview(ctx, e) {
        if (!ctx) return;
        const editingKey = ctx.getEditingKey();
        if (!editingKey) return;
        const color = e.target.value;
        editingKey.inactiveColor = color;
        delete editingKey._previewPressed;
        ctx.invalidateCanvas();
    }

    function toggleKeyActiveColor(ctx) {
        if (!ctx) return;
        const useGlobal = document.getElementById('use-global-active').checked;
        const colorInput = document.getElementById('edit-key-active-color');
        if (!colorInput) return;
        colorInput.disabled = useGlobal;
        const editingKey = ctx.getEditingKey();
        if (!useGlobal && editingKey) {
            editingKey.activeColor = colorInput.value;
            editingKey._previewPressed = true;
        }
        ctx.invalidateCanvas();
    }

    function toggleKeyInactiveColor(ctx) {
        if (!ctx) return;
        const useGlobal = document.getElementById('use-global-inactive').checked;
        const colorInput = document.getElementById('edit-key-inactive-color');
        if (!colorInput) return;
        colorInput.disabled = useGlobal;
        const editingKey = ctx.getEditingKey();
        if (!useGlobal && editingKey) {
            editingKey.inactiveColor = colorInput.value;
            delete editingKey._previewPressed;
        }
        ctx.invalidateCanvas();
    }

    function setupKeyEditModalListeners(ctx) {
        if (!ctx) return;
        const activeColor = document.getElementById('edit-key-active-color');
        const inactiveColor = document.getElementById('edit-key-inactive-color');
        const dragHandle = document.getElementById('key-edit-drag-handle');
        if (activeColor) {
            activeColor.addEventListener('input', (e) => handleKeyActiveColorPreview(ctx, e));
        }
        if (inactiveColor) {
            inactiveColor.addEventListener('input', (e) => handleKeyInactiveColorPreview(ctx, e));
        }
        if (dragHandle) dragHandle.addEventListener('mousedown', startDragKeyEditModal);
    }

    function restoreEditingKeyFromBackup(ctx, editingKey, editingKeyBackup) {
        const keys = ctx.getKeys();
        const keyIndex = keys.findIndex((k) => k.code === editingKey.code);
        if (keyIndex === -1) return;

        const currentKey = keys[keyIndex];
        const restoredKey = JSON.parse(JSON.stringify(editingKeyBackup));
        if (currentKey && currentKey._bgImageObj) {
            restoredKey._bgImageObj = currentKey._bgImageObj;
        }
        keys[keyIndex] = restoredKey;
        ctx.setKeys(keys);
        ctx.setSelectedKey(restoredKey);
    }

    function openKeyEdit(ctx, key) {
        if (!ctx || !key) return;

        // 若当前已在编辑别的按键，且未点击保存，则先回滚该按键的所有临时修改
        const previousEditingKey = ctx.getEditingKey();
        const previousBackup = ctx.getEditingKeyBackup();
        const previousShouldCommit = !!ctx.getKeyEditShouldCommit();
        if (previousEditingKey && previousBackup && !previousShouldCommit) {
            restoreEditingKeyFromBackup(ctx, previousEditingKey, previousBackup);
        }

        ctx.setKeyEditShouldCommit(false);
        ctx.setEditingKeyBackup(JSON.parse(JSON.stringify(key)));
        ctx.setEditingKey(key);
        ctx.setSelectedKey(key);

        const CONFIG = ctx.CONFIG;
        document.getElementById('edit-key-label').value = key.label;
        document.getElementById('edit-key-width').value = key.width || CONFIG.keySize;
        document.getElementById('edit-key-height').value = key.height || CONFIG.keySize;
        document.getElementById('edit-key-x').value = Math.round(key.x);
        document.getElementById('edit-key-y').value = Math.round(key.y);

        const hasActiveColor = !!key.activeColor;
        const hasInactiveColor = !!key.inactiveColor;
        document.getElementById('use-global-active').checked = !hasActiveColor;
        document.getElementById('use-global-inactive').checked = !hasInactiveColor;
        document.getElementById('edit-key-active-color').value = key.activeColor || CONFIG.activeColor;
        document.getElementById('edit-key-inactive-color').value = key.inactiveColor || CONFIG.inactiveColor;
        document.getElementById('edit-key-active-color').disabled = !hasActiveColor;
        document.getElementById('edit-key-inactive-color').disabled = !hasInactiveColor;

        const hasCustomOpacity = key.opacity !== undefined;
        document.getElementById('use-global-opacity').checked = !hasCustomOpacity;
        const opacityValue = key.opacity !== undefined ? key.opacity : CONFIG.keyOpacity;
        document.getElementById('edit-key-opacity').value = Math.round((1 - opacityValue) * 100);
        document.getElementById('edit-key-opacity-val').textContent = Math.round((1 - opacityValue) * 100);
        document.getElementById('edit-key-opacity').disabled = !hasCustomOpacity;

        const bgOpacityRow = document.getElementById('key-bg-opacity-row');
        const bgModeRow = document.getElementById('key-bg-mode-row');
        const bgAdvancedRow = document.getElementById('key-bg-advanced-row');
        if (key.bgImage) {
            bgOpacityRow.style.display = 'flex';
            bgModeRow.style.display = 'flex';
            const bgOpacityValue = key.bgOpacity !== undefined ? key.bgOpacity : 1.0;
            document.getElementById('edit-key-bg-opacity').value = Math.round((1 - bgOpacityValue) * 100);
            document.getElementById('edit-key-bg-opacity-val').textContent = Math.round((1 - bgOpacityValue) * 100);

            ctx.setKeyBgMode(key.bgMode || 'advanced');
            ctx.updateKeyBgModeUI();

            const bgScaleValue = key.bgScale !== undefined ? key.bgScale : 1.0;
            document.getElementById('edit-key-bg-scale').value = Math.round(bgScaleValue * 100);
            document.getElementById('edit-key-bg-scale-val').textContent = Math.round(bgScaleValue * 100);
        } else {
            bgOpacityRow.style.display = 'none';
            bgModeRow.style.display = 'none';
            bgAdvancedRow.style.display = 'none';
        }

        ctx.setupKeyBackgroundImageUI(key);

        const modal = document.getElementById('key-edit-modal-content');
        modal.style.position = 'relative';
        modal.style.left = 'auto';
        modal.style.top = 'auto';
        modal.style.transform = 'none';

        ctx.setKeyBgViewMode('clipped');
        const viewModeBtn = document.getElementById('toggle-bg-view-mode');
        if (viewModeBtn) {
            viewModeBtn.textContent = '显示模式: 按键内裁剪';
        }

        document.getElementById('key-edit-modal').classList.remove('hidden');
        ctx.updateKeyList();
        ctx.invalidateCanvas();
    }

    function closeKeyEdit(ctx) {
        if (!ctx) return;
        const editingKey = ctx.getEditingKey();
        const editingKeyBackup = ctx.getEditingKeyBackup();
        const shouldCommit = !!ctx.getKeyEditShouldCommit();

        if (editingKey && editingKeyBackup && !shouldCommit) {
            restoreEditingKeyFromBackup(ctx, editingKey, editingKeyBackup);
        } else if (editingKey) {
            // 保存关闭后也保持该按键视觉选中
            ctx.setSelectedKey(editingKey);
        }

        ctx.setIsDraggingKeyBg(false);
        ctx.setDraggedKeyBg(null);

        document.getElementById('key-edit-modal').classList.add('hidden');
        ctx.setEditingKey(null);
        ctx.setEditingKeyBackup(null);
        ctx.setKeyEditShouldCommit(false);
        ctx.updateKeyList();
        ctx.invalidateCanvas();
    }

    function saveKeyEdit(ctx) {
        if (!ctx) return;
        const editingKey = ctx.getEditingKey();
        if (!editingKey) return;

        ctx.pushUndoCurrentState();
        editingKey.label = document.getElementById('edit-key-label').value || editingKey.label;
        editingKey.width = parseInt(document.getElementById('edit-key-width').value, 10) || ctx.CONFIG.keySize;
        editingKey.height = parseInt(document.getElementById('edit-key-height').value, 10) || ctx.CONFIG.keySize;
        editingKey.x = parseInt(document.getElementById('edit-key-x').value, 10) || 0;
        editingKey.y = parseInt(document.getElementById('edit-key-y').value, 10) || 0;

        const useGlobalActive = document.getElementById('use-global-active').checked;
        const useGlobalInactive = document.getElementById('use-global-inactive').checked;
        if (useGlobalActive) delete editingKey.activeColor;
        else editingKey.activeColor = document.getElementById('edit-key-active-color').value;
        if (useGlobalInactive) delete editingKey.inactiveColor;
        else editingKey.inactiveColor = document.getElementById('edit-key-inactive-color').value;

        const useGlobalOpacity = document.getElementById('use-global-opacity').checked;
        if (useGlobalOpacity) delete editingKey.opacity;
        else editingKey.opacity = (100 - parseInt(document.getElementById('edit-key-opacity').value, 10)) / 100;

        if (editingKey.bgImage) {
            editingKey.bgOpacity = (100 - parseInt(document.getElementById('edit-key-bg-opacity').value, 10)) / 100;
            if (ctx.getKeyBgMode() === 'advanced') {
                editingKey.bgScale = parseInt(document.getElementById('edit-key-bg-scale').value, 10) / 100;
            }
            editingKey.bgMode = ctx.getKeyBgMode();
        }

        delete editingKey._previewPressed;
        ctx.setKeyEditShouldCommit(true);
        closeKeyEdit(ctx);
    }

    function cancelKeyEdit(ctx) {
        if (!ctx) return;
        ctx.setKeyEditShouldCommit(false);
        closeKeyEdit(ctx);
    }

    globalObj.KeyboardKeyEditModule = {
        setupKeyEditModalListeners,
        openKeyEdit,
        closeKeyEdit,
        saveKeyEdit,
        cancelKeyEdit,
        toggleKeyActiveColor,
        toggleKeyInactiveColor,
        handleKeyActiveColorPreview,
        handleKeyInactiveColorPreview,
        startDragKeyEditModal,
        dragKeyEditModal,
        stopDragKeyEditModal
    };
})(window);
