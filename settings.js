(function () {
    var Logs = window.LogsCore;
    var TitleParse = window.TitleParse;

    // 版本号取自页面标题「作业王v1.6.5 - 高级设置」，与 app.js 保持同步
    var versionMatch = document.title.match(/v([\d.]+)/);
    var APP_VERSION = versionMatch ? versionMatch[1] : '1.6.5';

    function getSetting(key) {
        var v = localStorage.getItem(key);
        return v === null ? '' : v;
    }

    function setSetting(key, value) {
        if (value === '') {
            localStorage.removeItem(key); // 空值=默认，不落盘
        } else {
            localStorage.setItem(key, value);
        }
    }

    var KEY = 'customTitleRaw';
    var input = document.getElementById('title-raw');
    var preview = document.getElementById('title-preview');
    var toast = document.getElementById('settings-toast');
    var saveBtn = document.getElementById('settings-save');
    var resetBtn = document.getElementById('settings-reset');

    // 初始值
    input.value = getSetting(KEY);

    function renderPreview() {
        var raw = input.value.trim();
        var nodes;
        if (raw) {
            nodes = TitleParse.parseTitle(raw);
        } else {
            nodes = [{ type: 'text', text: '作业王v' + APP_VERSION + '-大家的最爱' }];
        }
        preview.textContent = '';
        TitleParse.renderTitle(preview, nodes, TitleParse.isSafeLinkUrl);
    }

    function showToast(message) {
        toast.textContent = message;
        toast.hidden = false;
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(function () {
            toast.hidden = true;
        }, 2000);
    }

    input.addEventListener('input', renderPreview);

    saveBtn.addEventListener('click', function () {
        var value = input.value.trim();
        var oldValue = getSetting(KEY);
        if (oldValue !== value) {
            setSetting(KEY, value);
            if (Logs) {
                Logs.appendOperationLog(Logs.formatSettingLog(KEY, oldValue || '(默认)', value || '(默认)'));
            }
            showToast('已保存');
        } else {
            showToast('无改动');
        }
        renderPreview();
    });

    resetBtn.addEventListener('click', function () {
        localStorage.removeItem(KEY);
        input.value = '';
        renderPreview();
        if (Logs) {
            Logs.appendOperationLog(Logs.formatSystemLog('重置标题设置为默认', { source: 'user' }));
        }
        showToast('已恢复默认');
    });

    renderPreview();

    // ---------- Service Worker 注册 ----------
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function () {});
    }
})();