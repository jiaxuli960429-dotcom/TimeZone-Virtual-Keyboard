(function initKeyboardKeyListModule(globalObj) {
    'use strict';

    function startAddKey(ctx) {
        if (!ctx) return;
        ctx.setIsAddingKey(true);
        const hint = document.getElementById('add-key-hint');
        if (hint) hint.style.display = 'block';
    }

    function cancelAddKey(ctx) {
        if (!ctx) return;
        ctx.setIsAddingKey(false);
        const hint = document.getElementById('add-key-hint');
        if (hint) hint.style.display = 'none';
    }

    function addKey(ctx, code, label) {
        if (!ctx || !code) return;
        const keys = ctx.getKeys();
        if (keys.some((k) => k.code === code)) {
            alert('该按键已存在！');
            return;
        }

        ctx.pushUndoCurrentState();

        const displayLabel = label && label.length > 3 ? code.replace('Key', '').replace('Digit', '') : label;
        const newKey = {
            code,
            label: displayLabel,
            x: 100,
            y: 100,
            width: ctx.CONFIG.keySize,
            height: ctx.CONFIG.keySize
        };

        keys.push(newKey);
        ctx.setSelectedKey(newKey);
        ctx.updateKeyList();
        ctx.invalidateCanvas();
    }

    function removeKey(ctx, code) {
        if (!ctx || !code) return;
        ctx.pushUndoCurrentState();
        const nextKeys = ctx.getKeys().filter((k) => k.code !== code);
        ctx.setKeys(nextKeys);

        const selectedKey = ctx.getSelectedKey();
        if (selectedKey && selectedKey.code === code) {
            ctx.setSelectedKey(null);
        }
        ctx.updateKeyList();
        ctx.invalidateCanvas();
    }

    function clearAllKeys(ctx) {
        if (!ctx) return;
        if (!confirm('确定要清空所有按键吗？')) return;

        ctx.pushUndoCurrentState();
        ctx.setKeys([]);
        ctx.setSelectedKey(null);
        ctx.updateKeyList();
        ctx.invalidateCanvas();
    }

    function updateKeyList(ctx) {
        if (!ctx) return;
        const list = document.getElementById('key-list');
        if (!list) return;

        const keys = ctx.getKeys();
        const selectedKey = ctx.getSelectedKey();
        list.innerHTML = '';

        keys.forEach((key) => {
            const item = document.createElement('div');
            item.className = 'key-item';
            if (selectedKey && selectedKey.code === key.code) {
                item.classList.add('key-item-selected');
            }

            const span = document.createElement('span');
            span.className = 'key-item-label';
            span.textContent = `${key.label} [${key.width || 50}x${key.height || 50}] - (${Math.round(key.x)}, ${Math.round(key.y)})`;
            span.addEventListener('click', () => {
                selectKeyByCode(ctx, key.code);
            });
            span.addEventListener('dblclick', (ev) => {
                ev.preventDefault();
                openKeyEditByCode(ctx, key.code);
            });

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn btn-danger';
            delBtn.textContent = '删除';
            delBtn.setAttribute('aria-label', '删除该按键');
            delBtn.title = '删除该按键';
            delBtn.addEventListener('click', () => removeKey(ctx, key.code));

            item.appendChild(span);
            item.appendChild(delBtn);
            list.appendChild(item);
        });
    }

    function selectKeyByCode(ctx, code) {
        if (!ctx || !code) return;
        const key = ctx.getKeys().find((k) => k.code === code);
        if (!key) return;
        ctx.setSelectedKey(key);

        const canvas = ctx.getCanvas();
        if (canvas && typeof canvas.focus === 'function') {
            try {
                canvas.focus({ preventScroll: true });
            } catch (_) {
                canvas.focus();
            }
        }
        ctx.updateKeyList();
        ctx.invalidateCanvas();
    }

    function openKeyEditByCode(ctx, code) {
        if (!ctx || !code) return;
        const key = ctx.getKeys().find((k) => k.code === code);
        if (key) {
            ctx.openKeyEdit(key);
        }
    }

    globalObj.KeyboardKeyListModule = {
        startAddKey,
        cancelAddKey,
        addKey,
        removeKey,
        clearAllKeys,
        updateKeyList,
        selectKeyByCode,
        openKeyEditByCode
    };
})(window);
