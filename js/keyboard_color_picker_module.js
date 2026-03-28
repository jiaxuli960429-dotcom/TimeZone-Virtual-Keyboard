(function initKeyboardColorPickerModule(globalObj) {
    'use strict';

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
        title.textContent = target === 'active' ? '选择按下颜色' : '选择未按下颜色';

        const currentColor = target === 'active' ? ctx.CONFIG.activeColor : ctx.CONFIG.inactiveColor;
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

        initClassicColors(ctx);
        updateHistoryColors(ctx);
        modal.classList.remove('hidden');
        ctx.invalidateCanvas();

        input.addEventListener('input', ctx.handleColorPreview);
        input.addEventListener('change', ctx.handleColorChange);
    }

    function handleColorPreview(ctx, e) {
        const color = e.target.value;
        if (ctx.getCurrentColorTarget() === 'active') {
            ctx.CONFIG.activeColor = color;
            const activePreview = document.getElementById('active-color-preview');
            if (activePreview) activePreview.style.backgroundColor = color;
        } else {
            ctx.CONFIG.inactiveColor = color;
            const inactivePreview = document.getElementById('inactive-color-preview');
            if (inactivePreview) inactivePreview.style.backgroundColor = color;
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
        if (ctx.getCurrentColorTarget() === 'active') {
            ctx.CONFIG.activeColor = color;
            const activePreview = document.getElementById('active-color-preview');
            if (activePreview) activePreview.style.backgroundColor = color;
        } else {
            ctx.CONFIG.inactiveColor = color;
            const inactivePreview = document.getElementById('inactive-color-preview');
            if (inactivePreview) inactivePreview.style.backgroundColor = color;
        }
        closeColorPicker(ctx);
    }

    function cancelColorPick(ctx) {
        const originalColor = ctx.getOriginalColor();
        if (ctx.getCurrentColorTarget() === 'active') {
            ctx.CONFIG.activeColor = originalColor;
            const activePreview = document.getElementById('active-color-preview');
            if (activePreview) activePreview.style.backgroundColor = originalColor;
        } else {
            ctx.CONFIG.inactiveColor = originalColor;
            const inactivePreview = document.getElementById('inactive-color-preview');
            if (inactivePreview) inactivePreview.style.backgroundColor = originalColor;
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

        modal.classList.add('hidden');
        ctx.setCurrentColorTarget(null);
        ctx.setOriginalColor(null);
        ctx.setLastSelectedColor(null);
        ctx.invalidateCanvas();
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
        closeColorPicker
    };
})(window);
