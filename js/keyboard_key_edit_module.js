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
        if (editingKey.activeColorUseInactive) {
            editingKey.activeColor = color;
            const activeInput = document.getElementById('edit-key-active-color');
            if (activeInput) activeInput.value = color;
        }
        delete editingKey._previewPressed;
        ctx.invalidateCanvas();
    }

    function toggleKeyActiveColor(ctx) {
        if (!ctx) return;
        const useGlobal = document.getElementById('use-global-active').checked;
        const colorInput = document.getElementById('edit-key-active-color');
        if (!colorInput) return;
        const useInactive = document.getElementById('edit-key-active-use-inactive').checked;
        colorInput.disabled = useGlobal || useInactive;
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
        const textColorInput = document.getElementById('edit-key-text-color');
        if (textColorInput) {
            textColorInput.addEventListener('input', (e) => {
                const editingKey = ctx.getEditingKey();
                if (!editingKey || document.getElementById('use-global-text-color').checked) return;
                editingKey.textColor = e.target.value;
                ctx.invalidateCanvas();
            });
        }
        const borderColorInput = document.getElementById('edit-key-border-color');
        if (borderColorInput) {
            borderColorInput.addEventListener('input', (e) => {
                const editingKey = ctx.getEditingKey();
                if (!editingKey || document.getElementById('use-global-border-color').checked) return;
                editingKey.borderColor = e.target.value;
                ctx.invalidateCanvas();
            });
        }
        const textColorPressedInput = document.getElementById('edit-key-text-color-pressed');
        if (textColorPressedInput) {
            textColorPressedInput.addEventListener('input', (e) => {
                const editingKey = ctx.getEditingKey();
                if (!editingKey || document.getElementById('edit-key-text-color-pressed-use-unpressed').checked) return;
                editingKey.textColorPressed = e.target.value;
                ctx.invalidateCanvas();
            });
        }
        const borderColorPressedInput = document.getElementById('edit-key-border-color-pressed');
        if (borderColorPressedInput) {
            borderColorPressedInput.addEventListener('input', (e) => {
                const editingKey = ctx.getEditingKey();
                if (!editingKey || document.getElementById('edit-key-border-color-pressed-use-unpressed').checked) return;
                editingKey.borderColorPressed = e.target.value;
                ctx.invalidateCanvas();
            });
        }
        if (dragHandle) dragHandle.addEventListener('mousedown', startDragKeyEditModal);
    }

    function toggleKeyTextColor(ctx) {
        if (!ctx) return;
        const useGlobal = document.getElementById('use-global-text-color').checked;
        const input = document.getElementById('edit-key-text-color');
        if (!input) return;
        input.disabled = useGlobal;
        const editingKey = ctx.getEditingKey();
        if (!useGlobal && editingKey) {
            editingKey.textColor = input.value;
        } else if (editingKey) {
            delete editingKey.textColor;
        }
        ctx.invalidateCanvas();
    }

    function toggleKeyTextOpacity(ctx) {
        if (!ctx) return;
        const useGlobal = document.getElementById('use-global-text-opacity').checked;
        const range = document.getElementById('edit-key-text-opacity');
        const valEl = document.getElementById('edit-key-text-opacity-val');
        if (!range || !valEl) return;
        if (useGlobal) {
            const g = ctx.CONFIG.textOpacity !== undefined ? ctx.CONFIG.textOpacity : 1;
            const show = Math.round((1 - g) * 100);
            range.value = show;
            valEl.textContent = show;
            range.disabled = true;
            if (ctx.getEditingKey()) {
                delete ctx.getEditingKey().textOpacity;
            }
        } else {
            range.disabled = false;
            if (ctx.getEditingKey()) {
                ctx.getEditingKey().textOpacity = (100 - parseInt(range.value, 10)) / 100;
            }
        }
        ctx.invalidateCanvas();
    }

    function updateKeyTextOpacityPreview(ctx, value) {
        const valEl = document.getElementById('edit-key-text-opacity-val');
        if (valEl) valEl.textContent = value;
        if (ctx.getEditingKey()) {
            ctx.getEditingKey().textOpacity = (100 - parseInt(value, 10)) / 100;
        }
        ctx.invalidateCanvas();
    }

    function toggleKeyBorderColor(ctx) {
        if (!ctx) return;
        const useGlobal = document.getElementById('use-global-border-color').checked;
        const input = document.getElementById('edit-key-border-color');
        if (!input) return;
        input.disabled = useGlobal;
        const editingKey = ctx.getEditingKey();
        if (!useGlobal && editingKey) {
            editingKey.borderColor = input.value;
        } else if (editingKey) {
            delete editingKey.borderColor;
        }
        ctx.invalidateCanvas();
    }

    function toggleKeyBorderOpacity(ctx) {
        if (!ctx) return;
        const useGlobal = document.getElementById('use-global-border-opacity').checked;
        const range = document.getElementById('edit-key-border-opacity');
        const valEl = document.getElementById('edit-key-border-opacity-val');
        if (!range || !valEl) return;
        if (useGlobal) {
            const g = ctx.CONFIG.borderOpacity !== undefined ? ctx.CONFIG.borderOpacity : 1;
            const show = Math.round((1 - g) * 100);
            range.value = show;
            valEl.textContent = show;
            range.disabled = true;
            if (ctx.getEditingKey()) {
                delete ctx.getEditingKey().borderOpacity;
            }
        } else {
            range.disabled = false;
            if (ctx.getEditingKey()) {
                ctx.getEditingKey().borderOpacity = (100 - parseInt(range.value, 10)) / 100;
            }
        }
        ctx.invalidateCanvas();
    }

    function updateKeyBorderOpacityPreview(ctx, value) {
        const valEl = document.getElementById('edit-key-border-opacity-val');
        if (valEl) valEl.textContent = value;
        if (ctx.getEditingKey()) {
            ctx.getEditingKey().borderOpacity = (100 - parseInt(value, 10)) / 100;
        }
        ctx.invalidateCanvas();
    }

    function toggleKeyActiveUseInactive(ctx) {
        if (!ctx) return;
        const cb = document.getElementById('edit-key-active-use-inactive');
        const input = document.getElementById('edit-key-active-color');
        if (!cb || !input) return;
        const editingKey = ctx.getEditingKey();
        if (!editingKey) return;
        editingKey.activeColorUseInactive = !!cb.checked;
        if (editingKey.activeColorUseInactive) {
            const next = editingKey.inactiveColor || ctx.CONFIG.inactiveColor;
            editingKey.activeColor = next;
            input.value = next;
        }
        input.disabled = cb.checked || document.getElementById('use-global-active').checked;
        editingKey._previewPressed = true;
        ctx.invalidateCanvas();
    }

    function toggleKeyOpacityPressedUseUnpressedInEdit(ctx) {
        if (!ctx) return;
        const cb = document.getElementById('edit-key-opacity-pressed-use-unpressed');
        const input = document.getElementById('edit-key-opacity-pressed');
        const value = document.getElementById('edit-key-opacity-pressed-val');
        if (!cb || !input || !value) return;
        const editingKey = ctx.getEditingKey();
        if (!editingKey) return;
        editingKey.opacityPressedUseUnpressed = !!cb.checked;
        if (editingKey.opacityPressedUseUnpressed) {
            const base = editingKey.opacity !== undefined ? editingKey.opacity : ctx.CONFIG.keyOpacity;
            editingKey.opacityPressed = base;
            const p = Math.round((1 - base) * 100);
            input.value = p;
            value.textContent = p;
        }
        input.disabled = cb.checked;
        ctx.invalidateCanvas();
    }

    function updateKeyOpacityPressedPreview(ctx, value) {
        const valEl = document.getElementById('edit-key-opacity-pressed-val');
        if (valEl) valEl.textContent = value;
        const editingKey = ctx.getEditingKey();
        if (editingKey) {
            editingKey.opacityPressed = (100 - parseInt(value, 10)) / 100;
        }
        ctx.invalidateCanvas();
    }

    function toggleKeyTextColorPressedUseUnpressed(ctx) {
        if (!ctx) return;
        const cb = document.getElementById('edit-key-text-color-pressed-use-unpressed');
        const input = document.getElementById('edit-key-text-color-pressed');
        if (!cb || !input) return;
        const editingKey = ctx.getEditingKey();
        if (!editingKey) return;
        editingKey.textColorPressedUseUnpressed = !!cb.checked;
        if (editingKey.textColorPressedUseUnpressed) {
            const base = editingKey.textColor || ctx.CONFIG.textColor || '#ffffff';
            editingKey.textColorPressed = base;
            input.value = base;
        }
        input.disabled = cb.checked;
        ctx.invalidateCanvas();
    }

    function toggleKeyTextOpacityPressedUseUnpressed(ctx) {
        if (!ctx) return;
        const cb = document.getElementById('edit-key-text-opacity-pressed-use-unpressed');
        const input = document.getElementById('edit-key-text-opacity-pressed');
        const value = document.getElementById('edit-key-text-opacity-pressed-val');
        if (!cb || !input || !value) return;
        const editingKey = ctx.getEditingKey();
        if (!editingKey) return;
        editingKey.textOpacityPressedUseUnpressed = !!cb.checked;
        if (editingKey.textOpacityPressedUseUnpressed) {
            const base = editingKey.textOpacity !== undefined ? editingKey.textOpacity : ctx.CONFIG.textOpacity;
            editingKey.textOpacityPressed = base;
            const p = Math.round((1 - base) * 100);
            input.value = p;
            value.textContent = p;
        }
        input.disabled = cb.checked;
        ctx.invalidateCanvas();
    }

    function updateKeyTextOpacityPressedPreview(ctx, value) {
        const valEl = document.getElementById('edit-key-text-opacity-pressed-val');
        if (valEl) valEl.textContent = value;
        const editingKey = ctx.getEditingKey();
        if (editingKey) {
            editingKey.textOpacityPressed = (100 - parseInt(value, 10)) / 100;
        }
        ctx.invalidateCanvas();
    }

    function toggleKeyBorderColorPressedUseUnpressed(ctx) {
        if (!ctx) return;
        const cb = document.getElementById('edit-key-border-color-pressed-use-unpressed');
        const input = document.getElementById('edit-key-border-color-pressed');
        if (!cb || !input) return;
        const editingKey = ctx.getEditingKey();
        if (!editingKey) return;
        editingKey.borderColorPressedUseUnpressed = !!cb.checked;
        if (editingKey.borderColorPressedUseUnpressed) {
            const base = editingKey.borderColor || ctx.CONFIG.borderColor || '#555555';
            editingKey.borderColorPressed = base;
            input.value = base;
        }
        input.disabled = cb.checked;
        ctx.invalidateCanvas();
    }

    function toggleKeyBorderOpacityPressedUseUnpressed(ctx) {
        if (!ctx) return;
        const cb = document.getElementById('edit-key-border-opacity-pressed-use-unpressed');
        const input = document.getElementById('edit-key-border-opacity-pressed');
        const value = document.getElementById('edit-key-border-opacity-pressed-val');
        if (!cb || !input || !value) return;
        const editingKey = ctx.getEditingKey();
        if (!editingKey) return;
        editingKey.borderOpacityPressedUseUnpressed = !!cb.checked;
        if (editingKey.borderOpacityPressedUseUnpressed) {
            const base = editingKey.borderOpacity !== undefined ? editingKey.borderOpacity : ctx.CONFIG.borderOpacity;
            editingKey.borderOpacityPressed = base;
            const p = Math.round((1 - base) * 100);
            input.value = p;
            value.textContent = p;
        }
        input.disabled = cb.checked;
        ctx.invalidateCanvas();
    }

    function updateKeyBorderOpacityPressedPreview(ctx, value) {
        const valEl = document.getElementById('edit-key-border-opacity-pressed-val');
        if (valEl) valEl.textContent = value;
        const editingKey = ctx.getEditingKey();
        if (editingKey) {
            editingKey.borderOpacityPressed = (100 - parseInt(value, 10)) / 100;
        }
        ctx.invalidateCanvas();
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
        if (currentKey && currentKey._bgPressedImageObj) {
            restoredKey._bgPressedImageObj = currentKey._bgPressedImageObj;
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
        const activeUseInactive = key.activeColorUseInactive === true;
        document.getElementById('edit-key-active-use-inactive').checked = activeUseInactive;
        document.getElementById('edit-key-active-color').disabled = !hasActiveColor || activeUseInactive;
        document.getElementById('edit-key-inactive-color').disabled = !hasInactiveColor;

        const hasCustomOpacity = key.opacity !== undefined;
        document.getElementById('use-global-opacity').checked = !hasCustomOpacity;
        const opacityValue = key.opacity !== undefined ? key.opacity : CONFIG.keyOpacity;
        document.getElementById('edit-key-opacity').value = Math.round((1 - opacityValue) * 100);
        document.getElementById('edit-key-opacity-val').textContent = Math.round((1 - opacityValue) * 100);
        document.getElementById('edit-key-opacity').disabled = !hasCustomOpacity;
        const opacityPressedUse = key.opacityPressedUseUnpressed !== undefined ? key.opacityPressedUseUnpressed : true;
        document.getElementById('edit-key-opacity-pressed-use-unpressed').checked = opacityPressedUse;
        const opPressedValue =
            opacityPressedUse
                ? opacityValue
                : key.opacityPressed !== undefined
                  ? key.opacityPressed
                  : opacityValue;
        document.getElementById('edit-key-opacity-pressed').value = Math.round((1 - opPressedValue) * 100);
        document.getElementById('edit-key-opacity-pressed-val').textContent = Math.round((1 - opPressedValue) * 100);
        document.getElementById('edit-key-opacity-pressed').disabled = opacityPressedUse;

        const hasCustomTextColor = key.textColor !== undefined;
        document.getElementById('use-global-text-color').checked = !hasCustomTextColor;
        document.getElementById('edit-key-text-color').value =
            key.textColor || CONFIG.textColor || '#ffffff';
        document.getElementById('edit-key-text-color').disabled = !hasCustomTextColor;
        const textColorPressedUse =
            key.textColorPressedUseUnpressed !== undefined ? key.textColorPressedUseUnpressed : true;
        document.getElementById('edit-key-text-color-pressed-use-unpressed').checked = textColorPressedUse;
        const textColorPressedVal = textColorPressedUse
            ? key.textColor || CONFIG.textColor || '#ffffff'
            : key.textColorPressed || key.textColor || CONFIG.textColor || '#ffffff';
        document.getElementById('edit-key-text-color-pressed').value = textColorPressedVal;
        document.getElementById('edit-key-text-color-pressed').disabled = textColorPressedUse;

        const hasCustomTextOpacity = key.textOpacity !== undefined;
        document.getElementById('use-global-text-opacity').checked = !hasCustomTextOpacity;
        const textOpVal =
            key.textOpacity !== undefined ? key.textOpacity : CONFIG.textOpacity !== undefined ? CONFIG.textOpacity : 1;
        document.getElementById('edit-key-text-opacity').value = Math.round((1 - textOpVal) * 100);
        document.getElementById('edit-key-text-opacity-val').textContent = Math.round((1 - textOpVal) * 100);
        document.getElementById('edit-key-text-opacity').disabled = !hasCustomTextOpacity;
        const textOpPressedUse =
            key.textOpacityPressedUseUnpressed !== undefined ? key.textOpacityPressedUseUnpressed : true;
        document.getElementById('edit-key-text-opacity-pressed-use-unpressed').checked = textOpPressedUse;
        const textOpPressedVal = textOpPressedUse
            ? textOpVal
            : key.textOpacityPressed !== undefined
              ? key.textOpacityPressed
              : textOpVal;
        document.getElementById('edit-key-text-opacity-pressed').value = Math.round((1 - textOpPressedVal) * 100);
        document.getElementById('edit-key-text-opacity-pressed-val').textContent = Math.round((1 - textOpPressedVal) * 100);
        document.getElementById('edit-key-text-opacity-pressed').disabled = textOpPressedUse;

        const hasCustomBorderColor = key.borderColor !== undefined;
        document.getElementById('use-global-border-color').checked = !hasCustomBorderColor;
        document.getElementById('edit-key-border-color').value =
            key.borderColor || CONFIG.borderColor || '#555555';
        document.getElementById('edit-key-border-color').disabled = !hasCustomBorderColor;
        const borderColorPressedUse =
            key.borderColorPressedUseUnpressed !== undefined ? key.borderColorPressedUseUnpressed : true;
        document.getElementById('edit-key-border-color-pressed-use-unpressed').checked = borderColorPressedUse;
        const borderColorPressedVal = borderColorPressedUse
            ? key.borderColor || CONFIG.borderColor || '#555555'
            : key.borderColorPressed || key.borderColor || CONFIG.borderColor || '#555555';
        document.getElementById('edit-key-border-color-pressed').value = borderColorPressedVal;
        document.getElementById('edit-key-border-color-pressed').disabled = borderColorPressedUse;

        const hasCustomBorderOpacity = key.borderOpacity !== undefined;
        document.getElementById('use-global-border-opacity').checked = !hasCustomBorderOpacity;
        const borderOpVal =
            key.borderOpacity !== undefined
                ? key.borderOpacity
                : CONFIG.borderOpacity !== undefined
                  ? CONFIG.borderOpacity
                  : 1;
        document.getElementById('edit-key-border-opacity').value = Math.round((1 - borderOpVal) * 100);
        document.getElementById('edit-key-border-opacity-val').textContent = Math.round((1 - borderOpVal) * 100);
        document.getElementById('edit-key-border-opacity').disabled = !hasCustomBorderOpacity;
        const borderOpPressedUse =
            key.borderOpacityPressedUseUnpressed !== undefined ? key.borderOpacityPressedUseUnpressed : true;
        document.getElementById('edit-key-border-opacity-pressed-use-unpressed').checked = borderOpPressedUse;
        const borderOpPressedVal = borderOpPressedUse
            ? borderOpVal
            : key.borderOpacityPressed !== undefined
              ? key.borderOpacityPressed
              : borderOpVal;
        document.getElementById('edit-key-border-opacity-pressed').value = Math.round((1 - borderOpPressedVal) * 100);
        document.getElementById('edit-key-border-opacity-pressed-val').textContent = Math.round((1 - borderOpPressedVal) * 100);
        document.getElementById('edit-key-border-opacity-pressed').disabled = borderOpPressedUse;

        const bgOpacityRow = document.getElementById('key-bg-opacity-row');
        const bgModeRow = document.getElementById('key-bg-mode-row');
        const bgAdvancedRow = document.getElementById('key-bg-advanced-row');
        if (key.bgImage) {
            bgOpacityRow.style.display = 'flex';
            bgModeRow.style.display = 'flex';
            const bgOpacityValue = key.bgOpacity !== undefined ? key.bgOpacity : 1.0;
            document.getElementById('edit-key-bg-opacity').value = Math.round((1 - bgOpacityValue) * 100);
            document.getElementById('edit-key-bg-opacity-val').textContent = Math.round((1 - bgOpacityValue) * 100);
            const bgOpacityPressedUse =
                key.bgOpacityPressedUseUnpressed !== undefined ? key.bgOpacityPressedUseUnpressed : true;
            document.getElementById('edit-key-bg-opacity-pressed-use-unpressed').checked = bgOpacityPressedUse;
            const bgOpacityPressedVal = bgOpacityPressedUse
                ? bgOpacityValue
                : key.bgOpacityPressed !== undefined
                  ? key.bgOpacityPressed
                  : bgOpacityValue;
            document.getElementById('edit-key-bg-opacity-pressed').value = Math.round((1 - bgOpacityPressedVal) * 100);
            document.getElementById('edit-key-bg-opacity-pressed-val').textContent = Math.round((1 - bgOpacityPressedVal) * 100);
            document.getElementById('edit-key-bg-opacity-pressed').disabled = bgOpacityPressedUse;

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
        ctx.setupKeyBackgroundPressedImageUI(key);
        const pressedRow = document.getElementById('key-bg-pressed-row');
        if (pressedRow) {
            pressedRow.style.display = key.bgImage ? 'flex' : 'none';
        }

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
        if (useGlobalActive) {
            delete editingKey.activeColor;
            delete editingKey.activeColorUseInactive;
        }
        else editingKey.activeColor = document.getElementById('edit-key-active-color').value;
        if (useGlobalInactive) delete editingKey.inactiveColor;
        else editingKey.inactiveColor = document.getElementById('edit-key-inactive-color').value;
        if (!useGlobalActive) {
            editingKey.activeColorUseInactive = document.getElementById('edit-key-active-use-inactive').checked;
        }

        const useGlobalOpacity = document.getElementById('use-global-opacity').checked;
        if (useGlobalOpacity) {
            delete editingKey.opacity;
            delete editingKey.opacityPressed;
            delete editingKey.opacityPressedUseUnpressed;
        } else {
            editingKey.opacity = (100 - parseInt(document.getElementById('edit-key-opacity').value, 10)) / 100;
            editingKey.opacityPressedUseUnpressed =
                document.getElementById('edit-key-opacity-pressed-use-unpressed').checked;
            if (editingKey.opacityPressedUseUnpressed) {
                editingKey.opacityPressed = editingKey.opacity;
            } else {
                editingKey.opacityPressed =
                    (100 - parseInt(document.getElementById('edit-key-opacity-pressed').value, 10)) / 100;
            }
        }

        const useGlobalTextColor = document.getElementById('use-global-text-color').checked;
        if (useGlobalTextColor) {
            delete editingKey.textColor;
            delete editingKey.textColorPressed;
            delete editingKey.textColorPressedUseUnpressed;
        }
        else editingKey.textColor = document.getElementById('edit-key-text-color').value;
        if (!useGlobalTextColor) {
            editingKey.textColorPressedUseUnpressed =
                document.getElementById('edit-key-text-color-pressed-use-unpressed').checked;
            if (editingKey.textColorPressedUseUnpressed) {
                editingKey.textColorPressed = editingKey.textColor || ctx.CONFIG.textColor || '#ffffff';
            } else {
                editingKey.textColorPressed = document.getElementById('edit-key-text-color-pressed').value;
            }
        } else {
            delete editingKey.textColorPressed;
        }

        const useGlobalTextOpacity = document.getElementById('use-global-text-opacity').checked;
        if (useGlobalTextOpacity) {
            delete editingKey.textOpacity;
            delete editingKey.textOpacityPressed;
            delete editingKey.textOpacityPressedUseUnpressed;
        } else {
            editingKey.textOpacity =
                (100 - parseInt(document.getElementById('edit-key-text-opacity').value, 10)) / 100;
            editingKey.textOpacityPressedUseUnpressed =
                document.getElementById('edit-key-text-opacity-pressed-use-unpressed').checked;
            if (editingKey.textOpacityPressedUseUnpressed) {
                editingKey.textOpacityPressed = editingKey.textOpacity;
            } else {
                editingKey.textOpacityPressed =
                    (100 - parseInt(document.getElementById('edit-key-text-opacity-pressed').value, 10)) / 100;
            }
        }

        const useGlobalBorderColor = document.getElementById('use-global-border-color').checked;
        if (useGlobalBorderColor) {
            delete editingKey.borderColor;
            delete editingKey.borderColorPressed;
            delete editingKey.borderColorPressedUseUnpressed;
        }
        else editingKey.borderColor = document.getElementById('edit-key-border-color').value;
        if (!useGlobalBorderColor) {
            editingKey.borderColorPressedUseUnpressed =
                document.getElementById('edit-key-border-color-pressed-use-unpressed').checked;
            if (editingKey.borderColorPressedUseUnpressed) {
                editingKey.borderColorPressed = editingKey.borderColor || ctx.CONFIG.borderColor || '#555555';
            } else {
                editingKey.borderColorPressed = document.getElementById('edit-key-border-color-pressed').value;
            }
        } else {
            delete editingKey.borderColorPressed;
        }

        const useGlobalBorderOpacity = document.getElementById('use-global-border-opacity').checked;
        if (useGlobalBorderOpacity) {
            delete editingKey.borderOpacity;
            delete editingKey.borderOpacityPressed;
            delete editingKey.borderOpacityPressedUseUnpressed;
        } else {
            editingKey.borderOpacity =
                (100 - parseInt(document.getElementById('edit-key-border-opacity').value, 10)) / 100;
            editingKey.borderOpacityPressedUseUnpressed =
                document.getElementById('edit-key-border-opacity-pressed-use-unpressed').checked;
            if (editingKey.borderOpacityPressedUseUnpressed) {
                editingKey.borderOpacityPressed = editingKey.borderOpacity;
            } else {
                editingKey.borderOpacityPressed =
                    (100 - parseInt(document.getElementById('edit-key-border-opacity-pressed').value, 10)) / 100;
            }
        }

        if (editingKey.bgImage) {
            editingKey.bgOpacity = (100 - parseInt(document.getElementById('edit-key-bg-opacity').value, 10)) / 100;
            editingKey.bgOpacityPressedUseUnpressed =
                document.getElementById('edit-key-bg-opacity-pressed-use-unpressed').checked;
            if (editingKey.bgOpacityPressedUseUnpressed) {
                editingKey.bgOpacityPressed = editingKey.bgOpacity;
            } else {
                editingKey.bgOpacityPressed =
                    (100 - parseInt(document.getElementById('edit-key-bg-opacity-pressed').value, 10)) / 100;
            }
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
        toggleKeyTextColor,
        toggleKeyTextOpacity,
        updateKeyTextOpacityPreview,
        toggleKeyActiveUseInactive,
        toggleKeyOpacityPressedUseUnpressedInEdit,
        updateKeyOpacityPressedPreview,
        toggleKeyTextColorPressedUseUnpressed,
        toggleKeyTextOpacityPressedUseUnpressed,
        updateKeyTextOpacityPressedPreview,
        toggleKeyBorderColor,
        toggleKeyBorderOpacity,
        updateKeyBorderOpacityPreview,
        toggleKeyBorderColorPressedUseUnpressed,
        toggleKeyBorderOpacityPressedUseUnpressed,
        updateKeyBorderOpacityPressedPreview,
        startDragKeyEditModal,
        dragKeyEditModal,
        stopDragKeyEditModal
    };
})(window);
