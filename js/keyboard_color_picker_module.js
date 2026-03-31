(function initKeyboardColorPickerModule(globalObj) {
    'use strict';

    const colorPickerModalDrag = {
        isDragging: false,
        offsetX: 0,
        offsetY: 0
    };

    function resetColorPickerPanelPosition() {
        const panel = document.getElementById('color-picker-modal-content');
        if (!panel) return;
        panel.style.position = 'fixed';
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.margin = '0';
    }

    function dragColorPickerPanel(e) {
        if (!colorPickerModalDrag.isDragging) return;
        const panel = document.getElementById('color-picker-modal-content');
        if (!panel) return;

        let newX = e.clientX - colorPickerModalDrag.offsetX;
        let newY = e.clientY - colorPickerModalDrag.offsetY;
        const maxX = window.innerWidth - panel.offsetWidth;
        const maxY = window.innerHeight - panel.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';
    }

    function stopDragColorPickerPanel() {
        colorPickerModalDrag.isDragging = false;
        document.removeEventListener('mousemove', dragColorPickerPanel);
        document.removeEventListener('mouseup', stopDragColorPickerPanel);
    }

    function startDragColorPickerPanel(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        const panel = document.getElementById('color-picker-modal-content');
        if (!panel) return;

        const rect = panel.getBoundingClientRect();
        colorPickerModalDrag.isDragging = true;
        colorPickerModalDrag.offsetX = e.clientX - rect.left;
        colorPickerModalDrag.offsetY = e.clientY - rect.top;

        panel.style.position = 'fixed';
        panel.style.left = rect.left + 'px';
        panel.style.top = rect.top + 'px';
        panel.style.transform = 'none';

        document.addEventListener('mousemove', dragColorPickerPanel);
        document.addEventListener('mouseup', stopDragColorPickerPanel);
    }

    function bindColorPickerDragHandle() {
        const handle = document.getElementById('color-picker-drag-handle');
        if (!handle || handle.dataset.vkBound === '1') return;
        handle.dataset.vkBound = '1';
        handle.addEventListener('mousedown', startDragColorPickerPanel);
    }

    function buildColorBox(color, onSelect) {
        const colorBox = document.createElement('div');
        colorBox.style.cssText = [
            'width: 24px',
            'height: 24px',
            `background-color: ${color}`,
            'border-radius: 4px',
            'cursor: pointer',
            'border: 2px solid #555',
            'transition: transform 0.2s'
        ].join(';');
        colorBox.onmouseover = () => {
            colorBox.style.transform = 'scale(1.1)';
        };
        colorBox.onmouseout = () => {
            colorBox.style.transform = 'scale(1)';
        };
        colorBox.onclick = () => onSelect(color);
        return colorBox;
    }

    function initClassicColors(ctx) {
        const container = document.getElementById('classic-colors');
        if (!container) return;
        container.innerHTML = '';
        ctx.CLASSIC_COLORS.forEach((color) => {
            container.appendChild(buildColorBox(color, (c) => selectColor(ctx, c)));
        });
    }

    function updateHistoryColors(ctx) {
        const container = document.getElementById('history-colors');
        const section = document.getElementById('history-colors-section');
        if (!container || !section) return;
        container.innerHTML = '';

        const colorHistory = ctx.getColorHistory();
        if (colorHistory.length === 0) {
            section.style.display = 'none';
            return;
        }
        section.style.display = 'block';

        colorHistory.forEach((color) => {
            container.appendChild(buildColorBox(color, (c) => selectColor(ctx, c)));
        });
    }

    function addToHistory(ctx, color) {
        let colorHistory = ctx.getColorHistory();
        colorHistory = colorHistory.filter((c) => c !== color);
        colorHistory.unshift(color);
        if (colorHistory.length > ctx.maxHistory) {
            colorHistory = colorHistory.slice(0, ctx.maxHistory);
        }
        ctx.setColorHistory(colorHistory);
    }

    function selectColor(ctx, color) {
        const input = document.getElementById('color-picker-input');
        if (!input) return;
        const oldColor = input.value;
        if (color !== oldColor) {
            addToHistory(ctx, oldColor);
            updateHistoryColors(ctx);
            ctx.setLastSelectedColor(color);
        }
        input.value = color;
        handleColorPreview(ctx, { target: { value: color } });
    }

    function openColorPicker(ctx, target) {
        const modal = document.getElementById('color-picker-modal');
        const input = document.getElementById('color-picker-input');
        const title = document.getElementById('color-picker-title');
        if (!modal || !input || !title) return;

        if (!modal.classList.contains('hidden')) {
            closeColorPicker(ctx);
        }

        ctx.setCurrentColorTarget(target);
        if (target === 'active') {
            title.textContent = '选择按下颜色';
        } else if (target === 'inactive') {
            title.textContent = '选择未按下颜色';
        } else if (target === 'text_pressed') {
            title.textContent = '选择按下字母颜色';
        } else if (target === 'border') {
            title.textContent = '选择边框颜色';
        } else if (target === 'border_pressed') {
            title.textContent = '选择按下边框颜色';
        } else {
            title.textContent = '选择字母颜色';
        }

        let currentColor;
        if (target === 'active') {
            currentColor = ctx.CONFIG.activeColor;
        } else if (target === 'inactive') {
            currentColor = ctx.CONFIG.inactiveColor;
        } else if (target === 'text_pressed') {
            currentColor = ctx.CONFIG.textColorPressed || ctx.CONFIG.textColor || '#ffffff';
        } else if (target === 'border') {
            currentColor = ctx.CONFIG.borderColor || '#555555';
        } else if (target === 'border_pressed') {
            currentColor = ctx.CONFIG.borderColorPressed || ctx.CONFIG.borderColor || '#555555';
        } else {
            currentColor = ctx.CONFIG.textColor || '#ffffff';
        }
        input.value = currentColor;
        ctx.setOriginalColor(currentColor);
        ctx.setLastSelectedColor(currentColor);

        if (target === 'active') {
            ctx.setPreviewActiveState(true);
            ctx.getKeys().forEach((key) => {
                key._previewPressed = true;
            });
        } else {
            ctx.setPreviewActiveState(false);
        }

        resetColorPickerPanelPosition();
        bindColorPickerDragHandle();

        initClassicColors(ctx);
        updateHistoryColors(ctx);
        modal.classList.remove('hidden');
        ctx.invalidateCanvas();

        input.addEventListener('input', ctx.handleColorPreview);
        input.addEventListener('change', ctx.handleColorChange);
    }

    function handleColorPreview(ctx, e) {
        const color = e.target.value;
        const target = ctx.getCurrentColorTarget();
        if (target === 'active') {
            ctx.CONFIG.activeColor = color;
            const activePreview = document.getElementById('active-color-preview');
            if (activePreview) activePreview.style.backgroundColor = color;
        } else if (target === 'inactive') {
            ctx.CONFIG.inactiveColor = color;
            const inactivePreview = document.getElementById('inactive-color-preview');
            if (inactivePreview) inactivePreview.style.backgroundColor = color;
            if (ctx.CONFIG.activeColorUseInactive) {
                ctx.CONFIG.activeColor = color;
                const activePreview = document.getElementById('active-color-preview');
                if (activePreview) activePreview.style.backgroundColor = color;
            }
        } else if (target === 'text_pressed') {
            ctx.CONFIG.textColorPressed = color;
            const textPressedPreview = document.getElementById('text-color-pressed-preview');
            if (textPressedPreview) textPressedPreview.style.backgroundColor = color;
        } else if (target === 'border') {
            ctx.CONFIG.borderColor = color;
            const borderPreview = document.getElementById('border-color-preview');
            if (borderPreview) borderPreview.style.backgroundColor = color;
            if (ctx.CONFIG.borderColorPressedUseUnpressed) {
                ctx.CONFIG.borderColorPressed = color;
                const borderPressedPreview = document.getElementById('border-color-pressed-preview');
                if (borderPressedPreview) borderPressedPreview.style.backgroundColor = color;
            }
        } else if (target === 'border_pressed') {
            ctx.CONFIG.borderColorPressed = color;
            const borderPressedPreview = document.getElementById('border-color-pressed-preview');
            if (borderPressedPreview) borderPressedPreview.style.backgroundColor = color;
        } else {
            ctx.CONFIG.textColor = color;
            const textPreview = document.getElementById('text-color-preview');
            if (textPreview) textPreview.style.backgroundColor = color;
            if (ctx.CONFIG.textColorPressedUseUnpressed) {
                ctx.CONFIG.textColorPressed = color;
                const textPressedPreview = document.getElementById('text-color-pressed-preview');
                if (textPressedPreview) textPressedPreview.style.backgroundColor = color;
            }
        }
        ctx.invalidateCanvas();
    }

    function handleColorChange(ctx, e) {
        const color = e.target.value;
        if (color !== ctx.getLastSelectedColor()) {
            addToHistory(ctx, ctx.getLastSelectedColor());
            updateHistoryColors(ctx);
            ctx.setLastSelectedColor(color);
        }
    }

    function confirmColorPick(ctx) {
        const input = document.getElementById('color-picker-input');
        if (!input) return;
        const color = input.value;
        const target = ctx.getCurrentColorTarget();
        if (target === 'active') {
            ctx.CONFIG.activeColor = color;
            const activePreview = document.getElementById('active-color-preview');
            if (activePreview) activePreview.style.backgroundColor = color;
        } else if (target === 'inactive') {
            ctx.CONFIG.inactiveColor = color;
            const inactivePreview = document.getElementById('inactive-color-preview');
            if (inactivePreview) inactivePreview.style.backgroundColor = color;
            if (ctx.CONFIG.activeColorUseInactive) {
                ctx.CONFIG.activeColor = color;
                const activePreview = document.getElementById('active-color-preview');
                if (activePreview) activePreview.style.backgroundColor = color;
            }
        } else if (target === 'text_pressed') {
            ctx.CONFIG.textColorPressed = color;
            const textPressedPreview = document.getElementById('text-color-pressed-preview');
            if (textPressedPreview) textPressedPreview.style.backgroundColor = color;
        } else if (target === 'border') {
            ctx.CONFIG.borderColor = color;
            const borderPreview = document.getElementById('border-color-preview');
            if (borderPreview) borderPreview.style.backgroundColor = color;
            if (ctx.CONFIG.borderColorPressedUseUnpressed) {
                ctx.CONFIG.borderColorPressed = color;
                const borderPressedPreview = document.getElementById('border-color-pressed-preview');
                if (borderPressedPreview) borderPressedPreview.style.backgroundColor = color;
            }
        } else if (target === 'border_pressed') {
            ctx.CONFIG.borderColorPressed = color;
            const borderPressedPreview = document.getElementById('border-color-pressed-preview');
            if (borderPressedPreview) borderPressedPreview.style.backgroundColor = color;
        } else {
            ctx.CONFIG.textColor = color;
            const textPreview = document.getElementById('text-color-preview');
            if (textPreview) textPreview.style.backgroundColor = color;
            if (ctx.CONFIG.textColorPressedUseUnpressed) {
                ctx.CONFIG.textColorPressed = color;
                const textPressedPreview = document.getElementById('text-color-pressed-preview');
                if (textPressedPreview) textPressedPreview.style.backgroundColor = color;
            }
        }
        closeColorPicker(ctx);
    }

    function cancelColorPick(ctx) {
        const originalColor = ctx.getOriginalColor();
        const target = ctx.getCurrentColorTarget();
        if (target === 'active') {
            ctx.CONFIG.activeColor = originalColor;
            const activePreview = document.getElementById('active-color-preview');
            if (activePreview) activePreview.style.backgroundColor = originalColor;
        } else if (target === 'inactive') {
            ctx.CONFIG.inactiveColor = originalColor;
            const inactivePreview = document.getElementById('inactive-color-preview');
            if (inactivePreview) inactivePreview.style.backgroundColor = originalColor;
            if (ctx.CONFIG.activeColorUseInactive) {
                ctx.CONFIG.activeColor = originalColor;
                const activePreview = document.getElementById('active-color-preview');
                if (activePreview) activePreview.style.backgroundColor = originalColor;
            }
        } else if (target === 'text_pressed') {
            ctx.CONFIG.textColorPressed = originalColor;
            const textPressedPreview = document.getElementById('text-color-pressed-preview');
            if (textPressedPreview) textPressedPreview.style.backgroundColor = originalColor;
        } else if (target === 'border') {
            ctx.CONFIG.borderColor = originalColor;
            const borderPreview = document.getElementById('border-color-preview');
            if (borderPreview) borderPreview.style.backgroundColor = originalColor;
            if (ctx.CONFIG.borderColorPressedUseUnpressed) {
                ctx.CONFIG.borderColorPressed = originalColor;
                const borderPressedPreview = document.getElementById('border-color-pressed-preview');
                if (borderPressedPreview) borderPressedPreview.style.backgroundColor = originalColor;
            }
        } else if (target === 'border_pressed') {
            ctx.CONFIG.borderColorPressed = originalColor;
            const borderPressedPreview = document.getElementById('border-color-pressed-preview');
            if (borderPressedPreview) borderPressedPreview.style.backgroundColor = originalColor;
        } else {
            ctx.CONFIG.textColor = originalColor;
            const textPreview = document.getElementById('text-color-preview');
            if (textPreview) textPreview.style.backgroundColor = originalColor;
            if (ctx.CONFIG.textColorPressedUseUnpressed) {
                ctx.CONFIG.textColorPressed = originalColor;
                const textPressedPreview = document.getElementById('text-color-pressed-preview');
                if (textPressedPreview) textPressedPreview.style.backgroundColor = originalColor;
            }
        }
        closeColorPicker(ctx);
    }

    function closeColorPicker(ctx) {
        const modal = document.getElementById('color-picker-modal');
        const input = document.getElementById('color-picker-input');
        if (!modal || !input) return;

        input.removeEventListener('input', ctx.handleColorPreview);
        input.removeEventListener('change', ctx.handleColorChange);

        if (ctx.getPreviewActiveState()) {
            ctx.getKeys().forEach((key) => {
                delete key._previewPressed;
            });
            ctx.setPreviewActiveState(false);
        }

        stopDragColorPickerPanel();
        modal.classList.add('hidden');
        ctx.setCurrentColorTarget(null);
        ctx.setOriginalColor(null);
        ctx.setLastSelectedColor(null);
        ctx.invalidateCanvas();
    }

    function initColorPickerModalUi() {
        bindColorPickerDragHandle();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initColorPickerModalUi);
    } else {
        initColorPickerModalUi();
    }

    globalObj.KeyboardColorPickerModule = {
        initClassicColors,
        updateHistoryColors,
        addToHistory,
        selectColor,
        openColorPicker,
        handleColorPreview,
        handleColorChange,
        confirmColorPick,
        cancelColorPick,
        closeColorPicker,
        bindColorPickerDragHandle,
        resetColorPickerPanelPosition
    };
})(window);
