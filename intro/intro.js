/*!
 * 黑幕 · 书法字 开启动画 / 刷新动画（可复用版）
 * ---------------------------------------------------------------------------
 * 零依赖、无构建、可 file:// 直开。暴露全局 `XyIntro`：
 *
 *   XyIntro.play(options) -> Promise<void>   播一次（节点摘掉时 resolve）
 *   XyIntro.remove()                          立刻摘掉当前节点
 *   XyIntro.detectMode() -> 'boot' | 'refresh'
 *   XyIntro.version
 *
 * 自动播放：脚本标签加 `data-auto`，页面一解析到该脚本就播一次；不加则完全手动。
 * 判定口径与原项目一致：导航类型为 reload → 刷新动画，否则 → 开启动画。
 *
 * 设计要点：
 *   · 节点由脚本创建并插到 body 最前（body 尚未解析时插到 <html> 下），
 *     第一帧就是黑幕，不会先闪一下页面；
 *   · 等书法图完全加载才置位 data-ready（CSS 里所有动画都挂在这个位之下），
 *     加载失败 / 超时也会放行 —— 宁可少一段动画，也不能把页面永久盖住；
 *   · 系统「减少动态效果」时直接不创建节点；
 *   · 动画走完（animationend）与计时器双保险，节点一定会被摘掉；
 *   · 可选 onCovered：黑幕完全不透明的那一刻回调（在可见的 2 秒停顿里换页正好）。
 */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  var FALLBACK_IN = 520;      // 从 CSS 读不到 --xy-intro-in 时的兜底进场时长
  var FALLBACK_TOTAL = 2980;  // 从 CSS 读不到总时长时的兜底（520 + 2000 + 460）

  var DEFAULTS = {
    logo: 'assets/tingyuge.png',            // 书法图地址（相对当前 HTML 页面）
    sign: '_KleinRose p1ece LHDyx Roy',     // 署名小字；传 null / '' 不显示
    mode: 'auto',                           // 'auto' | 'boot' | 'refresh'
    variant: 'default',                     // 'default'（tingyuge）| 'screen'（xiaoyao，窄一档）
    width: '',                              // 定格宽度，如 'min(52vmin, 420px)'；空 = 用 CSS 默认
    zIndex: 0,                              // > 0 时覆盖 --xy-intro-z
    inMs: 0,                                // 覆盖 --xy-intro-in（毫秒）
    holdMs: 0,                              // 覆盖 --xy-intro-hold
    outMs: 0,                               // 覆盖 --xy-intro-out
    readyTimeout: 4000,                     // 等素材的上限（毫秒）
    reducedMotion: 'skip',                  // 'skip' 不播 | 'play' 忽略系统设置
    container: null,                        // 挂载父节点，默认 body
    onCovered: null,                        // 黑幕完全不透明时回调一次（降级路径立即回调）
    onDone: null                            // 节点摘掉后回调一次
  };

  var current = null; // { el, timers: [], cover, done }

  function reduceMotion() {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  /** 本次页面加载是「刷新」还是「打开」 */
  function detectMode() {
    try {
      var nav = global.performance && global.performance.getEntriesByType
        ? global.performance.getEntriesByType('navigation')[0]
        : null;
      var type = nav ? nav.type
        : (global.performance && global.performance.navigation && global.performance.navigation.type === 1
          ? 'reload'
          : 'navigate');
      return type === 'reload' ? 'refresh' : 'boot';
    } catch (e) {
      return 'boot';
    }
  }

  function mount(el, container) {
    if (container && container.insertBefore) {
      container.insertBefore(el, container.firstChild);
      return;
    }
    var body = global.document.body;
    if (body && body.insertBefore) body.insertBefore(el, body.firstChild);
    else global.document.documentElement.insertBefore(el, global.document.documentElement.firstChild);
  }

  function cssMs(el, prop, fallback) {
    try {
      var raw = String(global.getComputedStyle(el).getPropertyValue(prop) || '').trim();
      var n = parseFloat(raw);
      if (!isNaN(n)) return /ms$/.test(raw) ? n : n * 1000;
    } catch (e) { /* 无 getComputedStyle / 无样式，走兜底 */ }
    return fallback;
  }

  /** 摘掉当前节点、清理计时器 / 监听，并兑现 Promise */
  function finishCurrent() {
    if (!current) return;
    var node = current;
    current = null;
    for (var i = 0; i < node.timers.length; i++) clearTimeout(node.timers[i]);
    if (node.hideHandler && global.removeEventListener) {
      global.removeEventListener('pagehide', node.hideHandler);
    }
    try { node.cover(); } catch (e) { /* 回调异常不影响清理 */ }
    var el = node.el;
    try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch (e2) { /* 摘不掉也不影响流程 */ }
    try { node.done(); } catch (e3) { /* 同上 */ }
  }

  function play(options) {
    var opts = {};
    var key;
    for (key in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) opts[key] = DEFAULTS[key];
    }
    if (options) {
      for (key in options) {
        if (Object.prototype.hasOwnProperty.call(options, key)) opts[key] = options[key];
      }
    }

    // 重复调用：先收掉上一段，避免两层黑幕叠在一起
    if (current) finishCurrent();

    var resolveDone;
    var promise = new Promise(function (resolve) { resolveDone = resolve; });

    // 回调都只允许兑现一次；任何降级路径也要兑现 onCovered，调用方永远不会挂住
    var covered = false;
    var calls = 0;
    var cover = function () {
      if (covered) return;
      covered = true;
      try { if (typeof opts.onCovered === 'function') opts.onCovered(); } catch (e) { /* 回调出错不影响动画 */ }
    };
    var done = function () {
      if (calls++) return;
      try { if (typeof opts.onDone === 'function') opts.onDone(); } catch (e) { /* 同上 */ }
    };

    if (opts.reducedMotion !== 'play' && reduceMotion()) {
      cover();
      setTimeout(function () { done(); resolveDone(); }, 0);
      return promise;
    }

    var doc = global.document;
    if (!doc || typeof doc.createElement !== 'function') {
      cover();
      resolveDone();
      return promise;
    }

    var mode = opts.mode === 'auto' ? detectMode() : (opts.mode === 'refresh' ? 'refresh' : 'boot');

    var el = doc.createElement('div');
    el.className = 'xy-intro' + (opts.variant === 'screen' ? ' is-screen' : '');
    el.setAttribute('data-mode', mode);
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('role', 'presentation');
    // 首帧兜底：只在开启动画写内联黑底（CSS 尚未到手时也别闪出页面）。
    // 刷新动画的根节点必须透明，否则 .xy-intro-curtain 由透明淡入的那一段看不见。
    if (mode === 'boot') el.style.background = '#000';
    if (opts.zIndex > 0) el.style.zIndex = String(opts.zIndex);
    if (opts.inMs > 0) el.style.setProperty('--xy-intro-in', opts.inMs + 'ms');
    if (opts.holdMs > 0) el.style.setProperty('--xy-intro-hold', opts.holdMs + 'ms');
    if (opts.outMs > 0) el.style.setProperty('--xy-intro-out', opts.outMs + 'ms');
    if (opts.width) el.style.setProperty('--xy-intro-width', opts.width);

    var curtain = doc.createElement('div');
    curtain.className = 'xy-intro-curtain';
    el.appendChild(curtain);

    var mark = doc.createElement('div');
    mark.className = 'xy-intro-mark';
    el.appendChild(mark);

    var img = doc.createElement('img');
    img.className = 'xy-intro-logo';
    img.alt = '';
    img.setAttribute('draggable', 'false');
    mark.appendChild(img);

    if (opts.sign) {
      var sign = doc.createElement('p');
      sign.className = 'xy-intro-sign';
      sign.textContent = String(opts.sign);
      mark.appendChild(sign);
    }

    mount(el, opts.container);

    var started = false;
    var start = function () {
      if (started || !current || current.el !== el || !el.parentNode) return;
      started = true;
      el.setAttribute('data-ready', '1');

      el.addEventListener('animationend', function (e) {
        // 只认挂在根节点上的收尾信号（子元素自己的动画结束不算）
        if (!e || e.target === el) finishCurrent();
      });

      // 黑幕完全不透明的时刻 = --xy-intro-in 走满（两种模式都是这个口径）
      var inMs = cssMs(el, '--xy-intro-in', FALLBACK_IN);
      current.timers.push(setTimeout(cover, inMs || FALLBACK_IN));

      // 兜底：总时长从 CSS 读（--xy-intro-in + --xy-intro-hold + --xy-intro-out），不重复写死
      var total = 0;
      try {
        var cs = global.getComputedStyle(el);
        var names = ['--xy-intro-in', '--xy-intro-hold', '--xy-intro-out'];
        for (var i = 0; i < names.length; i++) {
          total += parseFloat(cs.getPropertyValue(names[i])) || 0;
        }
      } catch (e2) {
        total = 0;
      }
      current.timers.push(setTimeout(finishCurrent, (total || FALLBACK_TOTAL) + 600));
    };

    var node = current = {
      el: el,
      timers: [],
      cover: cover,
      done: function () { done(); resolveDone(); }
    };

    // 素材状态：naturalWidth > 0 才算真拿到像素（complete 对加载失败的图同样为 true）
    img.addEventListener('load', start);
    img.addEventListener('error', start); // 加载失败也放行
    img.src = opts.logo;

    if (img.complete) {
      // 缓存命中（naturalWidth > 0）或明确失败（naturalWidth === 0）都直接开跑
      start();
    } else {
      node.timers.push(setTimeout(start, opts.readyTimeout));
    }

    // 页面在动画途中被卸载时也能及时释放
    if (global.addEventListener) {
      node.hideHandler = function () {
        if (current && current.el === el) finishCurrent();
      };
      global.addEventListener('pagehide', node.hideHandler);
    }

    return promise;
  }

  function remove() {
    finishCurrent();
  }

  /* ---------------- 自动播放：脚本标签加 data-auto ----------------
   * <script src="intro.js" data-auto
   *         data-logo="assets/tingyuge.png"
   *         data-sign="署名 小字" data-mode="auto" data-variant="default"></script>
   *
   * 其它可选项：data-width · data-z-index · data-in-ms · data-hold-ms ·
   *            data-out-ms · data-ready-timeout · data-no-sign
   */
  function autoInit() {
    if (!global.document) return; // Node 里 require 时没有 DOM，不能读 currentScript
    var script = global.document.currentScript;
    if (!script || !script.hasAttribute('data-auto')) return;
    var d = script.dataset || {};
    var opts = {};
    if (d.logo) opts.logo = d.logo;
    if (script.hasAttribute('data-no-sign')) opts.sign = null;
    else if (d.sign !== undefined) opts.sign = d.sign;
    if (d.mode) opts.mode = d.mode;
    if (d.variant) opts.variant = d.variant;
    if (d.width) opts.width = d.width;
    if (d.zIndex) opts.zIndex = Number(d.zIndex) || 0;
    if (d.inMs) opts.inMs = Number(d.inMs) || 0;
    if (d.holdMs) opts.holdMs = Number(d.holdMs) || 0;
    if (d.outMs) opts.outMs = Number(d.outMs) || 0;
    if (d.readyTimeout) opts.readyTimeout = Number(d.readyTimeout) || 4000;
    play(opts);
  }

  var api = {
    version: VERSION,
    play: play,
    remove: remove,
    detectMode: detectMode
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  global.XyIntro = api;

  autoInit();
})(typeof window !== 'undefined' ? window : this);
