/**
 * 作业王 v1.6.5 - JavaScript Application Logic
 * 高中作业管理单页应用
 */

var APP_VERSION = '1.6.5';

// ============================================================
// 工具函数
// ============================================================

/** 根据背景亮度返回自适应文字颜色 */
function getAdaptiveTextColor(element) {
    const computedStyle = window.getComputedStyle(element);
    const bgColor = computedStyle.backgroundColor;

    const rgb = bgColor.match(/\d+/g);
    if (!rgb || rgb.length < 3) return '#333';

    const r = parseInt(rgb[0]), g = parseInt(rgb[1]), b = parseInt(rgb[2]);
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return brightness < 0.5 ? '#ffffff' : '#333333';
}

/** 应用自适应文字颜色到所有相关元素 */
function applyAdaptiveTextColors() {
    const elements = document.querySelectorAll(
        '.modal-title, .form-group label, .homework-item, .action-button, ' +
        '.submit-button, .cancel-button, .delete-confirm-button, .modal-content p'
    );

    const isWhiteBackground = document.body.classList.contains('liquid-glass-disabled');

    elements.forEach(function (element) {
        var textColor;

        if (isWhiteBackground) {
            if (
                element.classList.contains('modal-title') ||
                element.closest('.form-group') ||
                element.classList.contains('action-button') ||
                element.classList.contains('submit-button') ||
                element.classList.contains('cancel-button') ||
                element.classList.contains('delete-confirm-button')
            ) {
                textColor = '#333333';
            } else {
                textColor = getAdaptiveTextColor(element);
            }
        } else {
            textColor = getAdaptiveTextColor(element);
        }

        element.style.color = textColor;
        element.style.textShadow = textColor === '#ffffff'
            ? '0 1px 2px rgba(0, 0, 0, 0.3)'
            : '0 1px 2px rgba(0, 0, 0, 0.1)';
    });
}

// ============================================================
// 模态框动画控制
// ============================================================

var DEFAULT_MODAL_OVERLAY_TRANSITION_MS = 300;
var DEFAULT_MODAL_CONTENT_TRANSITION_MS = 600;
var DEFAULT_MODAL_SWITCH_DELAY_MS = 600;
var FAST_MODAL_OVERLAY_TRANSITION_MS = 240;
var FAST_MODAL_CONTENT_TRANSITION_MS = 480;
var FAST_MODAL_SWITCH_DELAY_MS = 240;
var MODAL_OVERLAY_TRANSITION_MS = DEFAULT_MODAL_OVERLAY_TRANSITION_MS;
var MODAL_CONTENT_TRANSITION_MS = DEFAULT_MODAL_CONTENT_TRANSITION_MS;
var MODAL_SWITCH_DELAY_MS = DEFAULT_MODAL_SWITCH_DELAY_MS;
var MODAL_KEEP_PARENT_VISIBLE = {
    'about-modal': true,
    'clear-cache-modal': true,
    'notice-center-modal': true,
    'markdown-example-modal': true
};
var modalParentMap = {};

function getVisibleModalList(excludeModalId) {
    return Array.prototype.slice.call(document.querySelectorAll('[role="dialog"]')).filter(function (modal) {
        return modal && modal.id !== excludeModalId && modal.style.display === 'flex' && modal.classList.contains('show');
    });
}

function updateModalTimingVariables() {
    var root = document.documentElement;
    var fastAnimationEnabled = getBooleanSetting('fastAnimationEnabled', false);
    if (fastAnimationEnabled) {
        MODAL_OVERLAY_TRANSITION_MS = FAST_MODAL_OVERLAY_TRANSITION_MS;
        MODAL_CONTENT_TRANSITION_MS = FAST_MODAL_CONTENT_TRANSITION_MS;
        MODAL_SWITCH_DELAY_MS = FAST_MODAL_SWITCH_DELAY_MS;
    } else {
        MODAL_OVERLAY_TRANSITION_MS = DEFAULT_MODAL_OVERLAY_TRANSITION_MS;
        MODAL_CONTENT_TRANSITION_MS = DEFAULT_MODAL_CONTENT_TRANSITION_MS;
        MODAL_SWITCH_DELAY_MS = DEFAULT_MODAL_SWITCH_DELAY_MS;
    }

    root.style.setProperty('--modal-overlay-transition', MODAL_OVERLAY_TRANSITION_MS + 'ms');
    root.style.setProperty('--modal-content-transition', MODAL_CONTENT_TRANSITION_MS + 'ms');
}

function showModal(modalId) {
    var modal = document.getElementById(modalId);
    var content = modal.querySelector('.modal-content');
    if (content) {
        content.classList.remove('is-static');
    }
    modal.style.display = 'flex';
    modal.offsetHeight; // 强制重排触发动画
    modal.classList.add('show');

    if (content) {
        var onTransitionEnd = function (e) {
            if (e.propertyName === 'transform') {
                content.classList.add('is-static');
                content.removeEventListener('transitionend', onTransitionEnd);
            }
        };
        content.addEventListener('transitionend', onTransitionEnd);
    }
}

function restoreParentModal(modalId) {
    var parentModalId = modalParentMap[modalId];
    if (!parentModalId) return;
    delete modalParentMap[modalId];
    showModal(parentModalId);
}

function hideModal(modalId, options) {
    var modal = document.getElementById(modalId);
    var content = modal.querySelector('.modal-content');
    var config = options || {};
    var hideDelay = typeof config.hideDelay === 'number' ? config.hideDelay : MODAL_CONTENT_TRANSITION_MS;
    if (content) {
        content.classList.remove('is-static');
    }
    modal.classList.remove('show');
    setTimeout(function () {
        modal.style.display = 'none';
        if (config.restoreParent === false) {
            if (!config.keepParentMapping) {
                delete modalParentMap[modalId];
            }
            return;
        }
        restoreParentModal(modalId);
    }, hideDelay);
}

function openModalWithParent(modalId, options) {
    var config = options || {};
    var currentModal = getVisibleModalList(modalId).slice(-1)[0] || null;
    var keepParentVisible = config.keepParentVisible;
    var switchDelay = typeof config.switchDelay === 'number' ? config.switchDelay : MODAL_SWITCH_DELAY_MS;
    if (typeof keepParentVisible === 'undefined') {
        keepParentVisible = !!MODAL_KEEP_PARENT_VISIBLE[modalId];
    }

    if (!keepParentVisible && currentModal) {
        modalParentMap[modalId] = currentModal.id;
        hideModal(currentModal.id, {
            restoreParent: false,
            keepParentMapping: true,
            hideDelay: MODAL_CONTENT_TRANSITION_MS
        });
        setTimeout(function () {
            if (typeof config.beforeShow === 'function') {
                config.beforeShow();
            }
            showModal(modalId);
        }, switchDelay);
        return;
    }

    delete modalParentMap[modalId];
    if (typeof config.beforeShow === 'function') {
        config.beforeShow();
    }
    showModal(modalId);
}

// ============================================================
// Markdown 渲染
// ============================================================

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isSafeLinkUrl(url) {
    try {
        var parsed = new URL(url, window.location.href);
        return ['http:', 'https:', 'mailto:'].indexOf(parsed.protocol) !== -1;
    } catch (e) {
        return false;
    }
}

function renderSafeLink(label, url) {
    var safeLabel = escapeHtml(label);
    var safeUrl = escapeHtml(url);
    if (!isSafeLinkUrl(url)) {
        return safeLabel;
    }
    return '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' + safeLabel + '</a>';
}

function renderInlineMarkdown(text) {
    // 1. 提取行内代码到占位符
    var codeSpans = [];
    text = text.replace(/`([^`]+)`/g, function (match, code) {
        codeSpans.push('<code>' + escapeHtml(code) + '</code>');
        return '\u0000C' + (codeSpans.length - 1) + '\u0000';
    });
    // 2. 转义 HTML
    text = escapeHtml(text);
    // 3. 粗体（先于斜体）
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // 4. 斜体
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/_(.+?)_/g, '<em>$1</em>');
    // 5. 删除线
    text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
    // 6. 链接
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (match, label, url) {
        return renderSafeLink(label, url);
    });
    // 7. 还原行内代码
    text = text.replace(/\u0000C(\d+)\u0000/g, function (match, idx) {
        return codeSpans[parseInt(idx)];
    });
    return text;
}

function renderMarkdown(text) {
    if (!text) return '';
    // 预提取代码块（三反引号）
    var codeBlocks = [];
    text = text.replace(/```[\s\S]*?```/g, function (match) {
        var code = match.replace(/^```\n?/, '').replace(/\n?```$/, '');
        codeBlocks.push('<pre><code>' + escapeHtml(code) + '</code></pre>');
        return '\u0000B' + (codeBlocks.length - 1) + '\u0000';
    });
    var lines = text.split('\n');
    var result = '';
    var inList = false;
    var listType = '';
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var trimmed = line.trim();
        // 代码块占位符
        var blockMatch = trimmed.match(/^\u0000B(\d+)\u0000$/);
        if (blockMatch) {
            if (inList) { result += '</' + listType + '>'; inList = false; listType = ''; }
            result += codeBlocks[parseInt(blockMatch[1])];
            continue;
        }
        // 空行
        if (trimmed === '') {
            if (inList) { result += '</' + listType + '>'; inList = false; listType = ''; }
            continue;
        }
        // 标题
        var headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            if (inList) { result += '</' + listType + '>'; inList = false; listType = ''; }
            var level = headingMatch[1].length;
            result += '<h' + level + '>' + renderInlineMarkdown(headingMatch[2]) + '</h' + level + '>';
            continue;
        }
        // 水平线
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            if (inList) { result += '</' + listType + '>'; inList = false; listType = ''; }
            result += '<hr>';
            continue;
        }
        // 引用
        if (trimmed.indexOf('> ') === 0) {
            if (inList) { result += '</' + listType + '>'; inList = false; listType = ''; }
            result += '<blockquote>' + renderInlineMarkdown(trimmed.slice(2)) + '</blockquote>';
            continue;
        }
        // 无序列表
        var ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
        if (ulMatch) {
            if (!inList || listType !== 'ul') {
                if (inList) result += '</' + listType + '>';
                result += '<ul>';
                inList = true;
                listType = 'ul';
            }
            result += '<li>' + renderInlineMarkdown(ulMatch[1]) + '</li>';
            continue;
        }
        // 有序列表
        var olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
        if (olMatch) {
            if (!inList || listType !== 'ol') {
                if (inList) result += '</' + listType + '>';
                result += '<ol>';
                inList = true;
                listType = 'ol';
            }
            result += '<li>' + renderInlineMarkdown(olMatch[1]) + '</li>';
            continue;
        }
        // 普通段落
        if (inList) { result += '</' + listType + '>'; inList = false; listType = ''; }
        result += '<p>' + renderInlineMarkdown(trimmed) + '</p>';
    }
    if (inList) { result += '</' + listType + '>'; }
    return result;
}

// ============================================================
// 公告相关
// ============================================================

function updateNoticeDisplay() {
    var notice = getStorageItem('notice', '');
    var display = document.getElementById('notice-display');
    if (notice.trim()) {
        display.innerHTML = renderMarkdown(notice);
        display.classList.remove('notice-display-hidden');
        display.style.display = '';
    } else {
        display.innerHTML = '';
        display.classList.add('notice-display-hidden');
        display.style.display = '';
    }
}

function showCenterNotice() {
    var notice = getStorageItem('notice', '');
    if (notice.trim()) {
        document.getElementById('notice-center-text').innerHTML = renderMarkdown(notice);
        openModalWithParent('notice-center-modal');
    }
}

function hideCenterNotice(options) {
    hideModal('notice-center-modal', options);
}

// ============================================================
// 作业渲染
// ============================================================

var SUBJECTS = [
    'chinese', 'math', 'english', 'physics', 'chemistry',
    'biology', 'politics', 'history', 'geography', 'technology', 'other'
];

var SUBJECT_NAMES = {
    'chinese': '语文',
    'math': '数学',
    'english': '英语',
    'physics': '物理',
    'chemistry': '化学',
    'biology': '生物',
    'politics': '政治',
    'history': '历史',
    'geography': '地理',
    'technology': '技术',
    'other': '其他'
};

var APP_SETTING_KEYS = [
    'notice',
    'adEnabled',
    'liquidGlassEnabled',
    'bottomDisplayEnabled',
    'dailyClearEnabled',
    'easterEggEnabled',
    'messyStewEnabled',
    'fastAnimationEnabled',
    'customTitleRaw',
    'lastClearDate',
    'lastSeenUpdateVersion'
];

var Logs = window.LogsCore;

function getStorageItem(key, fallback) {
    var value = localStorage.getItem(key);
    return value === null ? fallback : value;
}

function setStorageItem(key, value) {
    localStorage.setItem(key, value);
}

function getBooleanSetting(key, defaultValue) {
    var value = localStorage.getItem(key);
    if (value === null) return defaultValue;
    return value === 'true';
}

function setBooleanSetting(key, value) {
    localStorage.setItem(key, String(value));
}

function getJsonStorageItem(key, fallback) {
    try {
        var rawValue = localStorage.getItem(key);
        if (rawValue === null) return fallback;
        return JSON.parse(rawValue);
    } catch (e) {
        return fallback;
    }
}

function setJsonStorageItem(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getSubjectHomeworks(subject) {
    var value = getJsonStorageItem(subject, []);
    return Array.isArray(value) ? value : [];
}

function setSubjectHomeworks(subject, homeworks) {
    setJsonStorageItem(subject, Array.isArray(homeworks) ? homeworks : []);
}

// ============================================================
// 本地更新检测（update.json）
// ============================================================

var UPDATE_DATA_URL = './update.json';
var UPDATE_SEEN_KEY = 'lastSeenUpdateVersion';
var currentUpdateInfo = null;

/** 将版本号解析为数字段数组；非法版本返回 null */
function parseVersion(value) {
    if (typeof value !== 'string') return null;
    var text = value.trim().replace(/^v/i, '');
    if (!/^\d+(\.\d+){0,3}$/.test(text)) return null;
    return text.split('.').map(function (part) { return parseInt(part, 10); });
}

/** 比较版本：返回 1 表示 a 更新，0 相等，-1 表示 a 更旧；非法版本按相等处理 */
function compareVersions(a, b) {
    var left = parseVersion(a);
    var right = parseVersion(b);
    if (!left || !right) return 0;
    var length = Math.max(left.length, right.length);
    for (var i = 0; i < length; i++) {
        var x = left[i] || 0;
        var y = right[i] || 0;
        if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
}

function normalizeUpdateNotes(raw) {
    var list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? raw.split('\n') : []);
    return list.filter(function (note) {
        return typeof note === 'string' && note.trim();
    }).slice(0, 20).map(function (note) {
        return note.trim().slice(0, 500);
    });
}

function showUpdateBanner(update, isNewer) {
    var banner = document.getElementById('update-banner');
    var text = document.getElementById('update-banner-text');
    var notesList = document.getElementById('update-banner-notes');
    var details = document.getElementById('update-banner-details');
    if (!banner || !text || !notesList || !details) return;

    currentUpdateInfo = update;
    text.textContent = isNewer
        ? '发现新版本 v' + update.version + '（当前 v' + APP_VERSION + '）'
        : '已更新到 v' + update.version;

    notesList.textContent = '';
    update.notes.forEach(function (note) {
        var item = document.createElement('li');
        item.textContent = note;
        notesList.appendChild(item);
    });
    details.hidden = update.notes.length === 0;
    banner.classList.remove('update-banner-hidden');
}

function hideUpdateBanner() {
    var banner = document.getElementById('update-banner');
    if (banner) banner.classList.add('update-banner-hidden');
}

function dismissUpdateBanner() {
    if (currentUpdateInfo && currentUpdateInfo.version) {
        setStorageItem(UPDATE_SEEN_KEY, currentUpdateInfo.version);
    }
    hideUpdateBanner();
}

/** 静默检查同源 update.json；失败、离线或格式错误均不打扰用户 */
function checkForUpdate() {
    var controller = ('AbortController' in window) ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 5000) : null;

    fetch(UPDATE_DATA_URL + '?_=' + Date.now(), {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller ? controller.signal : undefined
    }).then(function (response) {
        if (!response || !response.ok) throw new Error('update.json unavailable');
        return response.json();
    }).then(function (data) {
        if (!data || typeof data !== 'object') return;
        var remoteVersion = typeof data.version === 'string' ? data.version.trim().replace(/^v/i, '') : '';
        if (!parseVersion(remoteVersion)) return;
        if (compareVersions(remoteVersion, APP_VERSION) < 0) return;

        var seenVersion = getStorageItem(UPDATE_SEEN_KEY, '');
        if (parseVersion(seenVersion) && compareVersions(remoteVersion, seenVersion) <= 0) return;

        var isNewer = compareVersions(remoteVersion, APP_VERSION) > 0;
        showUpdateBanner({
            version: remoteVersion,
            notes: normalizeUpdateNotes(data.notes)
        }, isNewer);
    }).catch(function (error) {
        console.warn('检查更新失败:', error && error.message ? error.message : error);
    }).then(function () {
        if (timer) clearTimeout(timer);
    });
}

function getCurrentAppSettings() {
    return {
        adEnabled: getBooleanSetting('adEnabled', false),
        liquidGlassEnabled: getBooleanSetting('liquidGlassEnabled', false),
        bottomDisplayEnabled: getBooleanSetting('bottomDisplayEnabled', false),
        dailyClearEnabled: getBooleanSetting('dailyClearEnabled', true),
        easterEggEnabled: getBooleanSetting('easterEggEnabled', false),
        messyStewEnabled: getBooleanSetting('messyStewEnabled', false),
        fastAnimationEnabled: getBooleanSetting('fastAnimationEnabled', false),
        customTitleRaw: getStorageItem('customTitleRaw', '')
    };
}

function buildDataBackupPayload() {
    var homeworks = {};
    SUBJECTS.forEach(function (subject) {
        homeworks[subject] = getSubjectHomeworks(subject);
    });

    return {
        meta: {
            app: '作业王',
            version: APP_VERSION,
            exportedAt: new Date().toISOString(),
            formatVersion: 1
        },
        data: {
            homeworks: homeworks,
            notice: getStorageItem('notice', ''),
            settings: getCurrentAppSettings()
        }
    };
}

function createDataBackupFilename() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    var hours = String(now.getHours()).padStart(2, '0');
    var minutes = String(now.getMinutes()).padStart(2, '0');
    var seconds = String(now.getSeconds()).padStart(2, '0');
    return year + month + day + '_' + hours + minutes + seconds + '_hws_backup.json';
}

function exportDataAsText() {
    return JSON.stringify(buildDataBackupPayload(), null, 2);
}

function downloadDataBackup() {
    var jsonText = exportDataAsText();
    var filename = createDataBackupFilename();
    var blob = new Blob([jsonText], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Logs.appendOperationLog(Logs.formatSystemLog('导出数据', { file: filename, source: 'user' }));
}

function parseDataBackup(text) {
    var parsed = JSON.parse(text);
    if (!parsed || !parsed.meta || parsed.meta.app !== '作业王' || parsed.meta.formatVersion !== 1 || !parsed.data || typeof parsed.data !== 'object') {
        throw new Error('不是有效的作业王备份文件');
    }
    return parsed;
}

function applyImportedData(payload) {
    var imported = payload.data || {};
    var importedHomeworks = imported.homeworks || {};
    SUBJECTS.forEach(function (subject) {
        setSubjectHomeworks(subject, Array.isArray(importedHomeworks[subject]) ? importedHomeworks[subject] : []);
    });

    setStorageItem('notice', typeof imported.notice === 'string' ? imported.notice : '');

    var settings = imported.settings || {};
    setBooleanSetting('adEnabled', !!settings.adEnabled);
    setBooleanSetting('liquidGlassEnabled', !!settings.liquidGlassEnabled);
    setBooleanSetting('bottomDisplayEnabled', !!settings.bottomDisplayEnabled);
    setBooleanSetting('dailyClearEnabled', settings.dailyClearEnabled === undefined ? true : !!settings.dailyClearEnabled);
    setBooleanSetting('easterEggEnabled', !!settings.easterEggEnabled);
    setBooleanSetting('messyStewEnabled', !!settings.messyStewEnabled);
    setBooleanSetting('fastAnimationEnabled', !!settings.fastAnimationEnabled);

    setStorageItem('customTitleRaw', typeof settings.customTitleRaw === 'string' ? settings.customTitleRaw : '');

    setStorageItem('lastClearDate', new Date().toDateString());

    computeAllEasterEggs();
    SUBJECTS.forEach(function (subject) {
        renderHomework(subject);
    });
    updateTableHeader();
    updateNoticeDisplay();
    applyCustomTitle();
    adjustNoticePosition();
    checkCompactView();

    var currentSettings = getCurrentAppSettings();
    updateModalTimingVariables();
    setLiquidGlassBackground(currentSettings.liquidGlassEnabled);
    setBottomDisplay(currentSettings.bottomDisplayEnabled);
    if (currentSettings.adEnabled) {
        startAdRotation();
    } else {
        stopAdRotation();
    }
}

function removeAppStorageData() {
    SUBJECTS.forEach(function (subject) {
        localStorage.removeItem(subject);
    });
    APP_SETTING_KEYS.forEach(function (key) {
        localStorage.removeItem(key);
    });
}

// ============================================================
// 彩蛋系统
// ============================================================

/** 简体→繁体映射（压缩格式：每2字符一组 [简,繁]） */
var S2T_PAIRS = '国國学學習習业業语語数數电電书書写寫练練册冊卷卷题題课課页頁复複预預读讀背背记記单單词詞选選开開关關门門车車马馬风風长長飞飛见見问问说說话話讲講识識让讓请請谢谢认認议議論論计計设設试試证證实實驗驗报報纸紙红紅绿綠蓝藍黄黃银銀铁鐵钢鋼钱錢饭飯饮飲动動运運过過还還进進來來会會体體个個里裡后後时時間間现現点點頭頭发發万万与與专專东東为為义義乐樂买買争爭亚亞产產从從传傳伤傷价價优優伟偉卫衛压壓县縣变變筆笔画画画試試题題錯錯对对難難简简類類型型归歸纳納總總結结篇篇章章幅幅译譯释释注注释釋积積累累计计熟熟诵诵读讀朗朗默默背背听听寫寫抄抄摘摘编编辑輯案案答答复復订訂正正错錯改改练练訓訓練練巩巩固固强強化化薄薄弱弱难難重重點點考考試试测測验驗绩绩评評估估档档案案记记录录录錄目目內内容容查查资资料料索索引引章章节节單單元元模模块块专专题题知知識识能能力力素素养养方方法法策策略略技技巧巧规规范范标标准准流流程程要要求求任任务务项项目目完完成进進行檢查检查批批阅阅评评价价反反馈馈沟沟通通合合作作参参与与讨討論論交交流流准準備备預预习习温温顾顾巩巩固固掌掌握握运运用用实实践践探探究究搜搜集集整整理理归归纳纳观觀察察记记录录分分析析評评价价创创造造联联系系比比較较推推理理论论证证验验证证解解释辞說說明明阐阐釋釋表表达达传传達達提提问问回回答答案案错错反反思思改改进進优优化化调调整整巩巩固固迁迁移运運用用总总结结归归纳纳会會体体会会心心得得启启发发联聯想发發散散聚聚焦焦审審题题解解题题答答题题卷卷面面字字迹迹规規範范标標準准计計算算公公式式定定理理概概念念定定義义结结構构图图表表变變化学化學反反應应实實驗驗观觀察察纪紀錄錄论論证证实實踐踐运運動动能能量量电电磁磁力力学学热热学学光光学学原子子分分子子细細胞胞遗遺传传进进化态态系系統统环境境保保護护发發展展资資源源地地理理历歷史史政政治治法法律律经經濟济文文化化社社會会国國家际际关關系统一体体多多元元传傳統统现現代代创創新新批批判判思思维维问問題题解解决决';

function s2t(text) {
    var map = {};
    for (var i = 0; i < S2T_PAIRS.length; i += 2) {
        map[S2T_PAIRS[i]] = S2T_PAIRS[i + 1];
    }
    var result = '';
    Array.from(text).forEach(function (ch) {
        result += map[ch] || ch;
    });
    return result;
}

/** 大乱炖模式全局池：{ 'chinese': [...], 'math': [...], ... } */
var messyStewPool = {};
/** 大乱炖模式是否激活 */
var messyStewActive = false;

/** 判断某科是否触发彩蛋，返回效果名称或 null */
function checkEasterEgg(subject) {
    if (!getBooleanSetting('easterEggEnabled', false)) return null;
    var homeworks = getSubjectHomeworks(subject);
    var n = homeworks.length;
    if (n <= 2) return null;
    var probability = (n - 2) * 0.25;
    if (probability >= 1) probability = 1;
    if (Math.random() < probability) {
        switch (subject) {
            case 'chinese': return 'chinese';
            case 'english': return 'english';
            case 'biology': return 'biology';
            case 'history': return 'history';
            case 'technology': return 'technology';
            case 'other':   return 'other';
            default:        return null;
        }
    }
    return null;
}

/** 全局彩蛋结果缓存（页面加载时计算一次） */
var easterEggResults = {};

function computeAllEasterEggs() {
    easterEggResults = {};
    messyStewActive = false;
    messyStewPool = {};

    if (!getBooleanSetting('easterEggEnabled', false)) return;

    var messyStew = getBooleanSetting('messyStewEnabled', false);

    if (messyStew) {
        // 大乱炖模式：判断所有科目作业总数是否 >= 5
        var totalCount = 0;
        SUBJECTS.forEach(function (sub) {
            var hw = getSubjectHomeworks(sub);
            totalCount += hw.length;
        });
        if (totalCount >= 5) {
            messyStewActive = true;
            // 1. 收集所有科目条目并做繁体、💩、❤️预处理
            var allItems = []; // { subject, text }
            SUBJECTS.forEach(function (sub) {
                var hw = getSubjectHomeworks(sub);
                hw.forEach(function (text) {
                    // 繁体
                    var t = s2t(text);
                    // 随机插入 💩 (1~2个)
                    var poopCount = Math.floor(Math.random() * 2) + 1;
                    var chars = Array.from(t);
                    for (var p = 0; p < poopCount; p++) {
                        var pos = Math.floor(Math.random() * (chars.length + 1));
                        chars.splice(pos, 0, '\uD83D\uDCA9');
                    }
                    // 随机插入 ❤️ (1~2个)
                    var heartCount = Math.floor(Math.random() * 2) + 1;
                    for (var h = 0; h < heartCount; h++) {
                        var pos2 = Math.floor(Math.random() * (chars.length + 1));
                        chars.splice(pos2, 0, '\u2764\uFE0F');
                    }
                    // 随机插入 🍥 (1~2个) —— 技术彩蛋，全科目跨科混插
                    var fishCount = Math.floor(Math.random() * 2) + 1;
                    for (var f = 0; f < fishCount; f++) {
                        var pos3 = Math.floor(Math.random() * (chars.length + 1));
                        chars.splice(pos3, 0, '🍥');
                    }
                    allItems.push({ subject: sub, text: chars.join('') });
                });
            });

            // 2. 跨学科交叉互换（全局）
            var crossoverCount = Math.floor(Math.random() * (allItems.length * 3)) + allItems.length;
            if (allItems.length >= 2) {
                for (var cross = 0; cross < crossoverCount; cross++) {
                    var i1 = Math.floor(Math.random() * allItems.length);
                    var i2 = (i1 + 1 + Math.floor(Math.random() * (allItems.length - 1))) % allItems.length;
                    var s1 = allItems[i1].text;
                    var s2 = allItems[i2].text;
                    if (s1.length > 0 && s2.length > 0) {
                        var swapped = crossoverStrings(s1, s2);
                        allItems[i1].text = swapped[0];
                        allItems[i2].text = swapped[1];
                    }
                }
            }

            // 3. 易位（全字符串逐字打乱）
            allItems.forEach(function (item) {
                item.text = shuffleString(item.text);
            });

            // 3.5 技术彩蛋：喵~ 追加在末尾（🍥 已在预处理阶段全科混插）；技术项 100%，其它科目约 40%
            allItems.forEach(function (item) {
                if (item.subject === 'technology' || Math.random() < 0.4) {
                    item.text += '喵~';
                }
            });

            // 4. 按科目分配回 messyStewPool，并为所有10科设置 effect
            SUBJECTS.forEach(function (sub) {
                messyStewPool[sub] = [];
                easterEggResults[sub] = 'messyStew';
            });
            allItems.forEach(function (item) {
                messyStewPool[item.subject].push(item.text);
            });
            return;
        }
        // 大乱炖开启但总数不足5条：不触发任何彩蛋
        return;
    }

    // 普通模式：仅6科
    var subjects = ['chinese', 'english', 'biology', 'history', 'technology', 'other'];
    subjects.forEach(function (subject) {
        easterEggResults[subject] = checkEasterEgg(subject);
    });
}

/** 字符串随机打乱（按码点，避免切断代理对） */
function shuffleString(str) {
    var arr = Array.from(str);
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr.join('');
}

/** 两段文本间随机交换一段子串（按码点切分，避免切断代理对产生乱码） */
function crossoverStrings(s1, s2) {
    var c1 = Array.from(s1);
    var c2 = Array.from(s2);
    var cut1 = Math.floor(Math.random() * c1.length);
    var cut2 = Math.floor(Math.random() * c2.length);
    var len1 = Math.floor(Math.random() * (c1.length - cut1)) + 1;
    var len2 = Math.floor(Math.random() * (c2.length - cut2)) + 1;
    var seg1 = c1.slice(cut1, cut1 + len1);
    var seg2 = c2.slice(cut2, cut2 + len2);
    var new1 = c1.slice(0, cut1).concat(seg2, c1.slice(cut1 + len1)).join('');
    var new2 = c2.slice(0, cut2).concat(seg1, c2.slice(cut2 + len2)).join('');
    return [new1, new2];
}

/** 应用彩蛋效果到显示数据，返回 { displayList, subjectNameOverride, perCharColor } */
function applyEasterEgg(subject, homeworks) {
    var effect = easterEggResults[subject];
    var displayList = homeworks.slice(); // shallow copy
    var subjectNameOverride = null;
    var subjectNameImage = null;
    var perCharColor = false;

    if (!effect) return { displayList: displayList, subjectNameOverride: null, subjectNameImage: null, perCharColor: false };

    // 大乱炖模式：从预计算池获取
    if (effect === 'messyStew') {
        displayList = messyStewPool[subject] || [];
        if (subject === 'english') subjectNameOverride = '勾石';
        if (subject === 'history') subjectNameOverride = '妈妈';
        if (subject === 'technology') subjectNameImage = 'img/vscode.jpg';
        perCharColor = true;
        return { displayList: displayList, subjectNameOverride: subjectNameOverride, subjectNameImage: subjectNameImage, perCharColor: perCharColor };
    }

    if (effect === 'chinese') {
        displayList = displayList.map(function (h) { return s2t(h); });
    } else if (effect === 'english') {
        subjectNameOverride = '勾石';
        displayList = displayList.map(function (h) {
            var count = Math.floor(Math.random() * 4) + 1;
            var chars = Array.from(h);
            for (var k = 0; k < count; k++) {
                var pos = Math.floor(Math.random() * (chars.length + 1));
                chars.splice(pos, 0, '\uD83D\uDCA9');
            }
            return chars.join('');
        });
    } else if (effect === 'history') {
        subjectNameOverride = '妈妈';
        displayList = displayList.map(function (h) {
            var count = Math.floor(Math.random() * 4) + 1;
            var chars = Array.from(h);
            for (var k = 0; k < count; k++) {
                var pos = Math.floor(Math.random() * (chars.length + 1));
                chars.splice(pos, 0, '\u2764\uFE0F');
            }
            return chars.join('');
        });
    } else if (effect === 'biology') {
        displayList = displayList.map(function (h) {
            var hChars = Array.from(h);
            var chunkSize = Math.floor(Math.random() * 3) + 3; // 3~5
            var chunks = [];
            for (var ci = 0; ci < hChars.length; ci += chunkSize) {
                chunks.push(hChars.slice(ci, ci + chunkSize).join(''));
            }
            for (var si = chunks.length - 1; si > 0; si--) {
                var sj = Math.floor(Math.random() * (si + 1));
                var tmp = chunks[si];
                chunks[si] = chunks[sj];
                chunks[sj] = tmp;
            }
            return chunks.join('');
        });
        var maxCrossovers = displayList.length * 2;
        var crossoverCount = Math.floor(Math.random() * maxCrossovers) + 1;
        if (displayList.length >= 2) {
            for (var cross = 0; cross < crossoverCount; cross++) {
                var i1 = Math.floor(Math.random() * displayList.length);
                var i2 = (i1 + 1 + Math.floor(Math.random() * (displayList.length - 1))) % displayList.length;
                var s1 = displayList[i1];
                var s2 = displayList[i2];
                if (s1.length > 0 && s2.length > 0) {
                    var swapped = crossoverStrings(s1, s2);
                    displayList[i1] = swapped[0];
                    displayList[i2] = swapped[1];
                }
            }
        }
    } else if (effect === 'technology') {
        displayList = displayList.map(function (h) {
            var count = Math.floor(Math.random() * 4) + 1;
            var chars = Array.from(h);
            for (var k = 0; k < count; k++) {
                var pos = Math.floor(Math.random() * (chars.length + 1));
                chars.splice(pos, 0, '🍥');
            }
            return chars.join('') + '喵~';
        });
        // 技术彩蛋：科目名替换为图标
        subjectNameImage = 'img/vscode.jpg';
    } else if (effect === 'other') {
        perCharColor = true;
    }

    return { displayList: displayList, subjectNameOverride: subjectNameOverride, subjectNameImage: subjectNameImage, perCharColor: perCharColor };
}

// ============================================================
// 作业渲染
// ============================================================

function renderHomework(subject) {
    var container = document.getElementById(subject + '-homework');
    var row = container.closest('tr');
    var homeworks = getSubjectHomeworks(subject);

    container.innerHTML = '';

    if (homeworks.length === 0) {
        row.classList.add('hidden');
        // 恢复科目名称（英语彩蛋可能改过）
        var subjectCell = row.querySelector('.subject-cell');
        if (subjectCell) subjectCell.textContent = SUBJECT_NAMES[subject];
        return;
    }

    row.classList.remove('hidden');

    // 应用彩蛋
    var eggResult = applyEasterEgg(subject, homeworks);
    var displayList = eggResult.displayList;
    var subjectNameOverride = eggResult.subjectNameOverride;
    var subjectNameImage = eggResult.subjectNameImage;

    // 更新科目名称
    var subjectCell = row.querySelector('.subject-cell');
    if (subjectCell) {
        if (subjectNameImage) {
            // 技术彩蛋：科目名替换为图片
            subjectCell.textContent = '';
            var img = document.createElement('img');
            img.className = 'subject-cell-img';
            img.src = subjectNameImage;
            img.alt = SUBJECT_NAMES[subject];
            subjectCell.appendChild(img);
        } else {
            subjectCell.textContent = subjectNameOverride || SUBJECT_NAMES[subject];
        }
    }

    displayList.forEach(function (homework, index) {
        var homeworkItem = document.createElement('div');
        homeworkItem.className = 'homework-item';

        // 彩蛋：每字随机颜色（other 效果 或 大乱炖模式）
        if (eggResult.perCharColor) {
            homeworkItem.textContent = '';
            var prefix = (index + 1) + '. ';
            var prefixSpan = document.createElement('span');
            prefixSpan.textContent = prefix;
            prefixSpan.style.color = ''; // 默认颜色
            homeworkItem.appendChild(prefixSpan);
            Array.from(homework).forEach(function (ch) {
                var span = document.createElement('span');
                span.textContent = ch;
                span.style.color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                homeworkItem.appendChild(span);
            });
        } else {
            homeworkItem.textContent = (index + 1) + '. ' + homework;
        }
        container.appendChild(homeworkItem);
    });
}

function updateHomeworkItems(subjectSelectId, itemSelectId) {
    var subject = document.getElementById(subjectSelectId).value;
    var homeworks = getSubjectHomeworks(subject);
    var itemSelect = document.getElementById(itemSelectId);

    itemSelect.innerHTML = '';

    if (homeworks.length === 0) {
        var option = document.createElement('option');
        option.value = '';
        option.textContent = '暂无作业';
        itemSelect.appendChild(option);
        return;
    }

    homeworks.forEach(function (homework, index) {
        var option = document.createElement('option');
        option.value = index;
        option.textContent = '作业 ' + (index + 1);
        itemSelect.appendChild(option);
    });

    if (itemSelectId === 'homework-item-select') {
        itemSelect.value = 0;
        document.getElementById('modify-homework-input').value = homeworks[0];
    }
}

function updateTableHeader() {
    var hasAnyHomework = SUBJECTS.some(function (subject) {
        var homeworks = getSubjectHomeworks(subject);
        return homeworks.length > 0;
    });

    var headerRow = document.querySelector('.homework-table tr:first-child');
    if (hasAnyHomework) {
        headerRow.classList.remove('hidden');
    } else {
        headerRow.classList.add('hidden');
    }
}

function checkCompactView() {
    var table = document.querySelector('.homework-table');
    var tableHeight = table.offsetHeight;
    var windowHeight = window.innerHeight;

    if (tableHeight > windowHeight * 0.8) {
        document.querySelectorAll('.homework-items-container').forEach(function (container) {
            container.classList.add('compact');
        });
    } else {
        document.querySelectorAll('.homework-items-container').forEach(function (container) {
            container.classList.remove('compact');
        });
    }
}

// ============================================================
// 靠下显示 / Liquid Glass 背景
// ============================================================

function setLiquidGlassBackground(enabled) {
    var body = document.body;
    if (enabled) {
        body.classList.add('liquid-glass-enabled');
        body.classList.remove('liquid-glass-disabled');
    } else {
        body.classList.add('liquid-glass-disabled');
        body.classList.remove('liquid-glass-enabled');
    }
}

function adjustNoticePosition() {
    var noticeDisplay = document.getElementById('notice-display');
    var bottomDisplayEnabled = getBooleanSetting('bottomDisplayEnabled', false);

    if (!bottomDisplayEnabled) return;

    var hasHomework = SUBJECTS.some(function (subject) {
        var homeworks = getSubjectHomeworks(subject);
        return homeworks.length > 0;
    });

    if (hasHomework) {
        noticeDisplay.style.position = '';
        noticeDisplay.style.bottom = '';
        noticeDisplay.style.left = '';
        noticeDisplay.style.right = '';
        noticeDisplay.style.width = '';
        noticeDisplay.style.zIndex = '';
        noticeDisplay.style.margin = '18px 0 10px 0';
    } else {
        noticeDisplay.style.position = 'fixed';
        noticeDisplay.style.bottom = '20px';
        noticeDisplay.style.left = '20px';
        noticeDisplay.style.right = '20px';
        noticeDisplay.style.width = 'auto';
        noticeDisplay.style.margin = '0';
        noticeDisplay.style.zIndex = '99';
    }
}

function setBottomDisplay(enabled) {
    var table = document.querySelector('.homework-table');
    var noticeDisplay = document.getElementById('notice-display');
    var noticeBtn = document.getElementById('bottom-notice-btn');

    if (enabled) {
        table.classList.add('bottom-display');
        noticeBtn.style.display = 'none';
        adjustNoticePosition();
    } else {
        table.classList.remove('bottom-display');
        noticeBtn.style.display = '';
        noticeDisplay.style.position = '';
        noticeDisplay.style.bottom = '';
        noticeDisplay.style.left = '';
        noticeDisplay.style.right = '';
        noticeDisplay.style.width = '';
        noticeDisplay.style.zIndex = '';
        noticeDisplay.style.margin = '18px 0 10px 0';
    }
}

// ============================================================
// 广告轮播
// ============================================================

var currentAdIndex = 0;
var adImages = ['ad01.png', 'ad02.png'];
var adLinks = [
    'https://www.apple.com.cn',
    'https://playvalorant.com/zh-tw/'
];
var adInterval = null;

function rotateAd() {
    currentAdIndex = (currentAdIndex + 1) % adImages.length;
    var adImage = document.getElementById('ad-image');
    var adContainer = document.getElementById('ad-container');

    requestAnimationFrame(function () {
        adImage.src = 'img/' + adImages[currentAdIndex];
        adImage.onclick = function () {
            window.open(adLinks[currentAdIndex], '_blank', 'noopener,noreferrer');
        };

        var adEnabled = getBooleanSetting('adEnabled', false);
        if (adEnabled) {
            adContainer.style.display = 'flex';
        }
    });
}

function startAdRotation() {
    rotateAd();
    if (adInterval) clearInterval(adInterval);
    adInterval = setInterval(rotateAd, 60000);
}

function stopAdRotation() {
    if (adInterval) {
        clearInterval(adInterval);
        adInterval = null;
    }
    document.getElementById('ad-container').style.display = 'none';
}

// ============================================================
// 每日数据清空
// ============================================================

function checkAndClearDailyData() {
    var dailyClearEnabled = getBooleanSetting('dailyClearEnabled', true);
    if (!dailyClearEnabled) return;

    var today = new Date().toDateString();
    var lastClearDate = getStorageItem('lastClearDate', null);

    if (lastClearDate !== today) {
        var hadHomework = SUBJECTS.some(function (subject) {
            return getSubjectHomeworks(subject).length > 0;
        });
        SUBJECTS.forEach(function (subject) {
            setSubjectHomeworks(subject, []);
        });
        setStorageItem('lastClearDate', today);
        if (hadHomework) {
            Logs.appendOperationLog(Logs.formatSystemLog('自动清除昨日作业', { source: 'system' }));
        }
    }
}

// ============================================================
// 保存到文件
// ============================================================

function checkAutoSave() {
    var now = new Date();
    if (now.getHours() === 20 && now.getMinutes() === 0) {
        saveHomeworkToFile(true, true);
    }
}

function saveHomeworkToFile(saveHomework, saveNotice) {
    if (saveHomework === undefined) saveHomework = true;
    if (saveNotice === undefined) saveNotice = true;

    var content = '作业王 v' + APP_VERSION + ' - 高中作业单\n';
    content += '生成时间: ' + new Date().toLocaleString() + '\n\n';

    if (saveHomework) {
        SUBJECTS.forEach(function (subject) {
            var homeworks = getSubjectHomeworks(subject);
            content += '【' + SUBJECT_NAMES[subject] + '】\n';
            if (homeworks.length === 0) {
                content += '  暂无作业\n';
            } else {
                homeworks.forEach(function (homework, index) {
                    content += '  ' + (index + 1) + '. ' + homework + '\n';
                });
            }
            content += '\n';
        });
    }

    if (saveNotice) {
        var notice = getStorageItem('notice', '');
        if (notice.trim()) {
            content += '【公告】\n';
            content += '  ' + notice + '\n\n';
        }
    }

    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    var filename = year + month + day + '_homework.txt';

    var blob = new Blob([content], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Logs.appendOperationLog(Logs.formatSystemLog('导出作业', { file: filename, source: 'system' }));
}

// ============================================================
// 初始化 —— DOMContentLoaded
// ============================================================

// ============================================================
// Service Worker 注册
// ============================================================

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).then(function (reg) {
            if (reg.installing) {
                console.log('Service Worker 安装中');
            }
            // 监听 SW 更新
            reg.addEventListener('updatefound', function () {
                var newWorker = reg.installing;
                newWorker.addEventListener('statechange', function () {
                    if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                        console.log('新版本 Service Worker 已激活');
                    }
                });
            });
        }).catch(function (err) {
            console.log('Service Worker 注册失败:', err);
        });
    }
}

// ---------- 注册 Service Worker ----------
registerServiceWorker();

// ============================================================
// 自定义标题（高级设置 · 标题设置）
// ============================================================

/**
 * 应用自定义标题到主页大标题（整行替换）。
 * 语法/样式解析委托给 title-parse.js（共享解析器），文本用 textContent 落位、
 * 颜色/URL 过白名单，绝不内联执行 HTML。
 * 自动更新规则：留空用默认（带当前版本号，随版本更新）；非空则版本更新不覆盖自定义。
 */
function applyCustomTitle() {
    var header = document.querySelector('.header');
    if (!header) return;
    if (!window.TitleParse) return;

    var raw = getStorageItem('customTitleRaw', '').trim();
    var nodes;
    if (raw) {
        nodes = window.TitleParse.parseTitle(raw);
    } else {
        // 默认标题（随版本号更新）
        nodes = [{ type: 'text', text: '作业王v' + APP_VERSION + '-大家的最爱' }];
    }

    header.textContent = '';
    window.TitleParse.renderTitle(header, nodes, window.TitleParse.isSafeLinkUrl);
}

document.addEventListener('DOMContentLoaded', function () {

    // ---------- 初始设置 ----------
    updateModalTimingVariables();
    applyAdaptiveTextColors();
    applyCustomTitle();

    var liquidGlassEnabled = getBooleanSetting('liquidGlassEnabled', false);
    var bottomDisplayEnabled = getBooleanSetting('bottomDisplayEnabled', false);
    var adEnabled = getBooleanSetting('adEnabled', false);

    setLiquidGlassBackground(liquidGlassEnabled);
    setBottomDisplay(bottomDisplayEnabled);

    // ---------- 每日数据清空 + 加载作业 ----------
    checkAndClearDailyData();
    computeAllEasterEggs();

    SUBJECTS.forEach(function (subject) {
        if (getStorageItem(subject, null) === null) {
            setSubjectHomeworks(subject, []);
        }
        renderHomework(subject);
    });

    updateTableHeader();
    updateNoticeDisplay();
    adjustNoticePosition();
    checkCompactView();

    // ---------- 广告轮播 ----------
    if (adEnabled) {
        startAdRotation();
    } else {
        document.getElementById('ad-container').style.display = 'none';
    }

    // ---------- 公告居中弹窗 ----------
    document.getElementById('notice-center-close').addEventListener('click', hideCenterNotice);
    document.getElementById('notice-center-modal').addEventListener('click', function (e) {
        if (e.target === this) hideCenterNotice({ restoreParent: false });
    });

    // 左下角公告按钮：单击打开居中弹窗
    document.getElementById('bottom-notice-btn').addEventListener('click', showCenterNotice);

    // 公告展示区点击打开居中弹窗
    document.getElementById('notice-display').addEventListener('click', showCenterNotice);

    // 右键单击公告按钮 → 公告编辑
    document.getElementById('bottom-notice-btn').addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var notice = getStorageItem('notice', '');
        document.getElementById('notice-textarea').value = notice;
        document.getElementById('notice-count').textContent = notice.length + '/3000';
        openModalWithParent('notice-modal');
        document.getElementById('notice-textarea').focus();
    });

    // ---------- 公告编辑模态框 ----------
    document.getElementById('notice-close').addEventListener('click', function () {
        hideModal('notice-modal');
    });
    document.getElementById('notice-cancel').addEventListener('click', function () {
        hideModal('notice-modal');
    });
    document.getElementById('notice-save').addEventListener('click', function () {
        var previousNotice = getStorageItem('notice', '');
        var val = document.getElementById('notice-textarea').value;
        setStorageItem('notice', val);
        if (previousNotice !== val) {
            Logs.appendOperationLog(Logs.formatEditNoticeLog(previousNotice, val));
        }
        hideModal('notice-modal');
        updateNoticeDisplay();
    });
    document.getElementById('notice-textarea').addEventListener('input', function () {
        document.getElementById('notice-count').textContent = this.value.length + '/3000';
    });

    // ---------- 保存按钮 ----------
    document.getElementById('save-btn').addEventListener('click', function () {
        showModal('save-select-modal');
    });

    // ---------- 保存选择对话框 ----------
    document.getElementById('save-select-close').addEventListener('click', function () {
        hideModal('save-select-modal');
    });
    document.getElementById('save-select-cancel').addEventListener('click', function () {
        hideModal('save-select-modal');
    });
    document.getElementById('save-select-confirm').addEventListener('click', function () {
        var saveHomework = document.getElementById('save-homework-checkbox').checked;
        var saveNotice = document.getElementById('save-notice-checkbox').checked;
        var clearAfterSave = document.getElementById('save-clear-after-checkbox').checked;
        if (saveHomework || saveNotice) {
            saveHomeworkToFile(saveHomework, saveNotice);
            if (clearAfterSave) {
                SUBJECTS.forEach(function (subject) {
                    setSubjectHomeworks(subject, []);
                    renderHomework(subject);
                });
                Logs.appendOperationLog(Logs.formatSystemLog('保存后清空作业'));
                updateTableHeader();
                adjustNoticePosition();
            }
            hideModal('save-select-modal');
        } else {
            alert('请至少选择一项内容进行保存');
        }
    });

    // ---------- 悬浮球 → hws操作面板 ----------
    var operationTabs = Array.prototype.slice.call(document.querySelectorAll('.operation-tab'));
    var operationPanes = Array.prototype.slice.call(document.querySelectorAll('.operation-pane'));

    function updateOperationManageState() {
        var adEnabledVal = getBooleanSetting('adEnabled', false);
        var liquidGlassVal = getBooleanSetting('liquidGlassEnabled', false);
        var bottomDisplayVal = getBooleanSetting('bottomDisplayEnabled', false);
        var dailyClearVal = getBooleanSetting('dailyClearEnabled', true);
        var easterEggVal = getBooleanSetting('easterEggEnabled', false);
        var messyStewVal = getBooleanSetting('messyStewEnabled', false);
        var fastAnimationVal = getBooleanSetting('fastAnimationEnabled', false);

        document.getElementById('manage-ad-toggle-checkbox').checked = adEnabledVal;
        document.getElementById('manage-liquid-glass-toggle-checkbox').checked = liquidGlassVal;
        document.getElementById('manage-bottom-display-checkbox').checked = bottomDisplayVal;
        document.getElementById('manage-daily-clear-checkbox').checked = dailyClearVal;
        document.getElementById('manage-easter-egg-checkbox').checked = easterEggVal;
        document.getElementById('manage-messy-stew-checkbox').checked = messyStewVal;
        document.getElementById('manage-fast-animation-checkbox').checked = fastAnimationVal;

        // 如果彩蛋已勾选则显示大乱炖，否则隐藏
        document.getElementById('manage-messy-stew-group').style.display = easterEggVal ? 'block' : 'none';
    }

    function activateOperationPane(paneKey) {
        operationTabs.forEach(function (tab) {
            var isActive = tab.getAttribute('data-panel') === paneKey;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        operationPanes.forEach(function (pane) {
            pane.classList.toggle('is-active', pane.getAttribute('data-pane') === paneKey);
        });

        if (paneKey === 'modify') {
            updateHomeworkItems('modify-subject-select', 'homework-item-select');
        } else if (paneKey === 'delete') {
            updateHomeworkItems('delete-subject-select', 'delete-item-select');
        } else if (paneKey === 'manage') {
            updateOperationManageState();
        } else if (paneKey === 'data') {
            document.getElementById('data-import-textarea').value = '';
            document.getElementById('data-import-file').value = '';
        }
    }

    function openOperationPanel() {
        activateOperationPane('add');
        openModalWithParent('operation-modal');
    }

    document.getElementById('floating-ball').addEventListener('click', openOperationPanel);
    document.getElementById('floating-ball').addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openOperationPanel();
        }
    });
    operationTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            activateOperationPane(this.getAttribute('data-panel'));
        });
    });
    document.getElementById('operation-close').addEventListener('click', function () {
        hideModal('operation-modal');
    });

    document.getElementById('op-clear-cache').addEventListener('click', function () {
        openModalWithParent('clear-cache-modal');
    });

    // ---------- 清空缓存确认弹窗 ----------
    document.getElementById('clear-cache-close').addEventListener('click', function () {
        hideModal('clear-cache-modal');
    });
    document.getElementById('clear-cache-cancel').addEventListener('click', function () {
        hideModal('clear-cache-modal');
    });
    document.getElementById('clear-cache-confirm').addEventListener('click', function () {
        // 1. 仅清空本应用使用的 localStorage key，避免误删同域其他应用数据
        removeAppStorageData();
        Logs.setOperationLogs([]);
        Logs.appendOperationLog(Logs.formatSystemLog('清空缓存'));
        // 2. 通知 Service Worker 清除所有缓存，收到确认后再刷新页面
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            var onCacheCleared = function (event) {
                if (event.data && event.data.type === 'CACHE_CLEARED') {
                    navigator.serviceWorker.removeEventListener('message', onCacheCleared);
                    window.location.reload();
                }
            };
            navigator.serviceWorker.addEventListener('message', onCacheCleared);
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
        } else {
            // 兜底：没有可用的 Service Worker 控制器时，直接刷新页面
            window.location.reload();
        }
    });

    // ---------- 管理设置 ----------
    document.getElementById('manage-cancel').addEventListener('click', function () {
        hideModal('operation-modal');
    });
    document.getElementById('manage-save').addEventListener('click', function () {
        var adEnabledVal = document.getElementById('manage-ad-toggle-checkbox').checked;
        var liquidGlassVal = document.getElementById('manage-liquid-glass-toggle-checkbox').checked;
        var bottomDisplayVal = document.getElementById('manage-bottom-display-checkbox').checked;
        var dailyClearVal = document.getElementById('manage-daily-clear-checkbox').checked;
        var easterEggVal = document.getElementById('manage-easter-egg-checkbox').checked;
        var messyStewVal = document.getElementById('manage-messy-stew-checkbox').checked;
        var fastAnimationVal = document.getElementById('manage-fast-animation-checkbox').checked;
        var previousSettings = {
            adEnabled: getBooleanSetting('adEnabled', false),
            liquidGlassEnabled: getBooleanSetting('liquidGlassEnabled', false),
            bottomDisplayEnabled: getBooleanSetting('bottomDisplayEnabled', false),
            dailyClearEnabled: getBooleanSetting('dailyClearEnabled', true),
            easterEggEnabled: getBooleanSetting('easterEggEnabled', false),
            messyStewEnabled: getBooleanSetting('messyStewEnabled', false),
            fastAnimationEnabled: getBooleanSetting('fastAnimationEnabled', false)
        };

        setBooleanSetting('adEnabled', adEnabledVal);
        setBooleanSetting('liquidGlassEnabled', liquidGlassVal);
        setBooleanSetting('bottomDisplayEnabled', bottomDisplayVal);
        setBooleanSetting('dailyClearEnabled', dailyClearVal);
        setBooleanSetting('easterEggEnabled', easterEggVal);
        setBooleanSetting('messyStewEnabled', messyStewVal);
        setBooleanSetting('fastAnimationEnabled', fastAnimationVal);

        [
            ['adEnabled', adEnabledVal],
            ['liquidGlassEnabled', liquidGlassVal],
            ['bottomDisplayEnabled', bottomDisplayVal],
            ['dailyClearEnabled', dailyClearVal],
            ['easterEggEnabled', easterEggVal],
            ['messyStewEnabled', messyStewVal],
            ['fastAnimationEnabled', fastAnimationVal]
        ].forEach(function (entry) {
            var key = entry[0];
            var currentValue = entry[1];
            if (previousSettings[key] !== currentValue) {
                Logs.appendOperationLog(Logs.formatSettingLog(key, previousSettings[key], currentValue));
            }
        });

        updateModalTimingVariables();

        if (adEnabledVal) {
            startAdRotation();
        } else {
            stopAdRotation();
        }

        setLiquidGlassBackground(liquidGlassVal);
        setBottomDisplay(bottomDisplayVal);
        computeAllEasterEggs();
        SUBJECTS.forEach(function (s) { renderHomework(s); });
    });

    // ---------- 关于/友链弹窗 ----------
    document.getElementById('about-link').addEventListener('click', function (e) {
        e.preventDefault();
        openModalWithParent('about-modal');
    });
    document.getElementById('about-close').addEventListener('click', function () {
        hideModal('about-modal');
    });
    document.getElementById('about-ok').addEventListener('click', function () {
        hideModal('about-modal');
    });

    // ---------- 彩蛋复选框联动大乱炖显示 ----------
    document.getElementById('manage-easter-egg-checkbox').addEventListener('change', function () {
        document.getElementById('manage-messy-stew-group').style.display = this.checked ? 'block' : 'none';
    });

    document.getElementById('copy-data-button').addEventListener('click', async function () {
        var jsonText = exportDataAsText();
        try {
            await navigator.clipboard.writeText(jsonText);
            Logs.appendOperationLog(Logs.formatSystemLog('导出数据', { file: 'clipboard', source: 'user' }));
        } catch (e) {
            alert('复制失败，请检查浏览器是否允许访问剪贴板');
        }
    });

    document.getElementById('download-data-button').addEventListener('click', function () {
        downloadDataBackup();
    });

    document.getElementById('load-data-file-button').addEventListener('click', function () {
        document.getElementById('data-import-file').click();
    });

    document.getElementById('data-import-file').addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
            document.getElementById('data-import-textarea').value = typeof reader.result === 'string' ? reader.result : '';
        };
        reader.readAsText(file, 'utf-8');
    });

    document.getElementById('apply-import-button').addEventListener('click', function () {
        var importText = document.getElementById('data-import-textarea').value.trim();
        if (!importText) {
            alert('请先输入或载入要导入的 JSON 数据');
            return;
        }

        try {
            var payload = parseDataBackup(importText);
            var fileInput = document.getElementById('data-import-file');
            var sourceFile = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : 'pasted-json';
            applyImportedData(payload);
            Logs.appendOperationLog(Logs.formatSystemLog('导入数据', { file: sourceFile, source: 'user' }));
            hideModal('operation-modal', { restoreParent: false });
        } catch (e) {
            alert(e && e.message ? e.message : '导入失败，请检查数据格式');
        }
    });

    // ---------- 添加作业 ----------
    document.getElementById('submit-homework').addEventListener('click', function () {
        var subject = document.getElementById('subject-select').value;
        var homeworkInput = document.getElementById('homework-input');
        var homeworkText = homeworkInput.value.trim();

        if (homeworkText) {
            var homeworks = getSubjectHomeworks(subject);
            homeworks.push(homeworkText);
            setSubjectHomeworks(subject, homeworks);
            Logs.appendOperationLog(Logs.formatAddHomeworkLog(subject, SUBJECT_NAMES[subject], homeworks.length, homeworkText));
            if (getBooleanSetting('messyStewEnabled', false)) {
                computeAllEasterEggs();
            } else {
                easterEggResults[subject] = checkEasterEgg(subject);
            }
            renderHomework(subject);
            homeworkInput.value = '';
            checkCompactView();
            updateTableHeader();
            adjustNoticePosition();
        }
    });

    // ---------- 修改作业 ----------
    document.getElementById('modify-subject-select').addEventListener('change', function () {
        updateHomeworkItems('modify-subject-select', 'homework-item-select');
    });
    document.getElementById('homework-item-select').addEventListener('change', function () {
        var subject = document.getElementById('modify-subject-select').value;
        var index = this.value;
        var homeworks = getSubjectHomeworks(subject);
        if (index !== '' && homeworks.length > 0) {
            document.getElementById('modify-homework-input').value = homeworks[index];
        }
    });
    document.getElementById('submit-modify').addEventListener('click', function () {
        var subject = document.getElementById('modify-subject-select').value;
        var index = document.getElementById('homework-item-select').value;
        var newHomework = document.getElementById('modify-homework-input').value.trim();

        if (newHomework && index !== '') {
            var homeworks = getSubjectHomeworks(subject);
            var oldHomework = homeworks[index];
            homeworks[index] = newHomework;
            setSubjectHomeworks(subject, homeworks);
            Logs.appendOperationLog(Logs.formatChangeHomeworkLog(subject, SUBJECT_NAMES[subject], Number(index) + 1, oldHomework, newHomework));
            if (getBooleanSetting('messyStewEnabled', false)) {
                computeAllEasterEggs();
            } else {
                easterEggResults[subject] = checkEasterEgg(subject);
            }
            renderHomework(subject);
            adjustNoticePosition();
        }
    });

    // ---------- 删除作业 ----------
    document.getElementById('delete-subject-select').addEventListener('change', function () {
        updateHomeworkItems('delete-subject-select', 'delete-item-select');
    });
    document.getElementById('confirm-delete').addEventListener('click', function () {
        var subject = document.getElementById('delete-subject-select').value;
        var index = document.getElementById('delete-item-select').value;

        if (index !== '') {
            var homeworks = getSubjectHomeworks(subject);
            var removedHomework = homeworks[index];
            homeworks.splice(index, 1);
            setSubjectHomeworks(subject, homeworks);
            Logs.appendOperationLog(Logs.formatRemoveHomeworkLog(subject, SUBJECT_NAMES[subject], Number(index) + 1, removedHomework));
            if (getBooleanSetting('messyStewEnabled', false)) {
                computeAllEasterEggs();
            } else {
                easterEggResults[subject] = checkEasterEgg(subject);
            }
            renderHomework(subject);
            updateHomeworkItems('delete-subject-select', 'delete-item-select');
            checkCompactView();
            updateTableHeader();
            adjustNoticePosition();
        }
    });

    // ---------- 通用关闭按钮 ----------
    document.querySelectorAll('.close-button').forEach(function (button) {
        button.addEventListener('click', function () {
            var modal = this.closest('[role="dialog"]');
            if (modal) {
                hideModal(modal.id);
            }
        });
    });

    // ---------- 操作面板内各页签的取消按钮 ----------
    ['add-cancel-button', 'modify-cancel-button', 'delete-cancel-button'].forEach(function (buttonId) {
        document.getElementById(buttonId).addEventListener('click', function () {
            hideModal('operation-modal');
        });
    });

    // ---------- 点击模态框外部关闭 ----------
    document.querySelectorAll('.modal').forEach(function (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === this) {
                hideModal(this.id, { restoreParent: false });
            }
        });
    });

    // ---------- 键盘事件 ----------
    document.addEventListener('keydown', function (e) {
        // ESC：关闭最上层打开的模态框
        if (e.key === 'Escape') {
            var openModals = getVisibleModalList();
            if (openModals.length > 0) {
                hideModal(openModals[openModals.length - 1].id);
            }
        }

        // Enter：触发当前打开模态框的主操作
        if (e.key === 'Enter') {
            var opModal = document.getElementById('operation-modal');
            var saveSelectModal = document.getElementById('save-select-modal');

            // 公告编辑框内 Enter 应为换行，不做触发
            if (document.activeElement === document.getElementById('notice-textarea')) return;

            if (saveSelectModal.style.display === 'flex') {
                document.getElementById('save-select-confirm').click();
            } else if (opModal.style.display === 'flex' &&
                       getVisibleModalList().slice(-1)[0] === opModal) {
                var activeTab = document.querySelector('.operation-tab.is-active');
                var paneKey = activeTab ? activeTab.getAttribute('data-panel') : 'add';
                if (paneKey === 'add') {
                    document.getElementById('submit-homework').click();
                } else if (paneKey === 'modify') {
                    document.getElementById('submit-modify').click();
                } else if (paneKey === 'delete') {
                    document.getElementById('confirm-delete').click();
                } else if (paneKey === 'manage') {
                    document.getElementById('manage-save').click();
                }
            }
        }
    });

    // ---------- 快捷预设按钮 ----------
    document.getElementById('quick-preset-buttons').addEventListener('click', function (e) {
        var btn = e.target.closest('.preset-button');
        if (!btn) return;
        var text = btn.getAttribute('data-text');
        var input = document.getElementById('homework-input');
        input.value += text;
        input.focus();
    });

    // ---------- Markdown示例弹窗 ----------
    var markdownExampleBtn = document.getElementById('markdown-example-btn');
    var markdownExampleClose = document.getElementById('markdown-example-close');
    var markdownExampleTextarea = document.querySelector('#markdown-example-modal textarea');
    var markdownExampleRight = document.querySelector('#markdown-example-modal .markdown-example-right');

    // Markdown 样例文本
    var SAMPLE_MARKDOWN = '# 一级标题\n' +
        '## 二级标题\n' +
        '### 三级标题\n\n' +
        '**粗体**  *斜体*  ~~删除线~~\n\n' +
        '1. 有序列表第一项\n' +
        '2. 有序列表第二项\n\n' +
        '- 无序列表项\n' +
        '- 无序列表子项\n\n' +
        '> 这里是引用文字\n\n' +
        '行内代码: `console.log("hello")`\n\n' +
        '```js\n' +
        'function hello() {\n' +
        '  return "world";\n' +
        '}\n' +
        '```\n\n' +
        '---\n\n' +
        '[链接示例](https://example.com)';

    // 打开弹窗时填充内容并渲染
    function openMarkdownExample() {
        markdownExampleTextarea.value = SAMPLE_MARKDOWN;
        markdownExampleRight.innerHTML = renderMarkdown(SAMPLE_MARKDOWN);
        openModalWithParent('markdown-example-modal');
    }

    function closeMarkdownExample(options) {
        hideModal('markdown-example-modal', options);
    }

    markdownExampleBtn.addEventListener('click', openMarkdownExample);
    markdownExampleClose.addEventListener('click', closeMarkdownExample);

    // ---------- 窗口 resize ----------
    window.addEventListener('resize', checkCompactView);

    // ---------- 本地更新检测 ----------
    document.getElementById('update-banner-dismiss').addEventListener('click', dismissUpdateBanner);
    checkForUpdate();

    // ---------- 定时自动保存（每分钟检查） ----------
    setInterval(checkAutoSave, 60000);
});