/* ============================================================
   SPACE TYPING - core.js
   グローバル名前空間 / ユーティリティ / 音響 / セーブデータ
   ============================================================ */
var ST = window.ST || {};
window.ST = ST;

/* ---------------- Util ---------------- */
ST.U = (function () {
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /* weights: [{w:num, ...}] */
  function weighted(list, key) {
    key = key || 'w';
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i][key];
    var r = Math.random() * total;
    for (i = 0; i < list.length; i++) { r -= list[i][key]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
  function fmt(n) { return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function pct(n, d) { return d <= 0 ? 0 : Math.round((n / d) * 100); }
  function approach(cur, target, delta) {
    if (cur < target) return Math.min(cur + delta, target);
    return Math.max(cur - delta, target);
  }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  return {
    TAU: TAU, clamp: clamp, lerp: lerp, rand: rand, randInt: randInt, choice: choice,
    shuffle: shuffle, weighted: weighted, dist: dist, dist2: dist2, angleTo: angleTo,
    fmt: fmt, pct: pct, approach: approach, uid: uid, esc: esc
  };
})();

/* ---------------- Audio (WebAudio 合成) ---------------- */
ST.Audio = (function () {
  var ctx = null, master = null, sfxGain = null, musicGain = null;
  var enabled = true, ready = false;
  var musicTimer = null, musicStep = 0, musicOn = false;

  function init() {
    if (ready) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return; }
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
    ready = true;
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function setSfx(v) { if (sfxGain) sfxGain.gain.value = v; }
  function setMusic(v) { if (musicGain) musicGain.gain.value = v; }

  function noiseBuffer(dur) {
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function tone(opt) {
    if (!ready || !enabled) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(opt.f0, t);
    if (opt.f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f1), t + opt.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opt.vol || 0.3, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opt.dur);
    o.connect(g);
    if (opt.filter) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = opt.filter;
      g.connect(f); f.connect(opt.bus || sfxGain);
    } else g.connect(opt.bus || sfxGain);
    o.start(t); o.stop(t + opt.dur + 0.02);
  }

  function noise(opt) {
    if (!ready || !enabled) return;
    var t = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(opt.dur);
    var f = ctx.createBiquadFilter();
    f.type = opt.ftype || 'lowpass';
    f.frequency.setValueAtTime(opt.f0 || 1200, t);
    if (opt.f1 != null) f.frequency.exponentialRampToValueAtTime(Math.max(40, opt.f1), t + opt.dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(opt.vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opt.dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t); src.stop(t + opt.dur + 0.02);
  }

  var sfx = {
    key:      function () { tone({ type: 'square', f0: 1500, f1: 1100, dur: 0.045, vol: 0.10, filter: 3000 }); },
    key2:     function () { tone({ type: 'square', f0: 1750, f1: 1300, dur: 0.045, vol: 0.10, filter: 3000 }); },
    shot:     function () { tone({ type: 'sawtooth', f0: 900, f1: 260, dur: 0.09, vol: 0.13, filter: 2600 }); },
    lock:     function () { tone({ type: 'triangle', f0: 420, f1: 900, dur: 0.10, vol: 0.20 }); },
    miss:     function () { tone({ type: 'square', f0: 190, f1: 80, dur: 0.14, vol: 0.20, filter: 900 }); },
    kill:     function () { noise({ dur: 0.30, f0: 2400, f1: 180, vol: 0.30 }); tone({ type: 'sine', f0: 260, f1: 60, dur: 0.28, vol: 0.18 }); },
    bigkill:  function () { noise({ dur: 0.70, f0: 3200, f1: 90, vol: 0.42 }); tone({ type: 'sine', f0: 160, f1: 35, dur: 0.75, vol: 0.28 }); },
    intercept:function () { tone({ type: 'triangle', f0: 2200, f1: 700, dur: 0.06, vol: 0.16 }); noise({ dur: 0.09, f0: 4000, f1: 900, vol: 0.13 }); },
    hurt:     function () { noise({ dur: 0.35, f0: 700, f1: 60, vol: 0.42 }); tone({ type: 'sawtooth', f0: 150, f1: 45, dur: 0.32, vol: 0.28, filter: 600 }); },
    levelup:  function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone({ type: 'triangle', f0: f, dur: 0.30, vol: 0.24 }); }, i * 85); }); },
    loot:     function () { [880, 1175, 1568].forEach(function (f, i) { setTimeout(function () { tone({ type: 'sine', f0: f, dur: 0.20, vol: 0.18 }); }, i * 60); }); },
    overdrive:function () { tone({ type: 'sawtooth', f0: 110, f1: 1400, dur: 0.65, vol: 0.30, filter: 4000 }); noise({ dur: 0.7, f0: 400, f1: 6000, ftype: 'bandpass', vol: 0.2 }); },
    warn:     function () { tone({ type: 'square', f0: 620, f1: 620, dur: 0.14, vol: 0.16 }); setTimeout(function () { tone({ type: 'square', f0: 620, f1: 620, dur: 0.14, vol: 0.16 }); }, 190); },
    ui:       function () { tone({ type: 'square', f0: 1200, f1: 1600, dur: 0.04, vol: 0.10, filter: 4000 }); },
    ok:       function () { tone({ type: 'triangle', f0: 700, f1: 1300, dur: 0.13, vol: 0.20 }); },
    deny:     function () { tone({ type: 'square', f0: 240, f1: 150, dur: 0.16, vol: 0.18, filter: 800 }); },
    boss:     function () { tone({ type: 'sawtooth', f0: 60, f1: 220, dur: 1.3, vol: 0.32, filter: 700 }); },
    charge:   function () { tone({ type: 'sawtooth', f0: 220, f1: 1500, dur: 0.55, vol: 0.12, filter: 2600 }); },
    laser:    function () { tone({ type: 'square', f0: 1800, f1: 120, dur: 0.22, vol: 0.30, filter: 5000 }); noise({ dur: 0.26, f0: 6000, f1: 300, vol: 0.24 }); }
  };

  function play(name) { if (!enabled || !ready) return; var f = sfx[name]; if (f) { try { f(); } catch (e) { } } }

  /* --- 簡易シーケンサBGM --- */
  var SCALE = [0, 3, 5, 7, 10];  /* minor pentatonic */
  var ROOTS = [110, 98, 116.5, 87.3];
  function musicTick() {
    if (!musicOn || !ready) return;
    var bar = Math.floor(musicStep / 16) % 4;
    var root = ROOTS[bar];
    var s = musicStep % 16;
    /* bass */
    if (s % 4 === 0) tone({ type: 'triangle', f0: root / 2, dur: 0.34, vol: 0.5, bus: musicGain, filter: 500 });
    /* arp */
    var deg = SCALE[(musicStep * 3 + bar) % SCALE.length];
    var oct = (s % 8 < 4) ? 4 : 8;
    tone({ type: 'square', f0: root * oct / 4 * Math.pow(2, deg / 12), dur: 0.16, vol: 0.13, bus: musicGain, filter: 2400 });
    /* hat */
    if (s % 2 === 1 && ready) {
      var t = ctx.currentTime;
      var src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.05);
      var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      var g = ctx.createGain(); g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f); f.connect(g); g.connect(musicGain); src.start(t); src.stop(t + 0.06);
    }
    musicStep++;
  }
  function startMusic() {
    if (!ready || !enabled || musicOn) return;
    musicOn = true; musicStep = 0;
    musicTimer = setInterval(musicTick, 145);
  }
  function stopMusic() { musicOn = false; if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
  function setEnabled(v) { enabled = v; if (!v) stopMusic(); }

  return {
    init: init, resume: resume, play: play, setSfx: setSfx, setMusic: setMusic,
    startMusic: startMusic, stopMusic: stopMusic, setEnabled: setEnabled,
    isReady: function () { return ready; }
  };
})();

/* ---------------- Save ---------------- */
ST.Save = (function () {
  var KEY = 'spacetyping.save.v1';
  var defaults = {
    version: 1,
    pilot: {
      name: 'PILOT-01', level: 1, exp: 0, credits: 300,
      statPoints: 0,
      base: { atk: 0, def: 0, hp: 0, luck: 0 }
    },
    equipped: { weapon: null, core: null, armor: null, module1: null, module2: null },
    inventory: [],
    progress: { clearedSectors: {}, unlockedDiff: { novice: 1, cadet: 1, pilot: 1 } },
    records: {},           /* key: sectorId+'|'+diff -> {score, rank, acc, wpm} */
    settings: {
      lang: 'ja',          /* ja | en | mix */
      showRomaji: true,
      sfxVol: 0.5, musicVol: 0.22, audio: true,
      crt: true, shake: true, particles: 1,
      autoLock: true       /* 最初の1文字で自動ロックオン */
    },
    stats: { totalKeys: 0, totalCorrect: 0, totalKills: 0, bestWpm: 0, runs: 0, bestCombo: 0 }
  };

  function deepMerge(base, over) {
    var out = {}, k;
    for (k in base) {
      if (over && Object.prototype.hasOwnProperty.call(over, k)) {
        if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = deepMerge(base[k], over[k]);
        else out[k] = over[k];
      } else out[k] = (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) ? deepMerge(base[k], {}) : base[k];
    }
    if (over) for (k in over) if (!(k in out)) out[k] = over[k];
    return out;
  }

  var data = null;
  var lastError = null;      /* 直近の保存/読込の失敗（黙って消えないよう保持する） */

  function warn(msg, e) {
    lastError = msg;
    if (typeof console !== 'undefined' && console.warn) console.warn('SpaceTyping: ' + msg, e || '');
  }

  function load() {
    if (data) return data;
    var raw = null;
    try { raw = localStorage.getItem(KEY); }
    catch (e) { warn('セーブデータを読み込めません（localStorage が使用できません）', e); }
    if (raw) {
      try { data = deepMerge(defaults, JSON.parse(raw)); }
      catch (e) {
        warn('セーブデータが壊れているため初期状態で開始します', e);
        data = deepMerge(defaults, {});
      }
    } else data = deepMerge(defaults, {});
    return data;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      lastError = null;
      return true;
    } catch (e) {
      /* 失敗を握りつぶすと記録が消えたように見えるので、必ず残す */
      warn('セーブに失敗しました（容量超過、またはプライベートウィンドウ）', e);
      return false;
    }
  }
  function reset() { data = deepMerge(defaults, {}); save(); return data; }
  return {
    load: load, save: save, reset: reset,
    lastError: function () { return lastError; },
    get d() { return load(); }
  };
})();
