/* ============================================================
   SpaceTyping テストハーネス

   ブラウザなしで game.js を丸ごと動かすための DOM スタブ。
   - canvas / localStorage / requestAnimationFrame を差し替える
   - 乱数をシード固定できる（装備のランダム性を消して比較可能にする）
   - チューニング定数をメモリ上で差し替えられる（ソースは書き換えない）
   ============================================================ */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCES = [
  'js/core.js', 'js/romaji.js', 'js/words.js', 'js/items.js',
  'js/entities.js', 'js/stages.js', 'js/ui.js', 'js/game.js'
];

/* ---------- Canvas 2D スタブ ---------- */
function makeCtx2D() {
  const noop = () => {};
  return {
    canvas: { width: 960, height: 720 },
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop,
    lineTo: noop, arc: noop, rect: noop, fill: noop, stroke: noop, clip: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop, strokeText: noop,
    translate: noop, rotate: noop, scale: noop, setTransform: noop, transform: noop,
    setLineDash: noop, drawImage: noop, putImageData: noop,
    measureText: (t) => ({ width: String(t == null ? '' : t).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
    textAlign: 'left', textBaseline: 'top', shadowBlur: 0, shadowColor: '',
    globalCompositeOperation: 'source-over'
  };
}

/* ---------- 要素スタブ ---------- */
function makeEl(id, tag) {
  const el = {
    id: id || '', tagName: (tag || 'div').toUpperCase(),
    _cls: new Set(), _children: [], style: {}, dataset: {},
    textContent: '', value: '', width: 0, height: 0,
    offsetWidth: 100, offsetHeight: 40, onclick: null, oninput: null,
    _html: ''
  };
  el.classList = {
    add: (...c) => c.forEach(x => el._cls.add(x)),
    remove: (...c) => c.forEach(x => el._cls.delete(x)),
    toggle: (c, f) => {
      if (f === undefined) { el._cls.has(c) ? el._cls.delete(c) : el._cls.add(c); }
      else { f ? el._cls.add(c) : el._cls.delete(c); }
    },
    contains: (c) => el._cls.has(c)
  };
  Object.defineProperty(el, 'className', {
    get: () => Array.from(el._cls).join(' '),
    set: (v) => { el._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  });
  Object.defineProperty(el, 'innerHTML', {
    get: () => el._html,
    set: (v) => { el._html = String(v); el._children = []; }
  });
  el.appendChild = (c) => { el._children.push(c); return c; };
  el.removeChild = (c) => { const i = el._children.indexOf(c); if (i >= 0) el._children.splice(i, 1); };

  /* innerHTML から該当タグを拾い、appendChild された実要素と合わせて返す。
     data-* 属性も取り込むので、ボタンの onclick を実際に発火できる。 */
  el._qsa = {};
  el.querySelectorAll = (sel) => {
    const sig = el._html + ' ' + el._children.length;
    const cached = el._qsa[sel];
    if (cached && cached.sig === sig) return cached.arr;
    const kids = el._children.filter(ch =>
      sel.charAt(0) === '.' ? ch._cls.has(sel.slice(1)) : ch.tagName === sel.toUpperCase());
    const html = el._html || '';
    const re = sel.charAt(0) === '.'
      ? new RegExp('<(\\w+)([^>]*\\bclass="[^"]*\\b' + sel.slice(1) + '\\b[^"]*"[^>]*)>', 'g')
      : new RegExp('<(' + sel + ')((?:\\s[^>]*)?)>', 'g');
    const arr = [];
    let m;
    while ((m = re.exec(html))) {
      const child = makeEl('', m[1]);
      const attrs = m[2] || '';
      let a, ra = /([\w-]+)="([^"]*)"/g;
      while ((a = ra.exec(attrs))) {
        if (a[1].indexOf('data-') === 0) child.dataset[a[1].slice(5)] = a[2];
        else if (a[1] === 'class') child.className = a[2];
        else if (a[1] === 'id') child.id = a[2];
      }
      const close = html.indexOf('</' + m[1] + '>', re.lastIndex);
      child.textContent = close > 0 ? html.slice(re.lastIndex, close).replace(/<[^>]*>/g, '') : '';
      arr.push(child);
    }
    const all = kids.concat(arr);
    el._qsa[sel] = { sig, arr: all };
    return all;
  };
  el.querySelector = (sel) => el.querySelectorAll(sel)[0] || null;
  el.getAttribute = (k) => {
    const key = k.indexOf('data-') === 0 ? k.slice(5) : k;
    return el.dataset[key] !== undefined ? el.dataset[key] : null;
  };
  el.setAttribute = (k, v) => { el.dataset[k.indexOf('data-') === 0 ? k.slice(5) : k] = v; };
  el.scrollIntoView = () => {};
  el.addEventListener = () => {};
  el.getContext = () => (el._ctx || (el._ctx = makeCtx2D()));
  return el;
}

const SCREEN_IDS = ['scr-title', 'scr-difficulty', 'scr-sector', 'scr-hangar', 'scr-shop',
  'scr-settings', 'scr-help', 'scr-pause', 'scr-result'];

/**
 * ゲームを動かせるサンドボックスを作る。
 *
 * @param {object} [opt]
 * @param {number} [opt.seed]      乱数シード。指定すると装備生成も含めて完全に再現される
 * @param {object} [opt.overrides] js/game.js の `var NAME = 値;` をメモリ上で差し替える
 *                                 例: { LASER_BASE: 8, PRESSURE_TIME: 55 }
 * @param {function} [opt.makeCtx] canvas 2D コンテキストの生成関数（描画検証で差し替える）
 */
function build(opt) {
  opt = opt || {};
  const store = {};
  const els = {};
  const listeners = {};
  const overrides = opt.overrides || {};
  const ctxFactory = opt.makeCtx || makeCtx2D;

  const document = {
    _els: els,
    getElementById: (id) => els[id] || (els[id] = makeEl(id)),
    createElement: (tag) => {
      const el = makeEl('', tag);
      if (String(tag).toLowerCase() === 'canvas') {
        const c = ctxFactory();
        el.getContext = () => c;
      }
      return el;
    },
    querySelectorAll: (sel) => {
      if (sel === '#screens .screen') return SCREEN_IDS.map(id => document.getElementById(id));
      return [];
    },
    querySelector: () => null,
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    body: makeEl('body', 'body'),
    documentElement: makeEl('html', 'html')
  };
  /* canvas#game のコンテキストも差し替え対象にする */
  const gameCanvas = document.getElementById('game');
  const gameCtx = ctxFactory();
  gameCanvas.getContext = () => gameCtx;

  let rafCbs = [];
  let ctxRef = null;

  /* Math を複製して random だけ差し替えられるようにする */
  const M = {};
  Object.getOwnPropertyNames(Math).forEach(k => { M[k] = Math[k]; });

  const ctx = {
    console, Math: M, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    document,
    performance: { now: () => ctxRef._t },
    requestAnimationFrame: (cb) => { rafCbs.push(cb); return rafCbs.length; },
    cancelAnimationFrame: () => {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener: () => {},
    innerWidth: 1600, innerHeight: 1000,
    /* AudioContext を渡さないので音響は無効のまま動く */
    AudioContext: undefined, webkitAudioContext: undefined,
    _listeners: listeners,
    _takeRaf: () => { const c = rafCbs; rafCbs = []; return c; },
    _store: store,
    _gameCtx: gameCtx
  };

  ctx.setSeed = (seed) => {
    let a = seed >>> 0;
    M.random = () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  ctx._t = 0;
  ctxRef = ctx;
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);

  ctx.fire = (type, ev) => { (listeners[type] || []).forEach(f => f(ev)); };
  ctx.key = (k) => ctx.fire('keydown', {
    key: k, repeat: false, preventDefault() {}, stopPropagation() {}
  });

  /* 定数の差し替えはメモリ上だけで行う。ソースには一切触れない。 */
  function applyOverrides(src, file) {
    let out = src;
    for (const name in overrides) {
      const re = new RegExp('(\\bvar\\s+' + name + '\\s*=\\s*)([0-9.]+)', 'm');
      if (re.test(out)) out = out.replace(re, '$1' + overrides[name]);
      else if (file === 'js/game.js') {
        throw new Error('override 対象が見つかりません: ' + name + ' (js/game.js)');
      }
    }
    return out;
  }

  ctx.load = (f) => {
    let src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (f === 'js/game.js') src = applyOverrides(src, f);
    vm.runInContext(src, ctx, { filename: f });
  };
  ctx.loadAll = () => {
    SOURCES.forEach(ctx.load);
    ctx.fire('DOMContentLoaded', {});
    return ctx.ST;
  };

  if (opt.seed !== undefined) ctx.setSeed(opt.seed);
  return ctx;
}

/** build + loadAll をまとめた省略形 */
function boot(opt) {
  const c = build(opt);
  c.loadAll();
  return c;
}

module.exports = { build, boot, makeEl, makeCtx2D, ROOT, SOURCES };
