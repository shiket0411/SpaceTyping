/* ============================================================
   SPACE TYPING - training.js
   打鍵の分析 / 苦手克服の出題 / カスタム単語 / デイリー任務 / シード乱数
   ============================================================ */
ST.Training = (function () {
  var U = ST.U;

  /* ============================================================
     シード乱数
     デイリー任務では「出現する敵」「敵の単語」「迎撃ワード」をそれぞれ別の
     乱数列で決める。打鍵のタイミングで会心判定などの消費順が変わっても、
     盤面と出題の並びは全員で同じになる。
     ============================================================ */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* fn の実行中だけ Math.random を差し替える */
  function withRng(r, fn) {
    if (!r) return fn();
    var orig = Math.random;
    Math.random = r;
    try { return fn(); } finally { Math.random = orig; }
  }
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  /* ============================================================
     打鍵の分析
     keys : 打つべきだったキーごとの [正打, ミス]
     kana : ミスしたかな（拍）ごとの回数
     words: ミスした単語ごとの回数（苦手克服で再出題するために単語ごと保持する）
     ============================================================ */
  function newRunStats() { return { keys: {}, kana: {}, words: {} }; }
  function wordKey(w) { return w.kana || w.text; }
  function slimWord(w) { return w.kana ? { kana: w.kana, text: w.text, en: w.en } : { text: w.text }; }

  function recordOk(rs, ch) {
    var k = rs.keys[ch] || (rs.keys[ch] = [0, 0]);
    k[0]++;
  }
  /* expect: 打つべきだった文字 / kana: その時点の拍 / word: 単語オブジェクト */
  function recordMiss(rs, expect, kana, word) {
    if (expect) {
      var k = rs.keys[expect] || (rs.keys[expect] = [0, 0]);
      k[1]++;
    }
    if (kana) rs.kana[kana] = (rs.kana[kana] || 0) + 1;
    if (word) {
      var key = wordKey(word);
      var e = rs.words[key] || (rs.words[key] = { n: 0, w: slimWord(word) });
      e.n++;
    }
  }

  var KEY_CAP = 4000;      /* 1キーあたりの標本上限。超えたら半減して最近の傾向を効かせる */
  var DECAY = 0.85;        /* 任務ごとに過去のかな/単語ミスを減衰させる（克服が反映されるように） */
  var WORD_MAX = 150;

  function analysis(save) {
    save.analysis = save.analysis || { keys: {}, kana: {}, words: {} };
    return save.analysis;
  }

  function merge(save, rs) {
    var a = analysis(save), k;
    for (k in rs.keys) {
      var cur = a.keys[k] || (a.keys[k] = [0, 0]);
      cur[0] += rs.keys[k][0]; cur[1] += rs.keys[k][1];
      if (cur[0] + cur[1] > KEY_CAP) { cur[0] = Math.round(cur[0] / 2); cur[1] = Math.round(cur[1] / 2); }
    }
    for (k in a.kana) { a.kana[k] *= DECAY; if (a.kana[k] < 0.3) delete a.kana[k]; }
    for (k in rs.kana) a.kana[k] = (a.kana[k] || 0) + rs.kana[k];
    for (k in a.words) { a.words[k].n *= DECAY; if (a.words[k].n < 0.3) delete a.words[k]; }
    for (k in rs.words) {
      var e = a.words[k] || (a.words[k] = { n: 0, w: rs.words[k].w });
      e.n += rs.words[k].n;
    }
    /* 単語の記録は件数を絞る（セーブ容量のため） */
    var keys = Object.keys(a.words);
    if (keys.length > WORD_MAX) {
      keys.sort(function (x, y) { return a.words[y].n - a.words[x].n; });
      keys.slice(WORD_MAX).forEach(function (x) { delete a.words[x]; });
    }
  }

  /* 標本が少ないキーのミス率が極端に出ないよう、分母に下駄を履かせる */
  function smoothRate(ok, miss) { return miss / (ok + miss + 8); }

  function weakKeys(src, n, minSamples) {
    var out = [];
    for (var k in src.keys) {
      var v = src.keys[k];
      if (v[0] + v[1] < (minSamples || 0) || v[1] === 0) continue;
      out.push({ ch: k, ok: v[0], miss: v[1], rate: v[1] / (v[0] + v[1]), score: smoothRate(v[0], v[1]) });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, n || 10);
  }
  function weakKana(src, n) {
    var out = [];
    for (var k in src.kana) out.push({ k: k, n: src.kana[k] });
    out.sort(function (a, b) { return b.n - a.n; });
    return out.slice(0, n || 10);
  }
  function weakWords(src, n) {
    var out = [];
    for (var k in src.words) out.push({ key: k, n: src.words[k].n, w: src.words[k].w });
    out.sort(function (a, b) { return b.n - a.n; });
    return out.slice(0, n || 10);
  }
  function hasData(save) {
    var a = analysis(save);
    for (var k in a.keys) if (a.keys[k][1] > 0) return true;
    return false;
  }

  /* ============================================================
     苦手克服の出題
     ミス率の高いキー・ミスの多いかな・ミスした単語を多く含む語ほど選ばれやすい。
     ============================================================ */
  function weakScore(a, w) {
    var s = 0, i;
    var ro = w.romaji || w.text || '';
    for (i = 0; i < ro.length; i++) {
      var v = a.keys[ro.charAt(i)];
      if (v) s += smoothRate(v[0], v[1]);
    }
    s /= Math.sqrt(Math.max(1, ro.length));
    if (w.kana) {
      for (var k in a.kana) if (w.kana.indexOf(k) >= 0) s += Math.min(2, a.kana[k]) * 0.15;
    }
    var rec = a.words[wordKey(w)];
    if (rec) s += Math.min(4, rec.n) * 0.5;
    return s;
  }
  function pickWeak(save, tier, lang) {
    var a = analysis(save);
    if (!hasData(save)) return ST.Words.pick(tier, lang);
    var pool = ST.Words.all(lang === 'mix' ? 'mix' : lang).filter(function (w) {
      return Math.abs(ST.Words.tierOf(w.len) - tier) <= 1;
    });
    if (!pool.length) return ST.Words.pick(tier, lang);
    var scored = pool.map(function (w) { return { w: w, s: weakScore(a, w) }; });
    scored.sort(function (x, y) { return y.s - x.s; });
    return ST.Words.pickFrom(scored.slice(0, 30).map(function (x) { return x.w; }));
  }

  /* ============================================================
     カスタム単語
     1行1語。
       日本語: かな[,表記[,意味]]   区切りはカンマ・タブ・読点。カタカナは平仮名に直す
       英語  : 英字の行はそのまま出題。タブの後ろは意味として表示する
     ============================================================ */
  var CUSTOM_MAX = 500;
  var ASCII_OK = /^[a-z0-9\-,.\/' ]+$/;

  function typeable(w) {
    var m = ST.Romaji.create(w);
    var seq = w.kana ? ST.Romaji.defaultRomaji(w.kana) : w.text;
    if (!seq) return false;
    for (var i = 0; i < seq.length; i++) {
      var r = m.feed(seq.charAt(i));
      if (r === 'miss') return false;
      if (r === 'done') return i === seq.length - 1;
    }
    return false;
  }

  function parseCustom(text) {
    var words = [], errors = [], seen = {};
    var lines = String(text || '').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/^\s+|\s+$/g, '');
      if (!line || line.charAt(0) === '#') continue;
      var w = null;
      var lower = line.toLowerCase();
      var tab = lower.indexOf('\t');
      var head = tab >= 0 ? lower.slice(0, tab).replace(/\s+$/, '') : lower;
      if (ASCII_OK.test(head)) {
        var t = head.replace(/\s+/g, ' ');
        if (t.length > 60) { errors.push((i + 1) + '行目: 60文字までにしてください'); continue; }
        w = { text: t };
        if (tab >= 0) w.ja = line.slice(tab + 1).replace(/^\s+/, '');
      } else {
        var f = line.split(/[,\t、，]/);
        var kana = ST.Romaji.toHira(f[0].replace(/\s+/g, ''));
        if (!/^[ぁ-ゖー]+$/.test(kana)) {
          errors.push((i + 1) + '行目: 読みは ひらがな/カタカナ で書いてください (' + f[0] + ')');
          continue;
        }
        w = { kana: kana, text: (f[1] || kana).replace(/^\s+|\s+$/g, ''), en: (f[2] || '').replace(/^\s+|\s+$/g, '') };
      }
      var key = wordKey(w);
      if (seen[key]) continue;
      if (!typeable(w)) { errors.push((i + 1) + '行目: 打鍵できない文字を含みます (' + line + ')'); continue; }
      seen[key] = 1;
      words.push(w);
      if (words.length >= CUSTOM_MAX) { errors.push(CUSTOM_MAX + '語を超えた分は読み込みません'); break; }
    }
    return { words: words, errors: errors };
  }
  /* 保存用の文字列へ戻す（編集欄に再表示するため） */
  function formatCustom(list) {
    return (list || []).map(function (w) {
      if (w.kana) return w.kana + (w.text && w.text !== w.kana ? ',' + w.text : '') + (w.en ? ',' + w.en : '');
      return w.text + (w.ja ? '\t' + w.ja : '');
    }).join('\n');
  }
  /* 出題用に長さ情報を付ける */
  function prepareCustom(list) {
    return (list || []).map(function (w) {
      var c = {};
      for (var k in w) c[k] = w[k];
      c.romaji = w.kana ? ST.Romaji.defaultRomaji(w.kana) : w.text;
      c.len = c.romaji.length;
      return c;
    });
  }
  /* 指定の長さに近い語を優先する。語数が少なければ全体から選ぶ */
  function pickCustom(list, tier) {
    if (!list || !list.length) return null;
    var near = list.filter(function (w) { return Math.abs(ST.Words.tierOf(w.len) - tier) <= 1; });
    return ST.Words.pickFrom(near.length >= 4 ? near : list);
  }

  /* ============================================================
     デイリー任務
     日付から宙域・敵・ボス・補正・機体を決める。機体は全員共通の規格機
     （LV30 / RARE 装備5点）なので、育成状況に関係なく同じ条件で競える。
     ============================================================ */
  var MODS = [
    { id: 'speed', n: '高速弾', d: '敵弾の速度 +20%', apply: function (d) { d.bulletSpeed *= 1.2; } },
    { id: 'dense', n: '弾幕密集', d: '弾数 +30% / 敵耐久 -15%', apply: function (d) { d.bulletCount *= 1.3; d.hpMul *= 0.85; } },
    { id: 'precise', n: '精密任務', d: 'ミスの重さ x1.5 / スコア +30%', apply: function (d) { d.graceMul *= 1.5; d.score *= 1.3; } },
    { id: 'laser', n: '高圧戦域', d: 'レーザーの発生 +40%', apply: function (d) { d.laser *= 1.4; } },
    { id: 'overdrive', n: '切り札充実', d: 'OD必要量 -40% / 弾数 +15%', apply: function (d) { d.odCost *= 0.6; d.bulletCount *= 1.15; } },
    { id: 'glass', n: '背水', d: '被弾ダメージ x1.5 / 敵耐久 -25%', apply: function (d) { d.dmgTaken *= 1.5; d.hpMul *= 0.75; } }
  ];
  var DAILY_LEVEL = 30, DAILY_ILVL = 30, DAILY_DIFF = 'ace';

  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function daily(key) {
    key = key || dateKey();
    var seed = hashStr('spacetyping-daily-' + key);
    var r = rng(seed);
    var pick = function (arr) { return arr[Math.floor(r() * arr.length)]; };
    var types = Object.keys(ST.EnemyTypes.T).filter(function (k) { return !ST.EnemyTypes.T[k].spawned; });
    var enemies = [];
    while (enemies.length < 4) {
      var t = pick(types);
      if (enemies.indexOf(t) < 0) enemies.push(t);
    }
    var boss = pick(['aegis', 'nyx', 'vulcan', 'oblivion']);
    var hue = Math.floor(r() * 360);
    var mod = pick(MODS);
    var sector = {
      id: 'daily', num: 5, name: 'DAILY OPS', ja: '日替わり任務 ' + key,
      desc: '日付で決まる任務。機体は全員共通の規格機。',
      enemies: enemies, waves: 6, boss: boss, bossScale: 1.0,
      ilvl: DAILY_ILVL, req: null, hue: [hue, (hue + 40) % 360], tierBase: 2, odSector: 5,
      daily: true, dateKey: key
    };
    /* 規格機の装備もシードで決める */
    var loadout = withRng(rng(seed ^ 0x9e3779b9), function () {
      var kind = { weapon: 'weapon', core: 'core', armor: 'armor', module1: 'module', module2: 'module' };
      var out = {};
      Object.keys(kind).forEach(function (s) {
        out[s] = ST.Items.generate(DAILY_ILVL, { slot: kind[s], rarity: 'rare' });
      });
      return out;
    });
    return {
      key: key, seed: seed, sector: sector, diffId: DAILY_DIFF, mod: mod,
      loadout: loadout, level: DAILY_LEVEL
    };
  }
  /* 難易度の複製に補正を掛けたもの */
  function dailyDiff(cfg) {
    var b = ST.Difficulty.get(cfg.diffId), d = {};
    for (var k in b) d[k] = b[k];
    cfg.mod.apply(d);
    d.daily = true;
    return d;
  }

  return {
    rng: rng, withRng: withRng, hashStr: hashStr,
    newRunStats: newRunStats, recordOk: recordOk, recordMiss: recordMiss, merge: merge,
    analysis: analysis, weakKeys: weakKeys, weakKana: weakKana, weakWords: weakWords, hasData: hasData,
    pickWeak: pickWeak,
    parseCustom: parseCustom, formatCustom: formatCustom, prepareCustom: prepareCustom, pickCustom: pickCustom,
    CUSTOM_MAX: CUSTOM_MAX,
    MODS: MODS, dateKey: dateKey, daily: daily, dailyDiff: dailyDiff
  };
})();
