/* ============================================================
   SPACE TYPING - game.js
   ゲームループ / タイピング判定 / 弾幕処理 / 描画
   ============================================================ */
ST.Game = (function () {
  var U = ST.U;
  var W = 960, H = 720;

  var cv, ctx, hudEl;
  var G = {};                 /* パターン関数へ渡すゲーム参照 */
  var raf = null, lastT = 0;
  var state = 'idle';         /* idle | playing | paused | ending */
  var run = null;
  var swallowNT = 0;          /* 語尾「ん」の余剰 n 吸収タイマー */
  var shake = { t: 0, m: 0 };
  var flash = { t: 0, c: '#fff', a: 0 };
  var hudT = 0;
  var frameDt = 1 / 60;       /* 直近フレームの経過秒（描画側でも使う） */

  /* ---------- プール ---------- */
  var BULLET_MAX = 2400, PARTICLE_MAX = 1100;
  var bullets = [], particles = [], floaters = [], tracers = [], rings = [];
  (function initPools() {
    for (var i = 0; i < BULLET_MAX; i++) bullets.push({ alive: false });
    for (var j = 0; j < PARTICLE_MAX; j++) particles.push({ alive: false });
  })();
  var bulletCount = 0;
  var bulletCursor = 0;

  /* 空きを毎回先頭から探すと弾幕が濃いとき O(n) になるため、
     前回の続きから走査する（償却でほぼ O(1)） */
  function newBullet() {
    for (var i = 0; i < BULLET_MAX; i++) {
      var idx = (bulletCursor + i) % BULLET_MAX;
      var b = bullets[idx];
      if (!b.alive) {
        b.alive = true; bulletCount++;
        bulletCursor = (idx + 1) % BULLET_MAX;
        return b;
      }
    }
    return null;
  }
  function newParticle() {
    for (var i = 0; i < PARTICLE_MAX; i++) {
      var p = particles[i];
      if (!p.alive) { p.alive = true; return p; }
    }
    return null;
  }
  function killBullet(b) { if (b.alive) { b.alive = false; bulletCount--; } }

  /* ---------- 星空 ---------- */
  var stars = [];
  (function initStars() {
    for (var i = 0; i < 220; i++) {
      var layer = i < 110 ? 0 : (i < 180 ? 1 : 2);
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        z: layer, s: [0.8, 1.3, 2.0][layer],
        v: [14, 34, 66][layer], a: U.rand(0.25, 0.9)
      });
    }
  })();

  /* ---------- 弾スプライトキャッシュ ---------- */
  var sprites = {};
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) { var c = hexToRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function bulletSprite(color, r) {
    var key = color + '|' + r;
    if (sprites[key]) return sprites[key];
    var pad = Math.ceil(r * 3);
    var c = document.createElement('canvas');
    c.width = c.height = pad * 2;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(pad, pad, 0, pad, pad, pad);
    g.addColorStop(0, rgba(color, 0.95));
    g.addColorStop(0.35, rgba(color, 0.55));
    g.addColorStop(1, rgba(color, 0));
    x.fillStyle = g; x.fillRect(0, 0, pad * 2, pad * 2);
    x.beginPath(); x.arc(pad, pad, r * 0.62, 0, U.TAU);
    x.fillStyle = '#fff'; x.globalAlpha = 0.92; x.fill();
    x.globalAlpha = 1;
    x.beginPath(); x.arc(pad, pad, r * 0.95, 0, U.TAU);
    x.strokeStyle = rgba(color, 0.9); x.lineWidth = 1.6; x.stroke();
    sprites[key] = { c: c, pad: pad };
    return sprites[key];
  }

  /* ============================================================
     ステータス計算
     ============================================================ */
  function computeStats() {
    var d = ST.Save.d;
    var b = ST.Growth.baseStats(d.pilot.level);
    var e = ST.Items.aggregate(d.equipped);
    var s = {
      maxHp: Math.round(b.maxHp + e.maxHp),
      atk: (b.atk + e.atk) * (1 + e.atkPct / 100),
      crit: b.crit + e.crit,
      critMult: b.critMult + e.critMult,
      finisher: e.finisher,
      def: Math.min(50, e.def),
      hpRegen: e.hpRegen,
      shieldMax: Math.round(b.shieldMax + e.shieldMax),
      shieldRegen: e.shieldRegen,
      interceptBlast: 52 + e.interceptBlast,
      /* 迎撃エネルギー: 容量が「攻撃モードを続けられる時間」になる */
      energyMax: Math.round(100 + e.energyMax),
      energyCharge: 5.0 * (1 + e.energyCharge / 100),
      interceptCost: 10.0 * (1 - Math.min(40, e.interceptCost) / 100),
      freeIntercept: Math.min(80, e.freeIntercept),
      odGain: e.odGain, odDuration: e.odDuration,
      bulletSlow: Math.min(45, e.bulletSlow),
      comboKeep: Math.min(85, e.comboKeep),
      grace: Math.min(70, e.grace),
      expGain: e.expGain, dropRate: e.dropRate,
      creditGain: e.creditGain, scoreMul: e.scoreMul,
      uniques: e.uniques
    };
    return s;
  }

  /* ============================================================
     開始 / 終了
     ============================================================ */
  function start(sectorId, diffId) {
    var save = ST.Save.d;
    var sector = ST.Sectors.map[sectorId];
    var diff = ST.Difficulty.get(diffId);
    if (!sector) return;

    ST.Words.resetRecent();
    var stats = computeStats();

    run = {
      sector: sector, diff: diff, stats: stats,
      waveIdx: 0, waveQueue: [], waveTimer: 0, waveState: 'intro', waveStateT: 1.4,
      enemies: [], loot: [], boss: null,
      player: {
        x: W / 2, y: H - 112, tx: W / 2,
        hp: stats.maxHp, maxHp: stats.maxHp,
        shield: 0, shieldMax: stats.shieldMax,
        inv: 0, hitR: 5, phaseCd: 0
      },
      /* 攻撃モード: 打鍵は「順番の先頭の敵」だけに入る。
         迎撃モード: 打鍵は迎撃ワードに入り、迎撃エネルギーを充填する。
         迎撃自体はエネルギーが残っていれば両モードで自動的に行われる。 */
      mode: 'attack',
      /* 戦域圧力: 時間で上昇し、敵を倒すと下がる。高いほど敵が
         迎撃不可のレーザーを撃つようになるため、篭って耐えるほど不利になる。 */
      pressure: 0,
      lasers: [],
      laserT: 6,
      seqCounter: 0,
      target: null,
      ic: { word: null, matcher: null },
      energy: stats.energyMax,
      overload: false,        /* エネルギー枯渇 = 迎撃系のダウン状態 */
      icCd: 0,                /* 迎撃の発射間隔。密集弾は撃ち切れない */
      threat: 0,
      od: { gauge: 0, active: 0, ready: false },
      grace: 0,                  /* オーバーキル後の入力吸収 */
      stun: 0, stunMax: 1,
      chainCount: 0, precisionStack: 0,
      s: {
        keys: 0, correct: 0, miss: 0, kills: 0, intercepts: 0,
        score: 0, combo: 0, maxCombo: 0, words: 0, damage: 0,
        t0: performance.now(), elapsed: 0, hits: 0
      },
      finished: false, result: null
    };
    /* 弾・粒子クリア */
    for (var i = 0; i < BULLET_MAX; i++) bullets[i].alive = false;
    for (var j = 0; j < PARTICLE_MAX; j++) particles[j].alive = false;
    bulletCount = 0; bulletCursor = 0;
    floaters.length = 0; tracers.length = 0; rings.length = 0;
    swallowNT = 0; hudCache = {};
    shake.t = 0; shake.m = 0; flash.t = 0;

    G.diff = diff; G.stats = stats; G.player = run.player; G.newBullet = newBullet;
    nextInterceptWord();

    hudEl.classList.remove('hidden');
    ST.UI.show(null);
    state = 'playing';
    lastT = performance.now();
    toast(sector.ja, sector.hue ? '#4df3ff' : '#4df3ff');
    ST.Audio.resume();
    ST.Audio.startMusic();
    if (!raf) raf = requestAnimationFrame(loop);
    updateHud(true);
  }

  function quit() {
    state = 'idle';
    run = null;
    hudEl.classList.add('hidden');
    ST.Audio.stopMusic();
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    ST.UI.show('scr-pause');
    ST.Audio.stopMusic();
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    ST.UI.show(null);
    lastT = performance.now();
    ST.Audio.startMusic();
  }

  /* ============================================================
     敵スポーン
     ============================================================ */
  /* 雑魚の単語階層。tier5(文章) は語長ぶん撃破に時間がかかり圧力の収支を崩すので、
     雑魚には割り当てない。文章はボス専用にしてある。 */
  function wordTierFor(sector, typeDef, diff) {
    var t = Math.round(sector.tierBase * 0.5 + typeDef.tier * 0.7) + diff.tierAdd;
    return U.clamp(t, 0, 4);
  }

  function assignWord(e) {
    /* ボスは高難易度で文章(tier5)まで使う。ボス戦の長さは所要打鍵で決まり
       語長には依存しないので、長文を混ぜても戦闘時間は変わらない。 */
    var tier = e.boss ? U.clamp(3 + run.diff.tierAdd, 2, 5) : wordTierFor(run.sector, e.def, run.diff);
    var w = ST.Words.pick(tier, ST.Save.d.settings.lang);
    e.word = w;
    e.matcher = ST.Romaji.create(w);
  }

  /* ---------- 目標の自動選択 ----------
     敵は出現順 seq を持ち、生存している中で seq が最小のものが常に目標になる。
     撃破されれば自動的に次へ進む。TAB は現在の目標を列の最後尾に回す。 */
  function refreshTarget() {
    var best = null;
    for (var i = 0; i < run.enemies.length; i++) {
      var e = run.enemies[i];
      if (e.dead || e.spawnT > 0) continue;
      if (!best || e.seq < best.seq) best = e;
    }
    run.target = best;
    return best;
  }

  /* 表示用: 生存中の敵を順番どおりに並べた配列 */
  function orderedEnemies() {
    var list = [];
    for (var i = 0; i < run.enemies.length; i++) {
      var e = run.enemies[i];
      if (!e.dead && e.spawnT <= 0) list.push(e);
    }
    list.sort(function (a, b) { return a.seq - b.seq; });
    return list;
  }

  function skipTarget() {
    var list = orderedEnemies();
    if (list.length < 2) { ST.Audio.play('deny'); return; }
    /* 現在の目標を最後尾へ回すだけなので、順番の考え方は変わらない */
    list[0].seq = run.seqCounter++;
    refreshTarget();
    ST.Audio.play('lock');
  }

  /* ---------- 迎撃ワード ---------- */
  function nextInterceptWord() {
    var tier = U.clamp(run.sector.tierBase + run.diff.tierAdd, 0, 3);
    var w = ST.Words.pick(tier, ST.Save.d.settings.lang);
    run.ic.word = w;
    run.ic.matcher = ST.Romaji.create(w);
  }

  function setMode(m) {
    if (run.mode === m) return;
    run.mode = m;
    ST.Audio.play('lock');
    flash.t = 0.16;
    flash.c = m === 'attack' ? '#ffc24d' : '#59ff9e';
    flash.a = 0.10;
  }

  /* その宙域に到達した頃の標準的な砲撃力。
     係数 2.3 は実際のドロップ装備を積んだ状態を実測して合わせたもの。 */
  function expectedAtk() { return (10 + run.sector.ilvl * 1.6) * 2.3; }

  /* ボスHP算出に使う「1単語あたりの想定与ダメージ ÷ 砲撃力」係数。
     削り(0.85/打) + 完撃(0.7×語長) を平均12打鍵で見積もった 18.6 に、
     コンボ倍率と会心による上振れの実測ぶん(約1.45倍)を織り込んで校正した値。 */
  var WORD_DPS = 27;

  function spawnEnemy(typeId, x, y, isBoss, scale) {
    var def = isBoss ? ST.EnemyTypes.BOSS[typeId] : ST.EnemyTypes.T[typeId];
    if (!def) return null;
    var e = {
      def: def, typeId: typeId, boss: !!isBoss,
      x: x, y: y, baseX: x, holdY: def.holdY || 150,
      spd: def.spd, r: def.r, color: def.color, shape: def.shape,
      seq: run.seqCounter++,
      t: 0, fireCount: 0, atkT: [], dir: Math.random() < 0.5 ? 1 : -1,
      amp: U.rand(70, 130), freq: U.rand(1.2, 2.2),
      /* 定位フェーズ用（ST.Moves.enterHold / place が使う） */
      held: false, holdT: 0, settle: 0, sx: 0, sy: 0, px: 0,
      orbA: Math.random() * U.TAU, orbR: U.rand(200, 300),
      hitFlash: 0, dead: false, phaseIdx: 0, tpFlash: 0, tpT: U.rand(0.4, 1.2),
      spawnT: 0.45
    };
    assignWord(e);
    /* 敵の硬さは「単語の長さ」で表現する。装備が上回っていれば
       打ち切る前に落とせるが、打ち切れば必ず落ちる（onWordComplete 参照）。 */
    var lenFactor = Math.max(3, e.matcher.total);
    var hp = def.hp * expectedAtk() * lenFactor * run.diff.hpMul;
    if (isBoss) {
      /* ボスは「何単語で落とせるか」を設計値にする。装備が極端でも
         戦闘が一瞬で終わったり延々続いたりしないよう参照火力を挟む。 */
      var ref = U.clamp(run.stats.atk, expectedAtk() * 0.5, expectedAtk() * 1.15);
      hp = ref * WORD_DPS * (def.words || 10) * (scale || 1) * run.diff.hpMul;
    }
    e.maxHp = hp; e.hp = hp;
    e.atks = currentAttacks(e);
    for (var i = 0; i < e.atks.length; i++) e.atkT.push(U.rand(0.4, 1.2));
    run.enemies.push(e);
    if (isBoss) { run.boss = e; ST.Audio.play('boss'); }
    return e;
  }

  function currentAttacks(e) {
    if (!e.def.phases) return e.def.atk || [];
    var ratio = e.hp != null && e.maxHp ? e.hp / e.maxHp : 1;
    var ph = e.def.phases;
    for (var i = 0; i < ph.length; i++) {
      if (ratio > ph[i].hpAbove) { e.phaseIdx = i; return ph[i].atk; }
    }
    e.phaseIdx = ph.length - 1;
    return ph[ph.length - 1].atk;
  }

  /* ============================================================
     ウェーブ進行
     ============================================================ */
  function startWave() {
    var sector = run.sector;
    var isBossWave = !sector.endless && run.waveIdx >= sector.waves;
    if (isBossWave) {
      run.waveState = 'boss';
      run.waveStateT = 1.6;
      toast('WARNING', '#ff4d5e');
      ST.Audio.play('warn');
      return;
    }
    run.waveQueue = ST.Sectors.buildWave(sector, run.waveIdx, run.diff);
    run.waveTimer = 0;
    run.waveState = 'active';
  }

  /* エンドレス: ウェーブが進むごとに敵耐久・弾数・弾速と報酬を引き上げる。
     run.diff を毎回まっさらな複製で作り直す（プロトタイプ連鎖を伸ばさない） */
  function escalateEndless() {
    var r = run;
    if (!r.baseDiff) r.baseDiff = r.diff;
    var b = r.baseDiff, k = r.waveIdx;
    var d = {};
    for (var key in b) d[key] = b[key];
    d.hpMul = b.hpMul * (1 + k * 0.11);
    d.bulletCount = b.bulletCount * (1 + k * 0.035);
    d.bulletSpeed = b.bulletSpeed * (1 + k * 0.018);
    d.spawnMul = b.spawnMul * (1 + k * 0.03);
    d.exp = b.exp * (1 + k * 0.06);
    d.drop = b.drop * (1 + k * 0.04);
    d.score = b.score * (1 + k * 0.05);
    r.diff = d;
    G.diff = d;
  }

  function updateWave(dt) {
    var r = run;
    if (r.waveState === 'intro') {
      r.waveStateT -= dt;
      if (r.waveStateT <= 0) startWave();
      return;
    }
    if (r.waveState === 'boss') {
      r.waveStateT -= dt;
      if (r.waveStateT <= 0) {
        var b = spawnEnemy(r.sector.boss, W / 2, -80, true, r.sector.bossScale);
        toast(b.def.ja, '#ff4d5e');
        r.waveState = 'bossfight';
      }
      return;
    }
    if (r.waveState === 'bossfight') {
      if (r.boss && r.boss.dead) {
        r.waveState = 'clear';
        r.waveStateT = 1.8;
        toast('MISSION COMPLETE', '#59ff9e');
      }
      return;
    }
    if (r.waveState === 'clear') {
      r.waveStateT -= dt;
      if (r.waveStateT <= 0 && !r.finished) finish(true);
      return;
    }
    if (r.waveState === 'between') {
      r.waveStateT -= dt;
      if (r.waveStateT <= 0) startWave();
      return;
    }

    /* active */
    r.waveTimer += dt;
    while (r.waveQueue.length && r.waveQueue[0].delay <= r.waveTimer) {
      var sp = r.waveQueue.shift();
      spawnEnemy(sp.type, sp.x, sp.y);
    }
    if (!r.waveQueue.length && !r.enemies.length) {
      r.waveIdx++;
      if (r.sector.endless) {
        r.waveState = 'between'; r.waveStateT = 1.1;
        toast('WAVE ' + (r.waveIdx + 1), '#4df3ff');
        escalateEndless();
      } else if (r.waveIdx >= r.sector.waves) {
        r.waveState = 'between'; r.waveStateT = 1.5;
      } else {
        r.waveState = 'between'; r.waveStateT = 1.0;
        toast('WAVE ' + (r.waveIdx + 1), '#4df3ff');
      }
    }
  }

  /* ============================================================
     タイピング
     ============================================================ */
  function onKey(ev) {
    if (ev.repeat) return;
    var k = ev.key;

    if (k === 'Escape') {
      if (state === 'playing') { ev.preventDefault(); pause(); }
      else if (state === 'paused') { ev.preventDefault(); resume(); }
      return;
    }
    if (state !== 'playing') return;

    if (k === 'Tab') {
      ev.preventDefault();
      /* TAB = 攻撃/迎撃の切替、Shift+TAB = 目標を次へ。
         SPACE は英文のスペースを打つために打鍵側へ開放している。 */
      if (ev.shiftKey) skipTarget();
      else setMode(run.mode === 'attack' ? 'intercept' : 'attack');
      return;
    }
    if (k === 'Enter') {
      ev.preventDefault();
      tryOverdrive();
      return;
    }
    if (k === 'Spacebar') k = ' ';        /* 旧ブラウザ対策 */
    if (k.length !== 1) return;
    var ch = k.toLowerCase();
    if (!/[a-z0-9\-,.\/' ]/.test(ch)) return;
    ev.preventDefault();
    handleChar(ch);
  }

  function handleChar(ch) {
    var r = run;
    /* 語尾「ん」の余剰 n を吸収 */
    if (swallowNT > 0 && ch === 'n') { swallowNT = 0; return; }
    /* オーバーキル直後の入力吸収 */
    if (r.grace > 0) return;
    /* ミス硬直 */
    if (r.stun > 0) return;

    r.s.keys++;

    /* 打鍵の行き先はモードだけで決まる。頭文字の衝突で狙いが逸れることはない。 */
    if (r.mode === 'intercept') { interceptKey(ch); return; }

    var tgt = r.target;
    /* 敵がいない間の空打ちはミス扱いしない */
    if (!tgt || tgt.dead) return;
    /* onCorrect 内の撃破で r.target が入れ替わり得るので参照を確保しておく */
    var res = tgt.matcher.feed(ch);
    if (res === 'ok') { onCorrect(tgt); }
    else if (res === 'done') { onCorrect(tgt, true); onWordComplete(tgt); }
    else onMiss();
  }

  /* 迎撃モードの打鍵: 敵とは無関係のワードを打ち、迎撃エネルギーを充填する */
  function interceptKey(ch) {
    var r = run, st = r.stats;
    var m = r.ic.matcher;
    if (!m) { nextInterceptWord(); m = r.ic.matcher; }
    var res = m.feed(ch);
    if (res === 'miss') { onMiss(); return; }

    registerCorrect();
    addEnergy(st.energyCharge);
    ST.Audio.play(r.s.combo % 2 ? 'key' : 'key2');

    if (res === 'done') {
      /* 打ち切りボーナス。連続で打てるほど迎撃が途切れにくくなる */
      addEnergy(st.energyCharge * 2.2);
      r.s.words++;
      if (m.swallowN) swallowNT = 0.22;
      r.s.score += Math.round(30 * run.diff.score * (1 + st.scoreMul / 100));
      floaters.push({
        x: r.player.x, y: r.player.y - 46, vy: -40, t: 0.7,
        txt: '+' + Math.round(st.energyCharge * 3.2) + ' ENERGY', c: '#59ff9e', sz: 13
      });
      ST.Audio.play('ok');
      nextInterceptWord();
    }
  }

  function addEnergy(v) {
    run.energy = U.clamp(run.energy + v, 0, run.stats.energyMax);
  }

  /* コンボ・命中率・障壁・OD など、両モード共通の「正打」処理 */
  function registerCorrect() {
    var r = run, st = r.stats;
    r.s.correct++;
    r.s.combo++;
    if (r.s.combo > r.s.maxCombo) r.s.maxCombo = r.s.combo;
    if (!r.overload) {
      /* 容量に比例させると、容量を伸ばすほど回復も速くなる二重取りになる。
         1打鍵あたりの回復量は容量から切り離す。 */
      r.player.shield = Math.min(r.player.shieldMax,
        r.player.shield + 0.2 + st.shieldRegen * 0.009);
    }
    addOd(0.55 * (1 + st.odGain / 100));
    r.s.score += Math.round(6 * (1 + r.s.combo * 0.01) * run.diff.score * (1 + st.scoreMul / 100));
  }

  function onCorrect(e, isLast) {
    var r = run, st = r.stats;
    registerCorrect();

    /* ダメージ（1打鍵ぶんの削り。とどめは完撃ボーナスに残す） */
    var dmg = st.atk * 0.85 * (1 + Math.min(r.s.combo, 400) * 0.0035);
    if (st.uniques.precision) {
      r.precisionStack = Math.min(150, r.precisionStack + 1);
      dmg *= 1 + Math.floor(r.precisionStack / 10) * 0.04;
    }
    if (st.uniques.overload) {
      var lowRatio = 1 - r.player.hp / r.player.maxHp;
      dmg *= 1 + lowRatio * 0.6;
    }
    if (r.od.active > 0) dmg *= 2;
    var crit = Math.random() * 100 < st.crit;
    if (crit) dmg *= st.critMult / 100;

    damageEnemy(e, dmg, crit);
    tracers.push({ x1: r.player.x, y1: r.player.y - 14, x2: e.x, y2: e.y, t: 0.13, c: crit ? '#ffc24d' : '#4df3ff' });
    ST.Audio.play(r.s.combo % 2 ? 'key' : 'key2');
    if (r.s.combo % 6 === 0) ST.Audio.play('shot');

    /* 連撃回路 */
    if (st.uniques.chain) {
      r.chainCount++;
      if (r.chainCount >= 8) {
        r.chainCount = 0;
        damageEnemy(e, st.atk * 2.2, false);
        spawnParticles(e.x, e.y, 8, '#ffc24d', 220);
      }
    }
  }

  function onWordComplete(e) {
    var r = run, st = r.stats;
    r.s.words++;
    r.pressure = Math.max(0, r.pressure - (e.boss ? PRESSURE_BOSS : PRESSURE_WORD));
    if (e.matcher && e.matcher.swallowN) swallowNT = 0.22;

    var fin = st.atk * Math.max(3, e.matcher.total) * 0.7 * (1 + st.finisher / 100);
    if (r.od.active > 0) fin *= 2;
    /* 単語を打ち切ったら雑魚は必ず落ちる。ボスだけが複数単語を要求する。 */
    if (!e.boss) fin = Math.max(fin, e.hp);
    damageEnemy(e, fin, false, true);
    addOd(3.5 * (1 + st.odGain / 100));
    r.s.score += Math.round(45 * run.diff.score * (1 + st.scoreMul / 100));

    /* 残響共鳴: 周囲へ波及 */
    if (st.uniques.echo) {
      for (var i = 0; i < r.enemies.length; i++) {
        var o = r.enemies[i];
        if (o === e || o.dead) continue;
        if (U.dist(o.x, o.y, e.x, e.y) < 200) damageEnemy(o, fin * 0.3, false);
      }
    }

    if (!e.dead) {
      /* ボスは新しい単語を割り当てて継続 */
      assignWord(e);
      ST.Audio.play('ok');
    } else {
      refreshTarget();          /* 撃破されたので自動的に次の敵へ */
    }
  }

  function onMiss() {
    var r = run, st = r.stats;
    r.s.miss++;
    r.s.combo = Math.floor(r.s.combo * (st.comboKeep / 100));
    r.precisionStack = 0;
    r.chainCount = 0;
    r.stun = MISS_STUN * run.diff.graceMul * (1 - st.grace / 100);
    r.stunMax = r.stun;
    ST.Audio.play('miss');
    flash.t = 0.14; flash.c = '#ff4d5e'; flash.a = 0.16;
    /* 高難易度ではミスで迎撃エネルギーも削られる（ロック解除の代替ペナルティ）。
       硬直と同じ graceMul で効かせるので、難易度が上がるほど1回のミスが重い。 */
    if (run.diff.lockDrop) addEnergy(-st.interceptCost * MISS_ENERGY * run.diff.graceMul);
  }

  /* ============================================================
     ダメージ / 撃破
     ============================================================ */
  function damageEnemy(e, dmg, crit, isFinisher) {
    if (e.dead) return;
    e.hp -= dmg;
    e.hitFlash = 0.12;
    run.s.damage += dmg;
    floaters.push({
      x: e.x + U.rand(-14, 14), y: e.y - 10, vy: -46,
      t: crit ? 0.85 : 0.55, txt: Math.round(dmg),
      c: crit ? '#ffc24d' : (isFinisher ? '#ff4dd2' : '#cfe6ff'),
      sz: crit ? 20 : (isFinisher ? 19 : 13)
    });
    if (crit) spawnParticles(e.x, e.y, 5, '#ffc24d', 180);
    if (e.hp <= 0) killEnemy(e);
    else if (e.def.phases) {
      var before = e.phaseIdx;
      e.atks = currentAttacks(e);
      if (e.phaseIdx !== before) {
        clearBulletsNear(e.x, e.y, 2000, true);
        toast('PHASE ' + (e.phaseIdx + 1), '#ffc24d');
        ST.Audio.play('warn');
        shakeIt(0.35, 10);
        for (var i = 0; i < e.atks.length; i++) e.atkT[i] = U.rand(0.5, 1.0);
      }
    }
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    var r = run, st = r.stats;
    r.s.kills++;

    var isBoss = e.boss;
    r.pressure = Math.max(0, r.pressure - (isBoss ? 0.35 : PRESSURE_KILL));
    spawnParticles(e.x, e.y, isBoss ? 90 : 22, e.color, isBoss ? 460 : 260);
    ST.Audio.play(isBoss ? 'bigkill' : 'kill');
    shakeIt(isBoss ? 0.7 : 0.14, isBoss ? 22 : 5);
    if (isBoss) { flash.t = 0.5; flash.c = '#fff'; flash.a = 0.5; clearBulletsNear(e.x, e.y, 3000, true); }

    var sc = Math.round((isBoss ? 4000 : 100) * (1 + r.s.combo * 0.012) * run.diff.score * (1 + st.scoreMul / 100));
    r.s.score += sc;
    floaters.push({ x: e.x, y: e.y - 24, vy: -34, t: 1.0, txt: '+' + U.fmt(sc), c: '#59ff9e', sz: 15 });

    addOd((isBoss ? 40 : 4) * (1 + st.odGain / 100));
    if (st.uniques.harvest && Math.random() < 0.3) addOd(12);
    if (st.uniques.vampire) healPlayer(r.player.maxHp * 0.015);

    /* 経験値 */
    var exp = (e.def.exp || 10) * run.diff.exp * (1 + st.expGain / 100);
    r.expPending = (r.expPending || 0) + exp;

    /* ドロップ */
    var chance = (isBoss ? 1.0 : 0.055) * run.diff.drop * (1 + st.dropRate / 100);
    var rolls = isBoss ? 3 : 1;
    for (var i = 0; i < rolls; i++) {
      if (Math.random() < chance) {
        var ilvl = run.sector.ilvl + U.randInt(-2, 3) + (isBoss ? 4 : 0);
        var item = ST.Items.generate(Math.max(1, ilvl), {
          luck: run.diff.drop * 0.35,
          floorTier: isBoss ? (run.sector.num >= 6 ? 2 : 1) : null
        });
        r.loot.push(item);
        floaters.push({ x: e.x, y: e.y, vy: -50, t: 1.4, txt: '◆ ' + item.name, c: rarColor(item.rarity), sz: 13 });
        ST.Audio.play('loot');
      }
    }
    if (r.target === e) {
      /* 単語を打ち切る前に落とした場合だけ、余った打鍵をミス扱いしない猶予を置く。
         打ち切って倒したときは即座に次の敵へ移れるよう猶予を入れない。 */
      if (!(e.matcher && e.matcher.done)) r.grace = 0.4;
      refreshTarget();
    }
  }

  function rarColor(id) {
    return { common: '#9fb4c9', uncommon: '#5ce08a', rare: '#4da6ff', epic: '#c078ff', legendary: '#ffa93d', mythic: '#ff5470' }[id] || '#fff';
  }

  function healPlayer(v) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + v);
  }

  /* flat: 難易度の被害倍率を掛けない（レーザーは頻度側で難易度差を付けている） */
  function hurtPlayer(raw, flat) {
    var r = run, p = r.player, st = r.stats;
    /* 無敵時間は設けない。弾幕を防ぐ手段は迎撃だけ。 */
    var dmg = raw * (flat ? 1 : run.diff.dmgTaken);
    var def = st.def + (st.uniques.aegis && p.shield >= p.shieldMax - 0.5 ? 20 : 0);
    dmg *= (1 - Math.min(60, def) / 100);
    if (r.overload) dmg *= 1.5;          /* 迎撃系がダウンしている間は被害増 */

    if (p.shield > 0) {
      var absorb = Math.min(p.shield, dmg);
      p.shield -= absorb; dmg -= absorb;
    }
    p.hp -= dmg;
    p.inv = 0.22;                        /* 点滅のための視覚用タイマー（無敵ではない） */
    r.s.hits++;
    r.s.combo = 0;
    r.precisionStack = 0;
    ST.Audio.play('hurt');
    shakeIt(0.4, 16);
    flash.t = 0.28; flash.c = '#ff2d55'; flash.a = 0.36;
    spawnParticles(p.x, p.y, 26, '#ff4d5e', 300);

    if (st.uniques.phase && p.phaseCd <= 0) {
      p.phaseCd = 6;
      clearBulletsNear(p.x, p.y, 180, true);
      toast('ZERO BUFFER', '#4df3ff');
    }
    if (p.hp <= 0) { p.hp = 0; finish(false); }
  }

  /* ============================================================
     迎撃
     ============================================================ */
  /* free: エネルギーを消費しない（OD中など） */
  function doIntercept(b, free) {
    var r = run, st = r.stats;
    if (!free) {
      if (r.energy < st.interceptCost) return false;
      /* 無償迎撃が発動すればエネルギーを消費しない */
      if (Math.random() * 100 >= st.freeIntercept) r.energy -= st.interceptCost;
    }
    var bx = b.x, by = b.y;
    killBullet(b);
    r.s.intercepts++;
    var blast = st.interceptBlast * (st.uniques.nova ? 2 : 1);
    /* 爆風の巻き添えは無償。爆風強化が効率に直結する */
    var n = clearBulletsNear(bx, by, blast, false);
    spawnParticles(bx, by, 6 + n * 2, '#59ff9e', 230);
    /* 攻撃と同じく、自機から迎撃線を引いて爆風の広がりを見せる */
    var col = free ? '#ff4dd2' : '#59ff9e';
    tracers.push({ x1: r.player.x, y1: r.player.y - 14, x2: bx, y2: by, t: 0.12, c: col });
    rings.push({ x: bx, y: by, r0: blast * 0.25, r1: blast, t: 0.26, life: 0.26, c: col });
    ST.Audio.play('intercept');
    /* 迎撃ではODゲージは溜まらない。ODは攻撃で稼ぐ資源。 */
    r.s.score += Math.round((8 + n * 6) * run.diff.score * (1 + st.scoreMul / 100));
    r.player.shield = Math.min(r.player.shieldMax, r.player.shield + 0.6 + n * 0.4);
    if (n > 1) floaters.push({ x: bx, y: by, vy: -40, t: 0.6, txt: 'x' + (n + 1), c: '#4df3ff', sz: 13 });
    return true;
  }

  function clearBulletsNear(x, y, rad, silent) {
    var n = 0, r2 = rad * rad;
    for (var i = 0; i < BULLET_MAX; i++) {
      var b = bullets[i];
      if (!b.alive) continue;
      if (U.dist2(b.x, b.y, x, y) <= r2) {
        spawnParticles(b.x, b.y, 2, b.color, 120);
        killBullet(b); n++;
      }
    }
    return n;
  }

  /* ============================================================
     迎撃不可レーザー
     予告線を出したあと一瞬で着弾する。弾ではないため撃ち落とせず、
     対処法は「圧力を下げる = 敵を早く倒す」ことだけ。
     ============================================================ */
  /* 次のレーザーまでの間隔。圧力が高いほど短くなる。
     敵1体ごとの抽選にすると敵数と連射速度で発生量が乱高下するため、
     戦域全体でひとつのタイマーとして管理する。 */
  function laserInterval() {
    /* 圧力の2乗で効かせる。中盤は散発的だが、満タン付近では
       毎秒級の連射になり立て直しが効かなくなる。 */
    var pr = run.pressure;
    return LASER_BASE / (0.25 + pr * pr * LASER_CURVE * (run.diff.laser || 0.75));
  }

  /* 画面内にいる敵から1体選んでレーザーを撃たせる */
  function tickLaser(dt) {
    var r = run;
    r.laserT -= dt;
    if (r.laserT > 0) return;
    r.laserT = laserInterval();
    var cands = [];
    for (var i = 0; i < r.enemies.length; i++) {
      var e = r.enemies[i];
      if (!e.dead && e.spawnT <= 0 && e.y > 0 && e.y < H - 120) cands.push(e);
    }
    if (cands.length) fireLaser(U.choice(cands));
  }

  function fireLaser(e) {
    var p = run.player;
    run.lasers.push({
      e: e, x: e.x, y: e.y,
      ang: U.angleTo(e.x, e.y, p.x, p.y),
      t: LASER_CHARGE, fired: false, fade: 0,
      color: e.color || '#ff4d5e'
    });
    ST.Audio.play('charge');
  }

  function updateLasers(dt) {
    var r = run, p = r.player;
    for (var i = r.lasers.length - 1; i >= 0; i--) {
      var L = r.lasers[i];
      if (L.e && !L.e.dead) { L.x = L.e.x; L.y = L.e.y; }
      if (!L.fired) {
        /* 予告中は自機を追尾し続ける。避ける手段はなく、
           対処は圧力を下げること = 敵を早く倒すことだけ。 */
        L.ang = U.angleTo(L.x, L.y, p.x, p.y);
        L.t -= dt;
        if (L.t <= 0) {
          L.fired = true; L.fade = 0.22;
          ST.Audio.play('laser');
          shakeIt(0.26, 9);
          /* 圧力が高いほど1発が重い。100%では基礎の3倍を超える。 */
          hurtPlayer(LASER_DMG * (1 + r.pressure * LASER_RAMP), true);
          spawnParticles(p.x, p.y, 18, L.color, 280);
        }
      } else {
        L.fade -= dt;
        if (L.fade <= 0) r.lasers.splice(i, 1);
      }
    }
  }

  function drawLasers() {
    var r = run;
    for (var i = 0; i < r.lasers.length; i++) {
      var L = r.lasers[i];
      var ex = L.x + Math.cos(L.ang) * 1400, ey = L.y + Math.sin(L.ang) * 1400;
      if (!L.fired) {
        /* 予告線: 細く点滅し、発射直前に太くなる */
        var k = 1 - L.t / LASER_CHARGE;
        ctx.globalAlpha = 0.25 + k * 0.5;
        ctx.strokeStyle = L.color;
        ctx.lineWidth = 1 + k * 3;
        ctx.setLineDash([12, 9]);
        ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.5 + k * 0.5;
        ctx.beginPath(); ctx.arc(L.x, L.y, 6 + k * 12, 0, U.TAU);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      } else {
        var a = L.fade / 0.22;
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = L.color;
        ctx.lineWidth = LASER_WIDTH * 2.4 * a;
        ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = LASER_WIDTH * 0.7 * a;
        ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(ex, ey); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* 迎撃射程は固定。射程を伸ばすと「当たらない弾まで撃ってエネルギーを浪費する」
     という逆転が起きるため、装備では強化しない。 */
  var INTERCEPT_RANGE = 210;
  var IC_DELAY = 0.32;         /* 迎撃の発射間隔(秒)。約3発/秒が上限で、密集弾は撃ち切れない */
  var OVERLOAD_RECOVER = 0.35; /* 枯渇からの復帰に必要なエネルギー割合 */
  var OD_COST_BASE = 100;      /* 宙域1 / 難易度係数1.0 でのOD必要量 */
  var OD_COST_SECTOR = 0.18;   /* 宙域が1つ進むごとの増加率 */
  var PRESSURE_TIME = 40;      /* 無為に過ごすと圧力が満ちるまでの秒数 */
  var PRESSURE_KILL = 0.12;    /* 撃破1体で下がる圧力。撃破し続ければ押し返せる */
  var PRESSURE_WORD = 0.012;   /* 攻撃モードで1単語打ち切るごとに下がる圧力 */
  var PRESSURE_BOSS = 0.05;    /* ボス戦は撃破が発生しないので、完撃で大きめに戻す */
  var LASER_CHARGE = 0.7;      /* 照射までの予告時間 */
  var LASER_WIDTH = 15;        /* 描画上の太さ（必中なので判定には使わない） */
  var LASER_BASE = 5;          /* 発射間隔の分子 */
  var LASER_CURVE = 3.2;       /* 圧力の効き。2乗で効かせるので高圧力が一気に牙を剥く */
  var LASER_DMG = 24;          /* 基礎威力（難易度の被害倍率は掛けない） */
  var LASER_RAMP = 2.2;        /* 圧力による威力倍率の上限係数 */
  var INTERCEPT_MARGIN = 26;   /* この距離以内を通過する弾だけを脅威とみなす */
  var MISS_STUN = 0.26;        /* ミス硬直の基準秒。難易度の graceMul 倍で効く */
  var MISS_ENERGY = 1.5;       /* ミスで失う迎撃エネルギー(迎撃1発分の倍数)。graceMul 倍で効く */

  function interceptRange() { return INTERCEPT_RANGE; }

  /* 「自機の方を向いている」ではなく「実際に自機の至近を通過する」弾だけを迎撃する。
     最接近距離を予測することで、当たらない弾にエネルギーを使わずに済む。 */
  function isInterceptable(b) {
    var p = run.player;
    var dx = p.x - b.x, dy = p.y - b.y;
    if (dx * dx + dy * dy > INTERCEPT_RANGE * INTERCEPT_RANGE) return false;
    var v2 = b.vx * b.vx + b.vy * b.vy;
    if (v2 < 1) return false;
    var t = (dx * b.vx + dy * b.vy) / v2;      /* 最接近までの時間 */
    if (t <= 0) return false;                  /* すでに遠ざかっている */
    var cx = b.x + b.vx * t - p.x;
    var cy = b.y + b.vy * t - p.y;
    var m = INTERCEPT_MARGIN + b.r + p.hitR;
    return (cx * cx + cy * cy) <= m * m;
  }

  /* ============================================================
     オーバードライブ
     ============================================================ */
  /* OD の必要量は宙域と難易度で決まる。ミッション中は一定なので、
     「この面では何回撃てるか」を最初から見積もれる。
     エンドレスは宙域番号を持たないので odSector を代わりに使う。 */
  function odCost() {
    var s = run.sector;
    var n = s.odSector || s.num;
    return Math.round(OD_COST_BASE * (1 + (n - 1) * OD_COST_SECTOR) * (run.diff.odCost || 1));
  }
  function addOd(v) {
    run.od.gauge = Math.min(odCost(), run.od.gauge + v);
  }

  function tryOverdrive() {
    var r = run, st = r.stats;
    if (r.od.active > 0) return;
    if (r.od.gauge < odCost()) { ST.Audio.play('deny'); return; }
    r.od.gauge = 0;
    r.od.active = 6 * (1 + st.odDuration / 100);

    /* 発動時に戦況を一度リセットする切り札 */
    var cleared = clearBulletsNear(W / 2, H / 2, 4000, true);   /* 画面上の敵弾を全消去 */
    for (var i = r.lasers.length - 1; i >= 0; i--) {            /* 予告中のレーザーも消す */
      if (!r.lasers[i].fired) r.lasers.splice(i, 1);
    }
    r.pressure = r.pressure / 2;                                /* 戦域圧力を半減 */
    r.energy = st.energyMax;                                    /* 迎撃エネルギー全快 */
    r.overload = false;
    r.player.shield = r.player.shieldMax;                       /* 障壁全快 */

    ST.Audio.play('overdrive');
    toast('OVERDRIVE', '#ff4dd2');
    shakeIt(0.6, 18);
    flash.t = 0.5; flash.c = '#ff4dd2'; flash.a = 0.45;
    spawnParticles(r.player.x, r.player.y, 60, '#ff4dd2', 420);
    rings.push({ x: r.player.x, y: r.player.y, r0: 40, r1: 900, t: 0.5, life: 0.5, c: '#ff4dd2' });
    if (cleared > 0) {
      floaters.push({
        x: r.player.x, y: r.player.y - 60, vy: -40, t: 1.1,
        txt: '弾幕消滅 x' + cleared, c: '#ff4dd2', sz: 16
      });
    }
  }

  /* ============================================================
     エフェクト
     ============================================================ */
  function spawnParticles(x, y, n, color, spd) {
    if (ST.Save.d.settings.particles === 0) n = Math.ceil(n * 0.3);
    for (var i = 0; i < n; i++) {
      var p = newParticle();
      if (!p) return;
      var a = Math.random() * U.TAU, s = U.rand(spd * 0.25, spd);
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = U.rand(0.25, 0.7); p.age = 0;
      p.c = color; p.r = U.rand(1.2, 3.4);
    }
  }
  function shakeIt(t, m) {
    if (!ST.Save.d.settings.shake) return;
    if (t > shake.t) { shake.t = t; shake.m = m; }
  }
  var toastEl, toastTimer = null;
  function toast(txt, color) {
    if (!toastEl) toastEl = document.getElementById('centerToast');
    toastEl.textContent = txt;
    toastEl.style.color = color || '#4df3ff';
    toastEl.style.textShadow = '0 0 30px ' + (color || '#4df3ff');
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
  }

  /* ============================================================
     更新
     ============================================================ */
  function update(dt) {
    var r = run, p = r.player, st = r.stats;
    r.s.elapsed += dt;

    if (r.grace > 0) r.grace -= dt;
    if (r.stun > 0) r.stun -= dt;
    if (r.icCd > 0) r.icCd -= dt;

    /* エネルギーが尽きると迎撃系がダウンする。
       一定量まで充填し直すまで復帰せず、その間は被害が増える。 */
    if (!r.overload && r.energy < st.interceptCost) {
      r.overload = true;
      toast('SYSTEM OVERLOAD', '#ff4d5e');
      ST.Audio.play('warn');
      shakeIt(0.4, 12);
      flash.t = 0.3; flash.c = '#ff4d5e'; flash.a = 0.28;
    } else if (r.overload && r.energy >= st.energyMax * OVERLOAD_RECOVER) {
      r.overload = false;
      toast('SYSTEM ONLINE', '#59ff9e');
      ST.Audio.play('ok');
    }
    if (swallowNT > 0) swallowNT -= dt;
    if (p.inv > 0) p.inv -= dt;
    if (p.phaseCd > 0) p.phaseCd -= dt;
    if (shake.t > 0) { shake.t -= dt; if (shake.t <= 0) shake.m = 0; }
    if (flash.t > 0) flash.t -= dt;

    /* 戦域圧力。撃破が止まると上がり続ける。 */
    var prBefore = r.pressure;
    r.pressure = U.clamp(r.pressure + dt / PRESSURE_TIME, 0, 1);
    /* 致死域に入ったことを一度だけ知らせる（レーザーが連射域に入る） */
    if (prBefore < 0.85 && r.pressure >= 0.85) {
      toast('CRITICAL PRESSURE', '#ff4d5e');
      ST.Audio.play('warn');
    }
    tickLaser(dt);
    updateLasers(dt);

    /* OD */
    if (r.od.active > 0) {
      r.od.active -= dt;
      if (r.od.active <= 0) { r.od.active = 0; toast('OD END', '#6f8bab'); }
    }
    r.od.ready = r.od.gauge >= odCost();

    /* HP自己修復 */
    if (st.hpRegen > 0) healPlayer(st.hpRegen * dt);

    /* 自機位置: ロック対象へ緩やかに寄る */
    var targetX = W / 2;
    if (r.target && !r.target.dead) targetX = U.lerp(W / 2, r.target.x, 0.45);
    p.tx = U.clamp(targetX, 90, W - 90);
    p.x += (p.tx - p.x) * Math.min(1, dt * 2.6);

    updateWave(dt);
    updateEnemies(dt);
    if (!r.target || r.target.dead) refreshTarget();
    updateBullets(dt);
    updateParticles(dt);
    updateFloaters(dt);
  }

  function updateEnemies(dt) {
    var r = run;
    var slow = r.od.active > 0 ? 0.55 : 1;
    for (var i = r.enemies.length - 1; i >= 0; i--) {
      var e = r.enemies[i];
      if (e.dead) { r.enemies.splice(i, 1); if (r.target === e) refreshTarget(); continue; }
      if (e.spawnT > 0) { e.spawnT -= dt; }
      e.t += dt * slow;
      if (e.hitFlash > 0) e.hitFlash -= dt;

      var mv = ST.Moves[e.def.move] || ST.Moves.dive;
      mv(e, dt * slow);

      /* 発射 */
      if (e.spawnT <= 0 && e.y > -20) {
        for (var a = 0; a < e.atks.length; a++) {
          e.atkT[a] -= dt * slow;
          if (e.atkT[a] <= 0) {
            var def = e.atks[a];
            e.atkT[a] = def.every;
            var fn = ST.Patterns.fns[def.p];
            if (fn) { e.fireCount++; fn(G, e, def); }
          }
        }
      }

      /* 画面外 */
      if (e.y > H + 60) {
        if (!e.boss) {
          hurtPlayer(9);
          e.dead = true;
          if (r.target === e) refreshTarget();
        }
      }
    }
  }

  function updateBullets(dt) {
    var r = run, p = r.player;
    var slowMul = 1;
    if (r.od.active > 0) slowMul = r.stats.uniques.timeflux ? 0.3 : 0.5;
    var pr = p.hitR;
    var threatN = 0;            /* 射程内に迫っている弾の数 = 脅威度 */

    for (var i = 0; i < BULLET_MAX; i++) {
      var b = bullets[i];
      if (!b.alive) continue;
      var d = dt * slowMul;
      b.age += dt;
      if (b.age > b.life) { killBullet(b); continue; }

      if (b.accel) {
        var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) + b.accel * d;
        var an = Math.atan2(b.vy, b.vx);
        b.vx = Math.cos(an) * sp; b.vy = Math.sin(an) * sp;
      }
      if (b.homing) {
        var want = U.angleTo(b.x, b.y, p.x, p.y);
        var cur = Math.atan2(b.vy, b.vx);
        var diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
        var turn = U.clamp(diff, -b.homing * d, b.homing * d);
        var spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        cur += turn;
        b.vx = Math.cos(cur) * spd; b.vy = Math.sin(cur) * spd;
        b.homing = Math.max(0, b.homing - d * 0.12);
      }
      b.x += b.vx * d;
      b.y += b.vy * d;
      b.ang = Math.atan2(b.vy, b.vx);

      /* 分裂 */
      if (b.split) {
        b.splitT -= d;
        if (b.splitT <= 0) {
          var n = Math.max(3, Math.round(b.split * run.diff.bulletCount));
          for (var k = 0; k < n; k++) {
            var nb = newBullet();
            if (!nb) break;
            var a2 = U.TAU * k / n + Math.random() * 0.3;
            var s2 = 110 * run.diff.bulletSpeed * (1 - run.stats.bulletSlow / 100);
            nb.x = b.x; nb.y = b.y;
            nb.vx = Math.cos(a2) * s2; nb.vy = Math.sin(a2) * s2;
            nb.r = 5; nb.color = b.color; nb.kind = 'orb'; nb.ang = a2;
            nb.accel = 0; nb.homing = 0; nb.life = 9; nb.age = 0; nb.split = 0;
            nb.dmg = 1;
          }
          spawnParticles(b.x, b.y, 8, b.color, 160);
          killBullet(b); continue;
        }
      }

      /* 画面外 */
      if (b.x < -40 || b.x > W + 40 || b.y < -60 || b.y > H + 40) { killBullet(b); continue; }

      /* 当たり判定 */
      var rr = b.r * 0.62 + pr;
      if (U.dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        killBullet(b); hurtPlayer(b.dmg * 9); continue;
      }

      /* 自動迎撃。モードに関係なく、エネルギーが残っている限り撃ち落とす。
         OD中は自機周辺を無償で薙ぎ払う。 */
      if (isInterceptable(b)) {
        threatN++;
        if (r.od.active > 0 && U.dist2(b.x, b.y, p.x, p.y) < 150 * 150) {
          doIntercept(b, true); continue;
        }
        /* 発射間隔があるため、一度に押し寄せる弾は撃ち切れない。
           取りこぼしを減らせるのは爆風だけ。 */
        if (!r.overload && r.icCd <= 0 && r.energy >= r.stats.interceptCost) {
          if (doIntercept(b, false)) { r.icCd = IC_DELAY; continue; }
        }
      }
    }
    r.threat = threatN;
  }

  function updateParticles(dt) {
    for (var i = 0; i < PARTICLE_MAX; i++) {
      var p = particles[i];
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.94; p.vy = p.vy * 0.94 + 40 * dt;
    }
  }

  function updateFloaters(dt) {
    for (var i = floaters.length - 1; i >= 0; i--) {
      var f = floaters[i];
      f.t -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.93;
      if (f.t <= 0) floaters.splice(i, 1);
    }
    for (var j = tracers.length - 1; j >= 0; j--) {
      tracers[j].t -= dt;
      if (tracers[j].t <= 0) tracers.splice(j, 1);
    }
    for (var k = rings.length - 1; k >= 0; k--) {
      rings[k].t -= dt;
      if (rings[k].t <= 0) rings.splice(k, 1);
    }
  }

  /* ============================================================
     描画
     ============================================================ */
  function render() {
    var r = run;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    /* 背景 */
    var hue = r ? r.sector.hue : [200, 240];
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'hsl(' + hue[0] + ',60%,9%)');
    g.addColorStop(0.55, '#04060f');
    g.addColorStop(1, 'hsl(' + hue[1] + ',50%,6%)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    /* シェイク */
    if (shake.t > 0) {
      var m = shake.m * (shake.t / 0.5);
      ctx.translate(U.rand(-m, m), U.rand(-m, m));
    }

    drawStars();
    if (!r) { ctx.setTransform(1, 0, 0, 1, 0, 0); return; }

    drawGrid();
    drawTracers();
    drawEnemies();
    drawBullets();
    drawLasers();
    drawRings();
    drawPlayer();
    drawParticles();
    drawFloaters();
    drawOverlay();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawStars() {
    var dt = frameDt;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.y += s.v * dt * (run && run.od.active > 0 ? 2.4 : 1);
      if (s.y > H) { s.y = -2; s.x = Math.random() * W; }
      ctx.globalAlpha = s.a;
      ctx.fillStyle = s.z === 2 ? '#bfe8ff' : '#8fb8d8';
      ctx.fillRect(s.x, s.y, s.s, s.s * (s.z === 2 ? 2.2 : 1));
    }
    ctx.globalAlpha = 1;
  }

  function drawGrid() {
    var t = run.s.elapsed;
    ctx.strokeStyle = 'rgba(77,243,255,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    var off = (t * 30) % 60;
    for (var y = -60; y <= H; y += 60) { ctx.moveTo(0, y + off); ctx.lineTo(W, y + off); }
    ctx.stroke();
  }

  function drawTracers() {
    for (var i = 0; i < tracers.length; i++) {
      var t = tracers[i];
      var a = t.t / 0.13;
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = t.c;
      ctx.lineWidth = 1 + a * 3;
      ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
      ctx.globalAlpha = a * 0.35;
      ctx.lineWidth = 1 + a * 9;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  var SHAPES = {
    tri: [[0, -1], [0.86, 0.6], [-0.86, 0.6]],
    diamond: [[0, -1], [0.8, 0], [0, 1], [-0.8, 0]],
    square: [[-0.75, -0.75], [0.75, -0.75], [0.75, 0.75], [-0.75, 0.75]],
    hex: [[0, -1], [0.87, -0.5], [0.87, 0.5], [0, 1], [-0.87, 0.5], [-0.87, -0.5]],
    lance: [[0, -1.3], [0.5, 0.3], [0, 0.9], [-0.5, 0.3]],
    cross: [[-0.32, -1], [0.32, -1], [0.32, -0.32], [1, -0.32], [1, 0.32], [0.32, 0.32],
      [0.32, 1], [-0.32, 1], [-0.32, 0.32], [-1, 0.32], [-1, -0.32], [-0.32, -0.32]]
  };

  function polyPath(pts, x, y, r, rot) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var px = pts[i][0], py = pts[i][1];
      var cx = px * Math.cos(rot) - py * Math.sin(rot);
      var cy = px * Math.sin(rot) + py * Math.cos(rot);
      if (i === 0) ctx.moveTo(x + cx * r, y + cy * r);
      else ctx.lineTo(x + cx * r, y + cy * r);
    }
    ctx.closePath();
  }

  function drawEnemyShape(e) {
    var r = e.r, x = e.x, y = e.y;
    var rot = e.def.move === 'dive' ? 0 : e.t * 0.6;
    var col = e.hitFlash > 0 ? '#ffffff' : e.color;

    if (e.shape === 'star' || e.shape === 'ring' || e.shape.indexOf('boss') === 0) {
      var spikes = e.shape === 'boss3' ? 10 : (e.shape === 'boss2' ? 8 : (e.shape === 'boss1' ? 6 : 5));
      var inner = e.shape === 'ring' ? 0.72 : 0.45;
      ctx.beginPath();
      for (var i = 0; i < spikes * 2; i++) {
        var rad = (i % 2 === 0) ? r : r * inner;
        var a = rot + Math.PI * i / spikes - Math.PI / 2;
        var px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      polyPath(SHAPES[e.shape] || SHAPES.tri, x, y, r, rot);
    }
    ctx.fillStyle = rgba(col, e.hitFlash > 0 ? 0.9 : 0.22);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = e.boss ? 3 : 2;
    ctx.stroke();

    /* 内核 */
    ctx.beginPath(); ctx.arc(x, y, r * 0.26, 0, U.TAU);
    ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
  }

  function drawEnemies() {
    var r = run;
    var lang = ST.Save.d.settings;
    /* 攻撃順を番号で示す。1番が現在の目標。 */
    var order = orderedEnemies();
    for (var q = 0; q < order.length; q++) order[q].rank = q + 1;
    for (var i = 0; i < r.enemies.length; i++) {
      var e = r.enemies[i];
      if (e.y < -60) continue;
      var spawnA = e.spawnT > 0 ? (1 - e.spawnT / 0.45) : 1;
      ctx.globalAlpha = spawnA;

      /* テレポート残光 */
      if (e.tpFlash > 0) {
        ctx.globalAlpha = spawnA * (e.tpFlash / 0.35);
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 2.4, 0, U.TAU);
        ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.stroke();
        ctx.globalAlpha = spawnA;
      }

      /* 目標枠 */
      if (r.target === e) {
        var pulse = 1 + Math.sin(r.s.elapsed * 9) * 0.06;
        ctx.strokeStyle = '#4df3ff'; ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.85 * pulse, 0, U.TAU); ctx.stroke();
        ctx.setLineDash([]);
        /* 進捗リング */
        ctx.strokeStyle = '#ffc24d'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 1.85 * pulse, -Math.PI / 2, -Math.PI / 2 + U.TAU * e.matcher.progress());
        ctx.stroke();
      }

      drawEnemyShape(e);

      /* HPバー（雑魚は削れたときだけ） */
      if (!e.boss && e.hp < e.maxHp) {
        var bw = e.r * 2.2;
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(e.x - bw / 2, e.y + e.r + 6, bw, 3);
        ctx.fillStyle = '#ff4d5e';
        ctx.fillRect(e.x - bw / 2, e.y + e.r + 6, bw * Math.max(0, e.hp / e.maxHp), 3);
      }

      /* 順番バッジ */
      if (!e.boss && e.spawnT <= 0) drawOrderBadge(e);

      /* 単語は目標のみ大きく、次の1体だけ小さく予告する */
      if (r.target === e) drawEnemyWord(e, true, lang);
      else if (e.rank === 2) drawEnemyWord(e, false, lang);
      ctx.globalAlpha = 1;
    }
  }

  function drawOrderBadge(e) {
    var isTarget = run.target === e;
    var n = e.rank || 0;
    if (!n) return;
    var bx = e.x - e.r - 10, by = e.y - e.r - 2;
    ctx.beginPath(); ctx.arc(bx, by, 9, 0, U.TAU);
    ctx.fillStyle = isTarget ? 'rgba(255,194,77,.92)' : 'rgba(2,6,16,.8)';
    ctx.fill();
    ctx.strokeStyle = isTarget ? '#ffc24d' : 'rgba(111,139,171,.6)';
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = '700 11px "Consolas",monospace';
    ctx.fillStyle = isTarget ? '#02030a' : '#8fb8d8';
    ctx.fillText(n > 9 ? '+' : String(n), bx, by + 4);
    ctx.textAlign = 'left';
  }

  function drawEnemyWord(e, isLocked, cfg) {
    var m = e.matcher;
    var kp = m.kanaParts();
    var y = e.y - e.r - 16;
    var big = isLocked ? 20 : 16;

    ctx.textAlign = 'center';
    ctx.font = '600 ' + big + 'px "Consolas","MS Gothic",monospace';
    var full = kp[0] + kp[1];
    var wpx = ctx.measureText(full).width;

    /* 背景板 */
    ctx.fillStyle = 'rgba(2,6,16,.72)';
    ctx.fillRect(e.x - wpx / 2 - 7, y - big + 2, wpx + 14, big + 6);
    if (isLocked) {
      ctx.strokeStyle = 'rgba(77,243,255,.6)'; ctx.lineWidth = 1;
      ctx.strokeRect(e.x - wpx / 2 - 7, y - big + 2, wpx + 14, big + 6);
    }

    /* 打鍵済み / 未打鍵 */
    var doneW = ctx.measureText(kp[0]).width;
    var startX = e.x - wpx / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = isLocked ? '#1b7f8c' : 'rgba(111,139,171,.55)';
    ctx.fillText(kp[0], startX, y);
    ctx.fillStyle = isLocked ? '#ffffff' : '#cfe6ff';
    ctx.fillText(kp[1], startX + doneW, y);

    /* ローマ字補助（日本語のときのみ） */
    if (cfg.showRomaji && e.word.kana) {
      var parts = m.parts();
      ctx.font = '13px "Consolas",monospace';
      var rf = parts[0] + parts[1] + parts[2];
      var rw = ctx.measureText(rf).width;
      var rx = e.x - rw / 2;
      var ry = y + 15;
      ctx.fillStyle = 'rgba(27,127,140,.9)';
      ctx.fillText(parts[0], rx, ry);
      var w0 = ctx.measureText(parts[0]).width;
      ctx.fillStyle = isLocked ? '#ffc24d' : '#8fb8d8';
      ctx.fillText(parts[1], rx + w0, ry);
      var w1 = ctx.measureText(parts[1]).width;
      ctx.fillStyle = 'rgba(111,139,171,.75)';
      ctx.fillText(parts[2], rx + w0 + w1, ry);
    }
    ctx.textAlign = 'left';
  }

  function drawBullets() {
    var r = run;
    for (var i = 0; i < BULLET_MAX; i++) {
      var b = bullets[i];
      if (!b.alive) continue;
      if (b.kind === 'shard') {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.ang);
        ctx.fillStyle = rgba(b.color, 0.35);
        ctx.fillRect(-b.r * 4, -b.r * 0.9, b.r * 8, b.r * 1.8);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-b.r * 2.6, -b.r * 0.34, b.r * 5.2, b.r * 0.68);
        ctx.restore();
      } else {
        var sp = bulletSprite(b.color, b.r);
        ctx.drawImage(sp.c, b.x - sp.pad, b.y - sp.pad);
      }
    }
  }

  function drawPlayer() {
    var r = run, p = r.player;
    var blink = p.inv > 0 && Math.floor(p.inv * 18) % 2 === 0;
    ctx.globalAlpha = blink ? 0.35 : 1;

    /* 迎撃範囲 */
    var win = interceptRange();
    var canFire = r.energy >= r.stats.interceptCost || r.od.active > 0;
    ctx.strokeStyle = canFire ? 'rgba(89,255,158,.22)' : 'rgba(255,77,94,.20)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath(); ctx.arc(p.x, p.y, win, 0, U.TAU); ctx.stroke();
    ctx.setLineDash([]);

    /* 機体 */
    var od = r.od.active > 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.beginPath();
    ctx.moveTo(0, -20); ctx.lineTo(13, 12); ctx.lineTo(0, 6); ctx.lineTo(-13, 12);
    ctx.closePath();
    ctx.fillStyle = od ? 'rgba(255,77,210,.35)' : 'rgba(77,243,255,.25)';
    ctx.fill();
    ctx.strokeStyle = od ? '#ff4dd2' : '#4df3ff';
    ctx.lineWidth = 2; ctx.stroke();

    /* 噴射 */
    var fl = 8 + Math.sin(r.s.elapsed * 30) * 4;
    ctx.beginPath();
    ctx.moveTo(-5, 11); ctx.lineTo(0, 11 + fl); ctx.lineTo(5, 11);
    ctx.closePath();
    ctx.fillStyle = od ? 'rgba(255,194,77,.8)' : 'rgba(109,240,255,.7)';
    ctx.fill();

    /* 被弾判定コア */
    ctx.beginPath(); ctx.arc(0, 0, p.hitR, 0, U.TAU);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, p.hitR + 3, 0, U.TAU);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawRings() {
    for (var i = 0; i < rings.length; i++) {
      var g = rings[i];
      var k = 1 - g.t / g.life;              /* 0 -> 1 で広がる */
      var rad = g.r0 + (g.r1 - g.r0) * (1 - (1 - k) * (1 - k));
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.strokeStyle = g.c;
      ctx.lineWidth = 3 * (1 - k) + 0.6;
      ctx.beginPath(); ctx.arc(g.x, g.y, rad, 0, U.TAU); ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.18;
      ctx.fillStyle = g.c;
      ctx.beginPath(); ctx.arc(g.x, g.y, rad, 0, U.TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    for (var i = 0; i < PARTICLE_MAX; i++) {
      var p = particles[i];
      if (!p.alive) continue;
      var a = 1 - p.age / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    ctx.textAlign = 'center';
    for (var i = 0; i < floaters.length; i++) {
      var f = floaters[i];
      ctx.globalAlpha = Math.min(1, f.t * 2.2);
      ctx.font = '700 ' + f.sz + 'px "Consolas",monospace';
      ctx.fillStyle = '#000'; ctx.fillText(f.txt, f.x + 1, f.y + 1);
      ctx.fillStyle = f.c; ctx.fillText(f.txt, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawOverlay() {
    var r = run;
    /* OD */
    if (r.od.active > 0) {
      ctx.fillStyle = 'rgba(255,77,210,.06)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,77,210,.35)';
      ctx.lineWidth = 4; ctx.strokeRect(2, 2, W - 4, H - 4);
    }
    /* 硬直 */
    if (r.stun > 0) {
      var sa = r.stun / Math.max(0.01, r.stunMax);
      ctx.fillStyle = 'rgba(255,45,85,' + (0.05 + sa * 0.16) + ')';
      ctx.fillRect(0, 0, W, H);
      /* 画面端に枠を出して、視線がどこにあっても硬直に気づけるようにする */
      ctx.strokeStyle = 'rgba(255,45,85,' + (0.3 + sa * 0.5) + ')';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, H - 6);
    }
    /* ヒットフラッシュ */
    if (flash.t > 0) {
      ctx.fillStyle = rgba(flash.c, flash.a * (flash.t / 0.4));
      ctx.fillRect(0, 0, W, H);
    }
    /* ビネット */
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    /* エネルギーが尽きかけていて弾幕が来ているときだけ切替を促す */
    if (r.mode === 'attack' && r.threat > 0 && r.energy < r.stats.interceptCost * 4) {
      ctx.textAlign = 'center';
      ctx.font = '11px "Consolas",monospace';
      ctx.fillStyle = 'rgba(255,77,94,' + (0.45 + Math.sin(r.s.elapsed * 7) * 0.3) + ')';
      ctx.fillText('迎撃エネルギー低下 &mdash; SPACE で充填'.replace('&mdash;', '-'), W / 2, H - 156);
      ctx.textAlign = 'left';
    }
  }

  /* ============================================================
     HUD
     ============================================================ */
  var $ = function (id) { return document.getElementById(id); };
  var hudCache = {};
  function setTxt(id, v) {
    if (hudCache[id] === v) return;
    hudCache[id] = v;
    var el = $(id); if (el) el.textContent = v;
  }
  function setBar(id, ratio) {
    var el = $(id); if (el) el.style.transform = 'scaleX(' + U.clamp(ratio, 0, 1) + ')';
  }

  function updateHud(force) {
    var r = run; if (!r) return;
    var p = r.player;
    setBar('hpFill', p.hp / p.maxHp);
    setBar('shFill', p.shield / Math.max(1, p.shieldMax));
    setBar('enFill', r.energy / Math.max(1, r.stats.energyMax));
    var oc = odCost();
    setBar('odFill', r.od.gauge / oc);
    hudEl.classList.toggle('od-ready', r.od.gauge >= oc);
    hudEl.classList.toggle('en-low', r.energy < r.stats.interceptCost * 3);
    hudEl.classList.toggle('en-out', r.overload);

    /* ミス硬直の可視化。残り時間は毎フレーム更新しないと一瞬で消えて見えない。 */
    var ml = $('missLock');
    if (r.stun > 0) {
      ml.classList.remove('hidden');
      setBar('missLockBar', r.stun / Math.max(0.01, r.stunMax));
      var ms = $('missLockMs');
      if (ms) ms.textContent = r.stun.toFixed(2) + 's';
      $('wordPanel').classList.add('locked');
    } else if (!ml.classList.contains('hidden')) {
      ml.classList.add('hidden');
      $('wordPanel').classList.remove('locked');
    }

    hudT -= 1;
    if (hudT > 0 && !force) return;
    hudT = 6;

    setTxt('hpText', Math.ceil(p.hp) + ' / ' + p.maxHp);
    setTxt('shText', Math.round(p.shield) + ' / ' + p.shieldMax);
    setTxt('enText', Math.round(r.energy) + ' / ' + r.stats.energyMax);
    $('chipAttack').classList.toggle('on', r.mode === 'attack');
    $('chipIntercept').classList.toggle('on', r.mode === 'intercept');
    var tw = $('threatWarn');
    setTxt('threatWarn', r.overload ? '迎撃系ダウン' : '弾幕接近');
    tw.classList.toggle('on', r.overload || r.threat >= 3);
    setTxt('odText', r.od.active > 0
      ? 'ACTIVE ' + r.od.active.toFixed(1) + 's'
      : Math.floor(r.od.gauge) + ' / ' + odCost());
    setBar('prFill', r.pressure);
    setTxt('pressurePct', Math.round(r.pressure * 100) + '%');
    hudEl.classList.toggle('pr-high', r.pressure >= 0.6);
    hudEl.classList.toggle('pr-crit', r.pressure >= 0.85);
    setTxt('sectorName', r.sector.ja);
    setTxt('waveInfo', r.sector.endless
      ? 'WAVE ' + (r.waveIdx + 1) + '  /  ENDLESS'
      : (r.waveState === 'bossfight' || r.waveState === 'boss' ? 'BOSS BATTLE' : 'WAVE ' + Math.min(r.waveIdx + 1, r.sector.waves) + ' / ' + r.sector.waves));
    setTxt('scoreVal', U.fmt(r.s.score));
    setTxt('comboVal', r.s.combo + (r.s.combo >= 30 ? ' !' : ''));
    setTxt('kpsVal', kps().toFixed(1));
    setTxt('accVal', accuracy() + '%');

    /* ボスバー */
    var bw = $('bossBarWrap');
    if (r.boss && !r.boss.dead) {
      bw.classList.remove('hidden');
      setTxt('bossName', r.boss.def.ja);
      setBar('bossFill', r.boss.hp / r.boss.maxHp);
    } else bw.classList.add('hidden');

    /* 単語パネル */
    var wp = $('wordPanel');
    if (r.mode === 'intercept' ? r.ic.matcher : (r.target && !r.target.dead)) {
      wp.classList.remove('hidden');
      wp.classList.toggle('mode-intercept', r.mode === 'intercept');
      var m = r.mode === 'intercept' ? r.ic.matcher : r.target.matcher;
      setTxt('wordLabel', r.mode === 'intercept'
        ? '迎撃エネルギー充填'
        : '目標  ' + r.target.def.ja + '   (残り ' + orderedEnemies().length + ')');
      var kp = m.kanaParts();
      $('wordKana').innerHTML = '<span style="color:#1b7f8c">' + U.esc(kp[0]) + '</span>' + U.esc(kp[1]);
      var parts = m.parts();
      $('wDone').textContent = parts[0];
      $('wNext').textContent = parts[1];
      $('wRest').textContent = parts[2];
      $('wordMeaning').textContent = m.sub || '';
    } else wp.classList.add('hidden');
  }

  /* タイピング速度は「1秒あたりの正打鍵数」で表す。
     WPM は「英単語1語=5打鍵」という換算が前提で、ローマ字入力の日本語とは
     噛み合わない（同じ語でも打鍵数が入力方式で変わる）ため使わない。 */
  function kps() {
    var s = run.s.elapsed;
    if (s < 1) return 0;
    return Math.round((run.s.correct / s) * 10) / 10;
  }
  function accuracy() {
    var t = run.s.correct + run.s.miss;
    return t === 0 ? 100 : Math.round((run.s.correct / t) * 100);
  }

  /* ============================================================
     リザルト
     ============================================================ */
  function finish(cleared) {
    if (run.finished) return;
    run.finished = true;
    state = 'ending';
    ST.Audio.stopMusic();

    var r = run, save = ST.Save.d;
    var acc = accuracy(), k = kps();

    /* ランク判定 */
    var score = r.s.score;
    /* 速度の寄与は 10打/秒 で頭打ち（従来の 120WPM 上限と同じ重み） */
    var rankScore = (acc * 1.6) + Math.min(k, 10) * 8.4 + Math.min(r.s.maxCombo, 300) * 0.28
      + (cleared ? 60 : 0) - r.s.hits * 4;
    var rank = rankScore >= 300 ? 'S' : rankScore >= 250 ? 'A' : rankScore >= 200 ? 'B'
      : rankScore >= 150 ? 'C' : rankScore >= 100 ? 'D' : 'E';
    if (cleared && acc >= 99 && r.s.hits === 0) rank = 'SS';

    /* 報酬 */
    var expGain = (r.expPending || 0) * (cleared ? 1.35 : 0.7);
    var credits = Math.round((score * 0.045 + (cleared ? 220 : 40)) * (1 + r.stats.creditGain / 100) * run.diff.drop);
    var lvres = ST.Growth.gainExp(save.pilot, expGain);
    save.pilot.credits += credits;

    /* 戦利品 */
    var loot = cleared ? r.loot : r.loot.slice(0, Math.ceil(r.loot.length / 2));
    for (var i = 0; i < loot.length; i++) save.inventory.push(loot[i]);
    if (save.inventory.length > 120) save.inventory = save.inventory.slice(-120);

    /* 進行 & 記録 */
    if (cleared && !r.sector.endless) {
      save.progress.clearedSectors[r.sector.id] = Math.max(
        save.progress.clearedSectors[r.sector.id] || 0, run.diff.index + 1);
    }
    var key = r.sector.id + '|' + run.diff.id;
    var prev = save.records[key];
    if (!prev || score > prev.score) {
      save.records[key] = { score: score, rank: rank, acc: acc, kps: k, wave: r.waveIdx + 1, cleared: cleared };
    }
    save.stats.totalKeys += r.s.keys;
    save.stats.totalCorrect += r.s.correct;
    save.stats.totalKills += r.s.kills;
    save.stats.runs++;
    save.stats.bestKps = Math.max(save.stats.bestKps || 0, k);
    save.stats.bestCombo = Math.max(save.stats.bestCombo, r.s.maxCombo);
    ST.Save.save();

    run.result = {
      cleared: cleared, rank: rank, score: score, acc: acc, kps: k,
      combo: r.s.maxCombo, kills: r.s.kills, words: r.s.words,
      intercepts: r.s.intercepts, hits: r.s.hits, time: r.s.elapsed,
      exp: Math.round(expGain), credits: credits, loot: loot, levels: lvres,
      sector: r.sector, diff: run.diff, wave: r.waveIdx + 1
    };
    if (lvres.levels > 0) ST.Audio.play('levelup');

    hudEl.classList.add('hidden');
    ST.UI.showResult(run.result);
  }

  /* ============================================================
     ループ
     ============================================================ */
  function loop(now) {
    raf = requestAnimationFrame(loop);
    var dt = U.clamp((now - lastT) / 1000, 0, 0.05);
    lastT = now;
    frameDt = dt;
    if (state === 'playing' && run) {
      update(dt);
      updateHud(false);
    }
    render();
  }

  /* ============================================================
     初期化
     ============================================================ */
  function fit() {
    var st = document.getElementById('stage');
    var sc = Math.min(window.innerWidth / W, window.innerHeight / H);
    sc = Math.min(sc, 1.4);
    st.style.transform = 'scale(' + sc + ')';
  }

  function init() {
    cv = document.getElementById('game');
    ctx = cv.getContext('2d', { alpha: false });
    hudEl = document.getElementById('hud');
    ST.Words.build();
    ST.Save.load();
    ST.Audio.init();
    applyAudioSettings();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', fit);
    window.addEventListener('blur', function () { if (state === 'playing') pause(); });
    document.addEventListener('click', function () { ST.Audio.resume(); }, { once: true });
    fit();
    ST.UI.init();
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function applyAudioSettings() {
    var s = ST.Save.d.settings;
    ST.Audio.setEnabled(s.audio);
    ST.Audio.setSfx(s.sfxVol);
    ST.Audio.setMusic(s.musicVol);
    document.body.classList.toggle('no-crt', !s.crt);
  }

  /* パターン関数から参照される */
  G.newBullet = newBullet;

  return {
    init: init, start: start, pause: pause, resume: resume, quit: quit,
    computeStats: computeStats, applyAudioSettings: applyAudioSettings,
    get state() { return state; },
    get run() { return run; }
  };
})();

window.addEventListener('DOMContentLoaded', function () { ST.Game.init(); });
