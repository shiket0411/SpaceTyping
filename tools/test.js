/* ============================================================
   SpaceTyping 正当性テスト

   使い方:  node tools/test.js [all|romaji|play|render|ui|jitter]
   終了コード 0 = 全通過 / 1 = 失敗あり
   ============================================================ */
'use strict';
const { build, boot } = require('./harness');
const { runMission } = require('./sim');

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '   ' + (extra === undefined ? '' : extra)));
  if (!cond) failures++;
};
const head = (s) => console.log('\n' + s);

/* ============================================================
   1. ローマ字マッチャ
   ============================================================ */
function testRomaji() {
  head('[ローマ字] かな -> ローマ字の受理判定');
  const ST = boot().ST;
  const R = ST.Romaji;

  const type = (kana, input) => {
    const m = R.create({ kana, text: kana });
    for (let i = 0; i < input.length; i++) {
      const r = m.feed(input[i]);
      if (r === 'miss') {
        if (m.done && m.swallowN && input[i] === 'n') continue;   /* 語尾「ん」の余剰 n */
        return false;
      }
      if (r === 'done') {
        if (i === input.length - 1) return true;
        return !!(m.swallowN && input.slice(i + 1) === 'n');
      }
    }
    return false;
  };

  /* 受理されるべき入力 */
  [
    ['しゅっぱつ', 'shuppatsu'], ['しゅっぱつ', 'syuppatu'], ['しゅっぱつ', 'shixyuppatsu'],
    ['しゅっぱつ', 'silyuppatu'], ['こうしん', 'koushin'], ['こうしん', 'koushinn'],
    ['じかん', 'jikan'], ['じかん', 'zikann'], ['ちきゅう', 'chikyuu'], ['ちきゅう', 'tikyuu'],
    ['ちきゅう', 'tikixyuu'], ['じゃあく', 'jaaku'], ['じゃあく', 'zyaaku'], ['じゃあく', 'jixyaaku'],
    ['ふぁいなる', 'fainaru'], ['ふぁいなる', 'fuxainaru'], ['てんのう', 'tennnou'],
    ['ぎんが', 'ginga'], ['ぎんが', 'ginnga'], ['あんい', 'anni'], ['あんい', 'axni'],
    ['ろけっと', 'roketto'], ['ろけっと', 'rokextuto'], ['ちょうおんぱ', 'tyouonnpa'],
    ['りゅうせい', 'ryuusei'], ['しんくう', 'sinnkuu'], ['ゔぁりあんと', 'variannto']
  ].forEach(([k, i]) => ok('受理 ' + k + ' <- ' + i, type(k, i)));

  /* IME と同様に弾かれるべき入力 */
  [
    ['ぎんが', 'ginka'], ['あんい', 'ani'],
    ['てんのう', 'tennou'],      /* -> てんおう になる */
    ['しゅっぱつ', 'shupatsu']   /* 促音が足りない */
  ].forEach(([k, i]) => ok('拒否 ' + k + ' <- ' + i, !type(k, i)));

  head('[単語バンク] 階層ごとの語数とローマ字化');
  const W = ST.Words;
  for (let t = 0; t < 5; t++) {
    ok('tier' + t + ' 日本語 12語以上', W.buckets.ja[t].length >= 12, W.buckets.ja[t].length);
    ok('tier' + t + ' 英語 12語以上', W.buckets.en[t].length >= 12, W.buckets.en[t].length);
  }
  const bad = W.ja.filter(w => /[^ぁ-ゟー]/.test(w.kana));
  ok('全ての日本語がかなのみ', bad.length === 0, bad.map(w => w.kana).join(','));
}

/* ============================================================
   2. 統合プレイテスト（例外を出さずに完走するか）
   ============================================================ */
function testPlay() {
  head('[統合プレイ] 各難易度でミッションが破綻なく進むか');
  const cases = [
    ['s1', 'novice', 8, 5, 'uncommon'],
    ['s1', 'pilot', 8, 5, 'uncommon'],
    ['s4', 'ace', 24, 21, 'rare'],
    ['s6', 'veteran', 34, 34, 'legendary'],
    ['s8', 'nightmare', 70, 60, 'legendary'],
    ['endless', 'nightmare', 40, 35, 'epic']
  ];
  cases.forEach(([sec, diff, lv, il, rar]) => {
    let r = null, err = null;
    try {
      r = runMission({
        sector: sec, diff, level: lv, ilvl: il, rarity: rar,
        seed: 7, godMode: true, maxSeconds: 180
      });
    } catch (e) { err = e; }
    const label = (sec + '/' + diff).padEnd(20);
    if (err) { ok(label + '例外なし', false, err.message); return; }
    ok(label + '例外なし', true);
    ok(label + '敵を撃破している', r.kills > 0, 'kills=' + r.kills);
    ok(label + '得点が入っている', r.score > 0, 'score=' + r.score);
    ok(label + '打鍵が成立している', r.keys > 50, 'keys=' + r.keys);
  });

  head('[ミス多発] 精度が低くても破綻しないか');
  let err = null;
  try { runMission({ sector: 's3', diff: 'pilot', level: 16, ilvl: 14, rarity: 'uncommon', missRate: 0.45, seed: 3, godMode: true, maxSeconds: 120 }); }
  catch (e) { err = e; }
  ok('ミス率45%でも例外なし', !err, err && err.message);

  head('[セーブ] 保存と読み直しで内容が一致するか');
  const a = boot({ seed: 1 });
  const d = a.ST.Save.d;
  d.pilot.level = 33; d.pilot.credits = 4242;
  d.inventory.push(a.ST.Items.generate(40, { rarity: 'mythic' }));
  d.equipped.weapon = a.ST.Items.generate(40, { slot: 'weapon', rarity: 'legendary' });
  d.progress.clearedSectors.s1 = 3;
  d.records['s1|pilot'] = { score: 12345, rank: 'A', acc: 96, kps: 5.8, wave: 6, cleared: true };
  a.ST.Save.save();
  const raw = a._store['spacetyping.save.v1'];
  const b = build({ seed: 1 });
  b._store['spacetyping.save.v1'] = raw;
  b.loadAll();
  const d2 = b.ST.Save.d;
  ok('レベル', d2.pilot.level === 33);
  ok('資金', d2.pilot.credits === 4242);
  ok('所持品', d2.inventory.length === 1);
  ok('装備', !!d2.equipped.weapon);
  ok('進行状況', d2.progress.clearedSectors.s1 === 3);
  ok('スコア記録', d2.records['s1|pilot'] && d2.records['s1|pilot'].score === 12345);

  head('[装備生成] 生成物が壊れていないか');
  const g = boot({ seed: 5 }).ST;
  const counts = {};
  for (let i = 0; i < 5000; i++) {
    const it = g.Items.generate(1 + Math.floor(Math.random() * 60), { luck: 0.3 });
    counts[it.rarity] = (counts[it.rarity] || 0) + 1;
    if (!it.affixes.length || !it.name || !isFinite(it.power)) { ok('不正なアイテムなし', false, JSON.stringify(it)); return; }
  }
  ok('不正なアイテムなし', true);
  ok('全レアリティが出現する', Object.keys(counts).length >= 5, JSON.stringify(counts));
}

/* ============================================================
   3. 描画パス（NaN 座標 / 不正な色 / 不正なフォントの検出）
   ============================================================ */
function testRender() {
  head('[描画] canvas 呼び出しの健全性');
  const problems = [];
  const seen = new Set();
  const note = (m) => { if (!seen.has(m)) { seen.add(m); problems.push(m); } };
  const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)$/;

  function validatingCtx() {
    const state = { fillStyle: '#000', strokeStyle: '#000', font: '10px sans', lineWidth: 1, globalAlpha: 1 };
    const chk = (name, args) => {
      for (let i = 0; i < args.length; i++) {
        if (typeof args[i] === 'number' && !isFinite(args[i])) note(name + '(): 引数' + i + ' が ' + args[i]);
      }
    };
    const noop = (n) => function () { chk(n, arguments); };
    const c = {
      canvas: { width: 960, height: 720 },
      save: noop('save'), restore: noop('restore'), beginPath: noop('beginPath'),
      closePath: noop('closePath'), moveTo: noop('moveTo'), lineTo: noop('lineTo'),
      arc: noop('arc'), rect: noop('rect'), fill: noop('fill'), stroke: noop('stroke'),
      clip: noop('clip'), fillRect: noop('fillRect'), strokeRect: noop('strokeRect'),
      clearRect: noop('clearRect'), translate: noop('translate'), rotate: noop('rotate'),
      scale: noop('scale'), setTransform: noop('setTransform'), transform: noop('transform'),
      setLineDash: noop('setLineDash'), putImageData: noop('putImageData'),
      strokeText: noop('strokeText'),
      drawImage: function (img) {
        chk('drawImage', Array.prototype.slice.call(arguments, 1));
        if (!img) note('drawImage(): 画像が null');
      },
      fillText: function (t, x, y) {
        chk('fillText', [x, y]);
        if (t === undefined || t === null) note('fillText(): テキストが ' + t);
        if (typeof t === 'string' && /undefined|NaN|\[object/.test(t)) note('fillText(): 不正なテキスト "' + t + '"');
      },
      measureText: (t) => ({ width: String(t == null ? '' : t).length * 8 }),
      createLinearGradient: function () {
        chk('createLinearGradient', arguments);
        return { addColorStop: (o, col) => { if (!COLOR.test(String(col))) note('gradient色が不正: "' + col + '"'); } };
      },
      createRadialGradient: function () {
        chk('createRadialGradient', arguments);
        return { addColorStop: (o, col) => { if (!COLOR.test(String(col))) note('gradient色が不正: "' + col + '"'); } };
      },
      createPattern: () => null,
      textAlign: 'left', textBaseline: 'top', shadowBlur: 0, shadowColor: '',
      globalCompositeOperation: 'source-over'
    };
    ['fillStyle', 'strokeStyle'].forEach(k => Object.defineProperty(c, k, {
      get: () => state[k],
      set: (v) => {
        state[k] = v;
        if (v && typeof v === 'object') return;          /* gradient */
        const s = String(v);
        if (/undefined|NaN/.test(s) || !COLOR.test(s)) note(k + ' が不正: "' + s + '"');
      }
    }));
    Object.defineProperty(c, 'font', {
      get: () => state.font,
      set: (v) => { state.font = v; if (/undefined|NaN/.test(String(v))) note('font が不正: "' + v + '"'); }
    });
    ['lineWidth', 'globalAlpha'].forEach(k => Object.defineProperty(c, k, {
      get: () => state[k],
      set: (v) => { state[k] = v; if (!isFinite(v)) note(k + ' が ' + v); }
    }));
    return c;
  }

  const cases = [
    ['s1', 'novice', 8, 5, 'uncommon', false],
    ['s5', 'ace', 28, 26, 'epic', false],
    ['s8', 'singularity', 70, 60, 'legendary', false],
    ['endless', 'nightmare', 40, 35, 'epic', false],
    ['s1', 'pilot', 8, 5, 'uncommon', true],
    ['s8', 'nightmare', 70, 60, 'legendary', true]
  ];
  cases.forEach(([sec, diff, lv, il, rar, boss], i) => {
    const c = boot({ seed: 50 + i, makeCtx: validatingCtx });
    const ST = c.ST;
    ST.Save.d.settings.lang = ['ja', 'en', 'mix'][i % 3];
    require('./sim').equip(ST, { level: lv, ilvl: il, rarity: rar });
    const sector = ST.Sectors.map[sec];
    ST.Game.start(sec, diff);
    const run = ST.Game.run;
    if (boss && !sector.endless) { run.waveIdx = sector.waves; run.waveState = 'boss'; run.waveStateT = 0.01; }
    let t = 0;
    for (let f = 0; f < 3600; f++) {
      if (ST.Game.state === 'ending') break;
      if (f % 10 === 0 && ST.Game.state === 'playing') {
        if (c.Math.random() < 0.05) c.key('Tab');   /* モード切替 */
        const m = run.mode === 'intercept' ? run.ic.matcher
          : (run.target && !run.target.dead ? run.target.matcher : null);
        if (m) { const fc = m.firstChars(); if (fc.length) c.key(c.Math.random() < 0.1 ? 'q' : fc[0]); }
        if (run.od.ready) c.key('Enter');
      }
      run.player.hp = run.player.maxHp;
      t += 1000 / 60; c._t = t;
      c._takeRaf().forEach(cb => cb(t));
    }
  });
  /* run が null（タイトル画面）の描画経路も通す */
  {
    const c = boot({ seed: 99, makeCtx: validatingCtx });
    let t = 0;
    for (let i = 0; i < 120; i++) { t += 1000 / 60; c._t = t; c._takeRaf().forEach(cb => cb(t)); }
  }
  ok('NaN座標 / 不正色 / 不正フォントなし', problems.length === 0);
  problems.slice(0, 12).forEach(p => console.log('       - ' + p));
}

/* ============================================================
   4. UI 回帰
   ============================================================ */
function testUI() {
  const setup = (seed) => {
    const c = boot({ seed: seed || 11 });
    const ST = c.ST, d = ST.Save.d;
    d.pilot.credits = 50000;
    d.pilot.level = 20;
    return { c, ST, d, $: (id) => c.document.getElementById(id) };
  };
  const invText = ($) => $('invList').innerHTML + $('invList')._children.map(r => r.innerHTML).join('');
  const invCount = ($) => $('invCount').textContent;

  head('[UI] 補給ドックの変更が格納庫へ即座に反映されるか');
  {
    const { ST, d, $ } = setup();
    ST.UI.show('scr-hangar', true);
    ok('初期の所持数が0', invCount($).indexOf('0 /') === 0, invCount($));
    ST.UI.show('scr-shop', true);
    const cards = $('shopBody').querySelectorAll('.shop-card');
    ok('ショップのカードが3枚', cards.length === 3, cards.length);
    cards[0].onclick();
    ok('所持品が1件増える', d.inventory.length === 1);
    const bought = d.inventory[0];
    ST.UI.back();
    ok('格納庫の所持数が更新される', invCount($).indexOf('1 /') === 0, invCount($));
    ok('買った装備がリストに出る', invText($).indexOf(bought.name) >= 0);
  }

  head('[UI] 一括売却の反映と、売却済みアイテムの複製防止');
  {
    const { ST, d, $ } = setup(12);
    const junk = ST.Items.generate(10, { rarity: 'common' });
    d.inventory.push(junk);
    for (let i = 0; i < 4; i++) d.inventory.push(ST.Items.generate(10, { rarity: 'common' }));
    ST.UI.show('scr-hangar', true);
    $('invList').querySelectorAll('.itemrow')[0].onclick();
    ST.UI.show('scr-shop', true);
    $('btnSellJunk').onclick();
    ok('1回目は確認だけで売却しない', d.inventory.indexOf(junk) >= 0);
    $('btnSellJunk').onclick();
    const credits = d.pilot.credits;
    ST.UI.back();
    ok('所持数が0に更新される', invCount($).indexOf('0 /') === 0, invCount($));
    ok('詳細から消えている', $('itemDetail').innerHTML.indexOf(junk.name) < 0);
    const be = $('btnEquip');
    if (be && be.onclick) be.onclick();
    ok('売却済みが装備されない', !Object.keys(d.equipped).some(k => d.equipped[k] === junk));
    ok('所持品にも復活しない', d.inventory.indexOf(junk) < 0);
    ok('資金が変化しない', d.pilot.credits === credits);
  }

  head('[UI] 装備の着脱と拡張スロットの選択');
  {
    const { ST, d, $ } = setup(13);
    const w = ST.Items.generate(20, { slot: 'weapon', rarity: 'rare' });
    d.inventory.push(w);
    ST.UI.show('scr-hangar', true);
    $('invList').querySelectorAll('.itemrow')[0].onclick();
    ok('武器に拡張ボタンは出ない', $('itemDetail').innerHTML.indexOf('btnEquip1') < 0);
    $('btnEquip').onclick();
    ok('武器スロットへ装備', d.equipped.weapon === w);
    ok('所持品から消える', d.inventory.indexOf(w) < 0);
    $('btnUnequip').onclick();
    ok('外すと所持品へ戻る', d.equipped.weapon === null && d.inventory.indexOf(w) >= 0);
  }
  {
    const { ST, d, $ } = setup(14);
    const mk = (r) => ST.Items.generate(20, { slot: 'module', rarity: r });
    const m1 = mk('rare'), m2 = mk('rare');
    d.equipped.module1 = m1; d.equipped.module2 = m2;
    const fresh = mk('epic');
    d.inventory.push(fresh);
    ST.UI.show('scr-hangar', true);
    $('invList').querySelectorAll('.itemrow')[0].onclick();
    const detail = $('itemDetail').innerHTML;
    ok('拡張1/拡張2の両ボタンが出る', detail.indexOf('btnEquip1') >= 0 && detail.indexOf('btnEquip2') >= 0);
    $('btnEquip2').onclick();
    ok('拡張2に装備できる', d.equipped.module2 === fresh);
    ok('拡張1は変わらない', d.equipped.module1 === m1);
    ok('外れた装備が戻る', d.inventory.indexOf(m2) >= 0);
  }

  head('[UI] スコア記録が難易度をまたいで見えるか');
  {
    const { ST, d, $ } = setup(15);
    ST.Sectors.list.forEach(s => { d.progress.clearedSectors[s.id] = 7; });
    d.records['s1|novice'] = { score: 5467, rank: 'B', acc: 90, kps: 3.3, wave: 6, cleared: true };
    d.records['s1|pilot'] = { score: 10079, rank: 'A', acc: 95, kps: 5.0, wave: 6, cleared: true };
    d.records['s1|ace'] = { score: 31047, rank: 'S', acc: 97, kps: 6.7, wave: 6, cleared: true };
    ST.UI.show('scr-difficulty', true);
    $('diffList')._children[2].onclick();               /* PILOT */
    const html = $('sectorList')._children[0].innerHTML;
    ok('選択中難易度のBESTが出る', html.indexOf('10,079') >= 0);
    ok('他難易度の記録も見える', html.indexOf('5,467') >= 0 && html.indexOf('31,047') >= 0);
    ST.UI.back();
    $('diffList')._children[0].onclick();               /* NOVICE */
    const html2 = $('sectorList')._children[0].innerHTML;
    ok('難易度を変えても消えない', html2.indexOf('10,079') >= 0 && html2.indexOf('31,047') >= 0);
    ok('BEST見出しに難易度名', html2.indexOf('BEST / NOVICE') >= 0);
  }

  head('[UI] 画面遷移とセーブ失敗の検知');
  {
    const { ST, d, $ } = setup(16);
    ST.UI.show('scr-title');
    ok('タイトルに資金が出る', $('pilotStrip').innerHTML.indexOf('50,000') >= 0);
    d.pilot.credits = 123;
    ST.UI.show('scr-hangar', true);
    ST.UI.back();
    ok('資金の変化が反映される', $('pilotStrip').innerHTML.indexOf('123') >= 0);
    ['scr-difficulty', 'scr-sector', 'scr-shop', 'scr-settings', 'scr-help', 'scr-hangar']
      .forEach(id => { let e = null; try { ST.UI.show(id); } catch (x) { e = x; } ok('画面を開ける ' + id, !e, e && e.message); });
  }
  {
    const c = boot({ seed: 17 });
    ok('正常時はセーブエラー無し', c.ST.Save.lastError() === null);
    c.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    const warn = console.warn; console.warn = () => {};   /* 想定内の警告なので伏せる */
    const saved = c.ST.Save.save();
    console.warn = warn;
    ok('save() が false を返す', saved === false);
    ok('エラーが保持される', typeof c.ST.Save.lastError() === 'string');
    c.ST.UI.show('scr-title');
    ok('タイトルに警告が出る', c.document.getElementById('pilotStrip').innerHTML.indexOf('!') >= 0);
  }
}

/* ============================================================
   4.5 操作系 / オーバードライブ
   ============================================================ */
function testControls() {
  const { equip } = require('./sim');
  const setup = (seed, sector, diff) => {
    const c = boot({ seed: seed });
    const ST = c.ST;
    equip(ST, { level: 40, ilvl: 40, rarity: 'epic' });
    ST.Game.start(sector || 's4', diff || 'ace');
    const run = ST.Game.run;
    let t = 0;
    const step = (n) => {
      for (let i = 0; i < (n || 1); i++) {
        run.player.hp = run.player.maxHp;
        t += 1000 / 60; c._t = t;
        c._takeRaf().forEach(cb => cb(t));
      }
    };
    step(30);
    return { c, ST, run, step };
  };

  head('[操作] TAB でモード切替 / SHIFT+TAB で目標送り');
  {
    const { c, run, step } = setup(70);
    const m0 = run.mode;
    c.key('Tab');
    ok('TAB でモードが変わる', run.mode !== m0, m0 + ' -> ' + run.mode);
    c.key('Tab');
    ok('TAB で元に戻る', run.mode === m0);
    step(120);
    const before = run.target;
    c.fire('keydown', { key: 'Tab', shiftKey: true, repeat: false, preventDefault() {}, stopPropagation() {} });
    ok('SHIFT+TAB で目標が変わる', run.enemies.length < 2 || run.target !== before);
  }

  head('[操作] SPACE が打鍵に使えるか（英文のスペース）');
  {
    const { c, ST, run, step } = setup(71);
    run.mode = 'intercept';
    run.ic.word = { text: 'warp core online' };
    run.ic.matcher = ST.Romaji.create(run.ic.word);
    run.energy = 0;
    let missed = 0;
    for (const ch of 'warp core online') {
      const before = run.ic.matcher.count;
      c.key(ch);
      if (run.ic.matcher === null) break;
    }
    ok('スペース入りの英文を打ち切れる', run.ic.word.text !== 'warp core online', '未完了');
    ok('スペースでも充填される', run.energy > 0, run.energy);
    const m0 = run.mode;
    c.key(' ');
    ok('SPACE でモードが変わらない', run.mode === m0);
  }
  {
    const ST = boot({ seed: 72 }).ST;
    const bad = ST.Words.en.filter(w => !/^[a-z0-9\-,.\/' ]+$/.test(w.text));
    ok('英単語が全て打鍵可能な文字だけ', bad.length === 0, bad.slice(0, 3).join(','));
    ok('スペース入りの英文が登録されている', ST.Words.en.some(w => w.text.indexOf(' ') >= 0));
  }

  head('[OD] 発動効果と必要量の逓増');
  {
    const { c, run, step } = setup(73, 's5', 'nightmare');
    /* 迎撃を止めて弾を溜める */
    run.energy = 0; run.overload = true;
    step(600);
    run.pressure = 0.9;
    run.player.shield = 0;
    run.od.gauge = 1e9;
    c.key('Enter');
    ok('発動する', run.od.active > 0, run.od.active);
    /* 軽減量は調整対象なので「下がること」だけを見る */
    ok('戦域圧力が下がる', run.pressure < 0.9, run.pressure);
    ok('迎撃エネルギーが全快する', run.energy === run.stats.energyMax);
    ok('オーバーロードが解除される', run.overload === false);
    ok('障壁が全快する', run.player.shield === run.player.shieldMax);
    ok('予告中のレーザーが消える', run.lasers.filter(L => !L.fired).length === 0);
    step(1);
    ok('ゲージを消費する', run.od.gauge === 0, run.od.gauge);
  }
  {
    /* 必要量は宙域と難易度で決まり、ミッション中（ウェーブが進んでも）一定 */
    const { c, run, step } = setup(74, 's5', 'nightmare');
    const readCost = () => {
      run.od.gauge = 0; step(10);
      return parseInt(String(c.document.getElementById('odText').textContent).split('/')[1], 10);
    };
    const base = readCost();
    let constant = true;
    for (let w = 1; w < 6; w++) { run.waveIdx = w; if (readCost() !== base) constant = false; }
    ok('ウェーブが進んでも必要量は変わらない', constant, base);
    run.waveIdx = 0;
    run.od.gauge = base - 1; step(2);
    ok('必要量未満では発動不可', run.od.ready === false);
    run.od.gauge = base; step(2);
    ok('必要量ちょうどで発動可 (' + base + ')', run.od.ready === true);
  }
  {
    /* 宙域が進むほど / 難易度が上がるほど必要量が増える */
    const readCost = (sector, diff) => {
      const { c, run, step } = setup(76, sector, diff);
      run.od.gauge = 0; step(10);
      return parseInt(String(c.document.getElementById('odText').textContent).split('/')[1], 10);
    };
    const bySector = ['s1', 's3', 's5', 's8'].map(s => readCost(s, 'pilot'));
    let up = true;
    for (let i = 1; i < bySector.length; i++) if (bySector[i] <= bySector[i - 1]) up = false;
    ok('宙域が進むほど必要量が増える', up, bySector.join(' / '));

    const byDiff = ['novice', 'pilot', 'veteran', 'singularity'].map(d => readCost('s5', d));
    let up2 = true;
    for (let i = 1; i < byDiff.length; i++) if (byDiff[i] <= byDiff[i - 1]) up2 = false;
    ok('難易度が上がるほど必要量が増える', up2, byDiff.join(' / '));

    ok('エンドレスでも必要量が算出される', readCost('endless', 'pilot') > 0);
  }

  head('[操作] ミス硬直が可視化されるか');
  {
    const { c, run, step } = setup(75);
    ok('初期状態では表示されない', c.document.getElementById('missLock').classList.contains('hidden'));
    /* 敵が出るまで待ってから確実にミスさせる */
    run.mode = 'attack';
    for (let i = 0; i < 60 && !run.target; i++) step(10);
    if (run.target) {
      const fc = run.target.matcher.firstChars();
      const wrong = 'abcdefghijklmnopqrstuvwxyz'.split('').find(ch => fc.indexOf(ch) < 0);
      c.key(wrong);
      step(1);
      ok('ミスで硬直インジケータが出る', !c.document.getElementById('missLock').classList.contains('hidden'));
      ok('残り時間が表示される', /^[0-9.]+s$/.test(c.document.getElementById('missLockMs').textContent),
        c.document.getElementById('missLockMs').textContent);
      ok('単語パネルが沈む', c.document.getElementById('wordPanel').classList.contains('locked'));
      step(60);
      ok('硬直が明けると消える', c.document.getElementById('missLock').classList.contains('hidden'));
    } else ok('目標が存在する', false);
  }

  head('[OD] 迎撃ではゲージが溜まらない');
  {
    const { c, ST, run, step } = setup(77, 's5', 'nightmare');
    /* 弾が湧くまで進めてから、迎撃だけを起こす（打鍵は一切しない） */
    step(600);
    run.mode = 'intercept';
    run.energy = run.stats.energyMax;
    const before = run.od.gauge;
    const ic0 = run.s.intercepts;
    for (let i = 0; i < 240 && run.s.intercepts - ic0 < 5; i++) {
      run.energy = run.stats.energyMax;   /* 枯渇で迎撃が止まらないように */
      step(1);
    }
    ok('迎撃が発生している', run.s.intercepts - ic0 >= 5, run.s.intercepts - ic0);
    ok('迎撃してもゲージが増えない', run.od.gauge === before, before + ' -> ' + run.od.gauge);
  }
  {
    /* 対照: 攻撃側では従来どおり溜まる */
    const { c, run, step } = setup(78, 's5', 'nightmare');
    run.mode = 'attack';
    for (let i = 0; i < 60 && !run.target; i++) step(10);
    const before = run.od.gauge;
    if (run.target) c.key(run.target.matcher.firstChars()[0]);
    ok('攻撃の正打ではゲージが増える', run.od.gauge > before, before + ' -> ' + run.od.gauge);
  }

  head('[ミス] 難易度でペナルティが重くなる');
  {
    /* 硬直秒とエネルギー減の両方が graceMul で効く。装備差を消すため素の値で比較する */
    const miss = (diff) => {
      const { c, ST, run, step } = setup(79, 's4', diff);
      run.stats.grace = 0;
      run.mode = 'attack';
      for (let i = 0; i < 60 && !run.target; i++) step(10);
      if (!run.target) return null;
      run.energy = run.stats.energyMax;
      const e0 = run.energy;
      const fc = run.target.matcher.firstChars();
      c.key('abcdefghijklmnopqrstuvwxyz'.split('').find(ch => fc.indexOf(ch) < 0));
      return { stun: run.stun, energyLost: e0 - run.energy, cost: run.stats.interceptCost };
    };
    const ids = ['novice', 'pilot', 'ace', 'veteran', 'nightmare', 'singularity'];
    const rows = ids.map(miss);
    ok('全難易度でミスを再現できた', rows.every(r => r), rows.map((r, i) => r ? '' : ids[i]).join(''));
    if (rows.every(r => r)) {
      let up = true;
      for (let i = 1; i < rows.length; i++) if (rows[i].stun <= rows[i - 1].stun) up = false;
      ok('硬直が難易度とともに単調に伸びる', up, rows.map(r => r.stun.toFixed(2)).join(' / '));
      ok('SINGULARITY の硬直が0.7秒を超える', rows[5].stun > 0.7, rows[5].stun.toFixed(3));
      ok('lockDrop 未満はエネルギーが減らない',
        rows[0].energyLost === 0 && rows[1].energyLost === 0 && rows[2].energyLost === 0,
        rows.slice(0, 3).map(r => r.energyLost).join(' / '));
      ok('VETERAN 以上はエネルギーが減る',
        rows[3].energyLost > 0 && rows[4].energyLost > 0 && rows[5].energyLost > 0);
      ok('エネルギー減が迎撃1発分より重い',
        rows[3].energyLost > rows[3].cost && rows[5].energyLost > rows[5].cost * 3,
        rows[5].energyLost.toFixed(1) + ' vs cost ' + rows[5].cost.toFixed(1));
    }
  }

  head('[速度] 平均打鍵/秒 で表示・記録されるか');
  {
    const { c, ST, run, step } = setup(80);
    run.s.correct = 120;
    run.s.elapsed = 20; run.s.activeT = 20;   /* 6.0 打/秒 */
    step(10);
    const shown = c.document.getElementById('kpsVal').textContent;
    ok('HUD が小数1桁で出す', shown === '6.0', shown);
    const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
    ok('HUD から WPM 要素が消えている', html.indexOf('wpmVal') < 0);
    ok('HUD に打/秒 の見出しがある', html.indexOf('kpsVal') >= 0 && html.indexOf('打/秒') >= 0);

  }
  {
    /* リザルトと記録。setup の step は毎フレームHPを戻すので素のフレーム送りで撃沈させる */
    const c = boot({ seed: 82 });
    const ST = c.ST;
    equip(ST, { level: 40, ilvl: 40, rarity: 'epic' });
    ST.Game.start('s5', 'nightmare');
    const run = ST.Game.run;
    let t = 0;
    for (let i = 0; i < 7200 && ST.Game.state === 'playing'; i++) {
      run.s.correct = 120; run.s.elapsed = 20; run.s.activeT = 20;   /* 6.0 打/秒 に固定 */
      run.player.hp = Math.min(run.player.hp, 1);
      run.player.shield = 0;
      t += 1000 / 60; c._t = t;
      c._takeRaf().forEach(cb => cb(t));
    }
    const res = run.result;
    ok('撃沈してリザルトへ移る', !!res, ST.Game.state);
    ok('リザルトが kps を持つ', res && typeof res.kps === 'number', res && res.kps);
    ok('kps が実測どおり', res && Math.abs(res.kps - 6) < 0.06, res && res.kps);
    ok('WPM は持たない', res && res.wpm === undefined);
    const rec = ST.Save.d.records['s5|nightmare'];
    ok('記録に kps が入る', rec && typeof rec.kps === 'number', rec && rec.kps);
    ok('BEST 打/秒 が更新される', ST.Save.d.stats.bestKps > 0, ST.Save.d.stats.bestKps);
  }
  {
    /* 旧セーブ（WPM）の読み替え。WPM/12 = 打鍵/秒 */
    const a = boot({ seed: 81 });
    a._store['spacetyping.save.v1'] = JSON.stringify({
      version: 1,
      stats: { totalKeys: 10, totalCorrect: 9, totalKills: 3, bestWpm: 72, runs: 2, bestCombo: 40 },
      records: { 's1|pilot': { score: 999, rank: 'B', acc: 90, wpm: 60, wave: 6, cleared: true } }
    });
    const b = build({ seed: 81 });
    b._store['spacetyping.save.v1'] = a._store['spacetyping.save.v1'];
    b.loadAll();
    const d = b.ST.Save.d;
    ok('bestWpm 72 -> bestKps 6.0', Math.abs(d.stats.bestKps - 6) < 0.06, d.stats.bestKps);
    ok('記録の wpm 60 -> kps 5.0', Math.abs(d.records['s1|pilot'].kps - 5) < 0.06, d.records['s1|pilot'].kps);
    ok('スコアは失われない', d.records['s1|pilot'].score === 999);
  }
}

/* ============================================================
   5. 敵の移動が1フレームで飛んでいないか
   ============================================================ */
function testJitter() {
  head('[敵移動] 位置の不連続（ワープ）を検出');
  const agg = {};
  const record = (mover, dist) => {
    const w = agg[mover] || (agg[mover] = { max: 0, sum: 0, n: 0 });
    w.n++; w.sum += dist;
    if (dist > w.max) w.max = dist;
  };

  [['s2', 'pilot'], ['s3', 'pilot'], ['s5', 'ace'], ['s6', 'veteran'], ['s7', 'ace'], ['s8', 'pilot']]
    .forEach(([sec, diff], i) => {
      const c = boot({ seed: 200 + i });
      const ST = c.ST;
      ST.Save.d.pilot.level = 30;
      ST.Game.start(sec, diff);
      const run = ST.Game.run;
      const prev = new Map();
      let t = 0;
      for (let f = 0; f < 4000; f++) {
        if (ST.Game.state !== 'playing') break;
        run.player.hp = run.player.maxHp;
        t += 1000 / 60; c._t = t;
        c._takeRaf().forEach(cb => cb(t));
        for (const e of run.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          if (e.def.move === 'teleport') continue;      /* 仕様上ワープする */
          const p = prev.get(e);
          if (p) record(e.def.move, Math.hypot(e.x - p.x, e.y - p.y));
          prev.set(e, { x: e.x, y: e.y });
        }
      }
    });

  /* ボス単体も測る */
  {
    const c = boot({ seed: 260 });
    const ST = c.ST;
    ST.Save.d.pilot.level = 30;
    ST.Game.start('s1', 'pilot');
    const run = ST.Game.run, sec = ST.Sectors.map.s1;
    run.waveIdx = sec.waves; run.waveState = 'boss'; run.waveStateT = 0.01;
    let t = 0, p = null;
    for (let f = 0; f < 3000; f++) {
      run.player.hp = run.player.maxHp;
      t += 1000 / 60; c._t = t;
      c._takeRaf().forEach(cb => cb(t));
      const b = run.boss;
      if (b && !b.dead && b.spawnT <= 0) {
        if (p) record('boss', Math.hypot(b.x - p.x, b.y - p.y));
        p = { x: b.x, y: b.y };
      }
    }
  }

  console.log('  mover      最大1F移動  平均1F移動   最大/平均');
  Object.keys(agg).sort().forEach(k => {
    const w = agg[k];
    const avg = w.sum / Math.max(1, w.n);
    const ratio = w.max / Math.max(0.01, avg);
    console.log('  ' + k.padEnd(10) + String(w.max.toFixed(1)).padStart(10) +
      String(avg.toFixed(2)).padStart(12) + ('x' + ratio.toFixed(1)).padStart(12));
    ok('  ' + k + ' に不連続なし', ratio <= 8, 'ratio=' + ratio.toFixed(1));
  });
}

/* ============================================================
   7. 操作感の修正（打鍵が消える・遅れる問題など）
   ============================================================ */
function testFixes() {
  const { equip } = require('./sim');
  const setup = (seed) => {
    const c = boot({ seed: seed });
    const ST = c.ST;
    equip(ST, { level: 40, ilvl: 40, rarity: 'epic' });
    ST.Game.start('s4', 'ace');
    const run = ST.Game.run;
    let t = 0;
    const step = (n) => {
      for (let i = 0; i < (n || 1); i++) {
        run.player.hp = run.player.maxHp;
        t += 1000 / 60; c._t = t;
        c._takeRaf().forEach(cb => cb(t));
      }
    };
    const type = (s) => { for (const ch of s) c.key(ch); };
    const $ = (id) => c.document.getElementById(id);
    return { c, ST, run, step, type, $ };
  };
  /* 迎撃ワードを差し替える。打ち切ると次のワードが自動で入るので、そのたびに呼ぶ */
  const setIc = (ST, run, word) => {
    run.ic.word = word;
    run.ic.matcher = ST.Romaji.create(word);
    return run.ic.matcher;
  };

  head('[修正] 語尾「ん」の直後に n で始まる単語を打っても消えない');
  {
    const { ST, run, type } = setup(90);
    run.mode = 'intercept';
    run.stun = 0;
    const cases = [
      ['kan', 'なみ', 'nami', 'n 1打の「ん」 → なみ'],
      ['kann', 'なみ', 'nami', 'nn の「ん」 → なみ'],
      ['kan', 'なみ', 'nnami', '余剰 n を挟んで → なみ'],
      ['kan', 'のうりょく', 'nouryoku', 'n 1打の「ん」 → のうりょく'],
      ['kan', null, 'night', 'n 1打の「ん」 → 英単語 night']
    ];
    cases.forEach(([first, kana, input, label]) => {
      run.stun = 0;
      const miss0 = run.s.miss, words0 = run.s.words;
      setIc(ST, run, { kana: 'かん', text: 'かん' });
      type(first);
      setIc(ST, run, kana ? { kana, text: kana } : { text: 'night' });
      type(input);
      ok(label + ' がミスにならない', run.s.miss === miss0, 'miss +' + (run.s.miss - miss0));
      ok(label + ' が2語とも完成する', run.s.words === words0 + 2, 'words +' + (run.s.words - words0));
    });
    /* n で始まらない単語なら、従来どおり余剰 n は吸収される */
    run.stun = 0;
    const miss0 = run.s.miss;
    setIc(ST, run, { kana: 'かん', text: 'かん' });
    type('kan');
    setIc(ST, run, { kana: 'そら', text: 'そら' });
    type('nsora');
    ok('n で始まらない単語の前の余剰 n は吸収される', run.s.miss === miss0);
  }

  head('[修正] オーバーキル直後の猶予は「倒した単語の残り」だけを吸収する');
  {
    const { ST, run, step, type } = setup(91);
    step(200);
    ok('目標がいる', !!run.target);
    if (run.target) {
      run.mode = 'attack';
      run.stun = 0;
      const tgt = run.target;
      tgt.matcher = ST.Romaji.create({ text: 'zeta' });
      run.grace = 0.4;
      run.graceM = ST.Romaji.create({ text: 'lpha' });
      const miss0 = run.s.miss;
      type('lp');
      ok('残りの文字は吸収される', tgt.matcher.count === 0 && run.s.miss === miss0);
      type('z');
      ok('残りと違う文字で次の敵へ入る', tgt.matcher.count === 1, tgt.matcher.count);
      ok('猶予が打ち切られる', run.grace <= 0);
      ok('ミスにならない', run.s.miss === miss0);
    }
  }

  head('[修正] 単語パネルが打鍵の次のフレームで更新される');
  {
    const { ST, run, step, type, $ } = setup(92);
    run.mode = 'intercept';
    run.stun = 0;
    setIc(ST, run, { text: 'starlight' });
    step(7);                /* 間引きの周期をずらしておく */
    type('st');
    step(1);
    ok('打った文字がすぐ出る', $('wDone').textContent === 'st', $('wDone').textContent);
    type('a');
    step(1);
    ok('次の打鍵も1フレームで出る', $('wDone').textContent === 'sta', $('wDone').textContent);
  }

  head('[修正] IME オンの警告と全角英数の受理');
  {
    const { c, ST, run, $ } = setup(93);
    run.mode = 'intercept';
    run.stun = 0;
    $('imeWarn').classList.add('hidden');   /* スタブは HTML の class を持たないので明示 */
    c.key('Process');
    ok('IME の打鍵で警告が出る', !$('imeWarn').classList.contains('hidden'));
    const m = setIc(ST, run, { text: 'ab' });
    c.key('ａ');
    ok('全角 ａ を a として受理する', m.count === 1, m.count);
  }

  head('[修正] 打/秒 はウェーブ間の時間を含めない');
  {
    const { run, step } = setup(94);
    step(30);               /* 開幕の演出中 */
    ok('演出中は戦闘時間が進まない', run.s.activeT === 0 && run.s.elapsed > 0,
      run.s.activeT + ' / ' + run.s.elapsed);
    step(200);
    ok('戦闘が始まると進む', run.s.activeT > 0);
  }

  head('[修正] 被弾でコンボは全損せず半減する');
  {
    const { run, step } = setup(95);
    step(200);
    const e = run.enemies.find(x => !x.boss && !x.dead);
    ok('雑魚がいる', !!e);
    if (e) {
      run.s.combo = 40;
      const hits0 = run.s.hits;
      e.y = 900;           /* 画面下へ突破させる */
      step(1);
      ok('被弾が起きる', run.s.hits > hits0);
      ok('コンボが残る', run.s.combo > 0 && run.s.combo < 40, run.s.combo);
    }
  }

  head('[修正] 所持上限は価値の低いものから削る');
  {
    const ST = boot({ seed: 96 }).ST;
    const I = ST.Items;
    const inv = [];
    const legend = I.generate(10, { rarity: 'legendary' });
    inv.push(legend);                                   /* 最古の LEGENDARY */
    const locked = I.generate(10, { rarity: 'common' });
    locked.locked = true;
    inv.push(locked);
    for (let i = 0; i < 60; i++) inv.push(I.generate(10, { rarity: 'rare' }));
    for (let i = 0; i < 70; i++) inv.push(I.generate(10, { rarity: 'common' }));
    const removed = I.trimInventory(inv);
    ok('上限まで減る', inv.length === I.INV_MAX, inv.length);
    ok('古い LEGENDARY が残る', inv.indexOf(legend) >= 0);
    ok('ロックした COMMON が残る', inv.indexOf(locked) >= 0);
    ok('削られたのは COMMON だけ', removed.length === 12 && removed.every(it => it.rarity === 'common'));
  }

  head('[修正] ロックした装備は売却できない');
  {
    const c = boot({ seed: 97 });
    const ST = c.ST, d = ST.Save.d;
    const $ = (id) => c.document.getElementById(id);
    const a = ST.Items.generate(10, { rarity: 'common' });
    const b = ST.Items.generate(10, { rarity: 'common' });
    a.locked = true;
    d.inventory.push(a, b);
    ST.UI.show('scr-shop', true);
    $('btnSellJunk').onclick();
    $('btnSellJunk').onclick();
    ok('一括売却でロック品が残る', d.inventory.indexOf(a) >= 0 && d.inventory.indexOf(b) < 0);
    ST.UI.show('scr-hangar', true);
    $('invList').querySelectorAll('.itemrow')[0].onclick();
    ok('ロック品には売却ボタンが出ない', !$('itemDetail').innerHTML.includes('btnSell'));
    ok('ロック解除ボタンが出る', $('itemDetail').innerHTML.includes('ロック解除'));
  }
}

/* ============================================================
   8. 追加機能
   ============================================================ */
function testFeatures() {
  const { equip, runMission } = require('./sim');
  const setup = (seed, sector, diff) => {
    const c = boot({ seed: seed });
    const ST = c.ST;
    equip(ST, { level: 40, ilvl: 40, rarity: 'epic' });
    ST.Game.start(sector || 's4', diff || 'ace');
    const run = ST.Game.run;
    let t = 0;
    const step = (n) => {
      for (let i = 0; i < (n || 1); i++) {
        run.player.hp = run.player.maxHp;
        t += 1000 / 60; c._t = t;
        c._takeRaf().forEach(cb => cb(t));
      }
    };
    const type = (s) => { for (const ch of s) c.key(ch); };
    const $ = (id) => c.document.getElementById(id);
    return { c, ST, run, step, type, $, T: ST.Game._t };
  };
  /* 敵を1体出して、すぐ目標にできる状態にする */
  const spawn = (ST, run, type, boss) => {
    const e = ST.Game._t.spawnEnemy(type, 480, 200, !!boss, 1);
    e.spawnT = 0; e.seq = -1000 - run.enemies.length;
    run.target = e;
    return e;
  };
  const typeWord = (c, m) => {
    let guard = 0;
    while (!m.done && guard++ < 200) c.key(m.firstChars()[0]);
  };

  head('[機能] パリィ: 予告中に攻撃モードで単語を打ち切るとレーザーを反射する');
  {
    const { c, ST, run, T } = setup(100);
    run.mode = 'attack';
    const src = spawn(ST, run, 'drone');
    const tgt = spawn(ST, run, 'scout');
    T.fireLaser(src);
    ok('予告中のレーザーがある', run.lasers.length === 1 && !run.lasers[0].fired);
    const hp0 = src.hp;
    typeWord(c, tgt.matcher);
    ok('レーザーが消える', run.lasers.length === 0);
    ok('パリィ回数が増える', run.s.parries === 1);
    ok('撃った敵に反射ダメージ', src.dead || src.hp < hp0);
  }
  {
    const { c, ST, run, T } = setup(101);
    const src = spawn(ST, run, 'drone');
    T.fireLaser(src);
    run.mode = 'intercept';
    typeWord(c, run.ic.matcher);
    ok('迎撃ワードの完成ではパリィしない', run.lasers.length === 1 && run.s.parries === 0);
  }
  {
    const { ST, run, T } = setup(102);
    ST.Save.d.pilot.skills = { composure: 1, rhythm: 1, reflex: 3 };
    run.stats = ST.Game.computeStats();
    const src = spawn(ST, run, 'drone');
    T.fireLaser(src);
    ok('技能「反射神経」で予告が延びる', Math.abs(run.lasers[0].charge - 1.0) < 1e-6, run.lasers[0].charge);
  }

  head('[機能] 単語の仕掛け');
  {
    const { c, ST, run, T } = setup(110, 's4', 'ace');
    run.mode = 'attack';
    const b = spawn(ST, run, 'bomber');
    ok('爆撃機は分裂', b.gimmick === 'split');
    const n0 = run.enemies.filter(e => e.typeId === 'shard').length;
    typeWord(c, b.matcher);
    const shards = run.enemies.filter(e => e.typeId === 'shard' && !e.dead);
    ok('打ち切ると破片が2体出る', b.dead && shards.length === n0 + 2, shards.length);

    const ph = spawn(ST, run, 'phantom');
    ok('幽鬼は伏字', ph.gimmick === 'mask');
    const v = T.wordView(ph);
    const hidden = v.k1.slice(2);
    ok('先の2文字より後ろが隠れる', hidden.length === 0 || /^[＊* ]+$/.test(hidden), v.k1);
    ok('先の2文字は見える', v.k1.slice(0, 2) === ph.matcher.kanaParts()[1].slice(0, 2));

    const se = spawn(ST, run, 'seraph');
    ok('天輪は鏡像', se.gimmick === 'mirror' && T.wordView(se).mirror === true);

    const hx = spawn(ST, run, 'hexer');
    ok('呪縛機は時限', hx.gimmick === 'timed' && hx.wordT > 0);
    const m0 = hx.matcher;
    hx.wordT = 0.01;
    run.target = hx;
    c._t += 1000 / 60;
    c._takeRaf().forEach(cb => cb(c._t));
    ok('時間切れで単語が変わる', hx.matcher !== m0 && hx.wordT > 0);
  }
  {
    const { ST, run } = setup(111, 's4', 'novice');
    ok('NOVICE では伏字が無効', spawn(ST, run, 'phantom').gimmick === null);
    ok('NOVICE でも分裂は有効', spawn(ST, run, 'bomber').gimmick === 'split');
  }
  {
    const { ST, run, T } = setup(112, 's4', 'ace');
    const boss = spawn(ST, run, 'aegis', true);
    ok('ボスの第1フェーズは仕掛けなし', boss.gimmick === null);
    boss.phaseIdx = 1; T.assignWord(boss);
    ok('第2フェーズは伏字', boss.gimmick === 'mask');
    boss.phaseIdx = 3; T.assignWord(boss);
    ok('第4フェーズは残像', boss.gimmick === 'fade');
    ok('残像は最初は見える', !/[＊*]/.test(T.wordView(boss).k1));
    boss.fadeT = 0;
    const k1 = T.wordView(boss).k1;
    ok('時間が経つと次の1文字以外が隠れる', k1.length <= 1 || /^[＊* ]+$/.test(k1.slice(1)), k1);
  }

  head('[機能] コンボの節目で弾消しと圧力低下');
  {
    const { c, ST, run } = setup(120);
    run.mode = 'intercept';
    run.ic.word = { text: 'abc' };
    run.ic.matcher = ST.Romaji.create(run.ic.word);
    run.s.combo = 49; run.pressure = 0.5;
    c.key('a');
    ok('50コンボで圧力が下がる', Math.abs(run.pressure - 0.485) < 1e-6, run.pressure);
    run.s.combo = 52;
    const p1 = run.pressure;
    c.key('b');
    ok('節目以外では下がらない', run.pressure === p1);
  }

  head('[機能] 打鍵の分析');
  {
    const { c, ST, run, T } = setup(130);
    run.mode = 'intercept';
    run.ic.word = { kana: 'しゅ', text: 'しゅ' };
    run.ic.matcher = ST.Romaji.create(run.ic.word);
    c.key('x');
    ok('打つべきキーのミスを記録', run.rs.keys.s && run.rs.keys.s[1] === 1, JSON.stringify(run.rs.keys));
    ok('ミスしたかなを記録', run.rs.kana['しゅ'] === 1, JSON.stringify(run.rs.kana));
    ok('ミスした単語を記録', run.rs.words['しゅ'] && run.rs.words['しゅ'].n === 1);
    run.stun = 0;
    c.key('s');
    ok('正打も記録', run.rs.keys.s[0] === 1);
    T.finish(false);
    const a = ST.Save.d.analysis;
    ok('任務の終了で蓄積される', a.keys.s && a.keys.s[1] >= 1 && a.kana['しゅ'] >= 1);
  }
  {
    const ST = boot({ seed: 131 }).ST;
    const a = ST.Training.analysis(ST.Save.d);
    a.keys.z = [10, 40];
    const hasZ = (w) => (w.romaji || w.text).indexOf('z') >= 0;
    let withZ = 0, base = 0;
    for (let i = 0; i < 60; i++) {
      if (hasZ(ST.Training.pickWeak(ST.Save.d, 2, 'en'))) withZ++;
      if (hasZ(ST.Words.pick(2, 'en'))) base++;
    }
    ok('苦手克服は苦手キーを含む語を通常の3倍以上出す', withZ >= Math.max(15, base * 3), withZ + ' vs 通常 ' + base);
  }

  head('[機能] カスタム単語');
  {
    const ST = boot({ seed: 140 }).ST;
    const res = ST.Training.parseCustom([
      'こうせい,恒星,fixed star',
      'ジュウリョク,重力',
      'photosynthesis\t光合成',
      '# コメント',
      '漢字だけ',
      'こうせい',
      ''
    ].join('\n'));
    ok('有効な語を読み込む', res.words.length === 3, res.words.length);
    ok('カタカナを平仮名に直す', res.words[1].kana === 'じゅうりょく');
    ok('英語のタブ後ろを意味にする', res.words[2].text === 'photosynthesis' && res.words[2].ja === '光合成');
    ok('漢字の読みはエラー', res.errors.length === 1, res.errors.join(' / '));
    const back = ST.Training.parseCustom(ST.Training.formatCustom(res.words));
    ok('書き出して読み直しても同じ', back.words.length === 3 && back.words[0].en === 'fixed star');
  }

  head('[機能] 訓練（カスタム単語）');
  {
    const c = boot({ seed: 150 });
    const ST = c.ST, d = ST.Save.d;
    d.customWords = ST.Training.parseCustom('ほし\nつき\nそら\nうみ\nやま').words;
    const credits0 = d.pilot.credits, exp0 = d.pilot.exp;
    ST.Game.startPractice({ source: 'custom', tier: 0 });
    const run = ST.Game.run;
    const words = new Set();
    let t = 0, maxBullets = 0;
    for (let f = 0; f < 60 * 240 && ST.Game.state === 'playing'; f++) {
      if (f % 10 === 0) {
        const m = run.target && !run.target.dead ? run.target.matcher : null;
        if (m) { words.add(m.word.kana); const fc = m.firstChars(); if (fc.length) c.key(fc[0]); }
      }
      t += 1000 / 60; c._t = t;
      c._takeRaf().forEach(cb => cb(t));
      maxBullets = Math.max(maxBullets, run.lasers.length);
    }
    ok('訓練が最後まで終わる', !!run.result && run.result.practice && run.result.cleared, ST.Game.state);
    ok('カスタム単語だけが出る', [...words].every(w => ['ほし', 'つき', 'そら', 'うみ', 'やま'].indexOf(w) >= 0), [...words].join(','));
    ok('レーザーが出ない', maxBullets === 0);
    ok('被弾しない', run.s.hits === 0);
    ok('報酬なし', d.pilot.credits - credits0 === (run.result.achievements || []).reduce((s, a) => s + a.cr, 0) && d.pilot.exp === exp0);
    ok('宙域の記録に残らない', !Object.keys(d.records).some(k => k.indexOf('practice') === 0));
    ok('実績「自習」', !!d.achievements.custom);
  }

  head('[機能] デイリー任務');
  {
    const a = boot({ seed: 160 }), b = boot({ seed: 999 });
    const ca = a.ST.Training.daily('2026-10-24'), cb = b.ST.Training.daily('2026-10-24');
    ok('同じ日付なら同じ宙域', ca.sector.enemies.join() === cb.sector.enemies.join() && ca.sector.boss === cb.sector.boss);
    ok('同じ日付なら同じ補正', ca.mod.id === cb.mod.id);
    ok('同じ日付なら同じ規格機', Object.keys(ca.loadout).every(k => ca.loadout[k].name === cb.loadout[k].name));
    const other = a.ST.Training.daily('2026-10-25');
    ok('日付が変われば変わる', other.seed !== ca.seed);

    /* 異なる乱数シードの環境でも、盤面と出題の並びが一致する */
    const firstWords = (c) => {
      c.ST.Game.startDaily('2026-10-24');
      const run = c.ST.Game.run;
      let t = 0;
      for (let f = 0; f < 60 * 6; f++) {
        t += 1000 / 60; c._t = t; c._takeRaf().forEach(cb => cb(t));
      }
      return run.enemies.map(e => e.typeId + ':' + (e.word.kana || e.word.text)).join(',') + '|' +
        (run.ic.word.kana || run.ic.word.text);
    };
    const wa = firstWords(a), wb = firstWords(b);
    ok('別の環境でも敵と単語の並びが同じ', wa === wb, wa + ' / ' + wb);
    const run = a.ST.Game.run;
    ok('規格機は自分の装備を使わない', run.stats.maxHp === a.ST.Game.computeStats({ equipped: ca.loadout, level: 30, noSkills: true }).maxHp);
    a.ST.Game._t.finish(false);
    ok('記録がデイリー欄に入る', !!a.ST.Save.d.daily['2026-10-24']);
    ok('宙域の記録には入らない', !a.ST.Save.d.records['daily|ace']);
    ok('装備は落ちない', run.loot.length === 0);
  }
  {
    /* 規格機で標準的に遊んでクリアできるか */
    const keys = ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'];
    let clears = 0;
    keys.forEach((k, i) => {
      const c = boot({ seed: 170 + i });
      const ST = c.ST;
      ST.Game.startDaily(k);
      const run = ST.Game.run;
      let t = 0;
      for (let f = 0; f < 60 * 600 && ST.Game.state === 'playing'; f++) {
        if (f % 10 === 0) {
          if (run.mode === 'attack' && run.energy < run.stats.energyMax * 0.3) c.key('Tab');
          else if (run.mode === 'intercept' && run.energy > run.stats.energyMax * 0.9) c.key('Tab');
          const m = run.mode === 'intercept' ? run.ic.matcher : (run.target && !run.target.dead ? run.target.matcher : null);
          if (m) { const fc = m.firstChars(); if (fc.length) c.key(fc[0]); }
          if (run.od.ready) c.key('Enter');
        }
        t += 1000 / 60; c._t = t; c._takeRaf().forEach(cb => cb(t));
      }
      if (run.result && run.result.cleared) clears++;
    });
    ok('デイリーは6打/秒・ミス0で概ねクリアできる', clears >= 3, clears + '/4');
  }

  head('[機能] 自己ベストの区間タイム');
  {
    const { ST, run, T } = setup(180, 's1', 'pilot');
    run.splits = [10, 20, 30];
    T.finish(false);
    const g = ST.Save.d.ghosts['s1|pilot'];
    ok('初回は記録される', g && g.splits.length === 3);
  }
  {
    const c = boot({ seed: 181 });
    const ST = c.ST;
    ST.Save.d.ghosts['s1|pilot'] = { splits: [10, 20, 30] };
    ST.Game.start('s1', 'pilot');
    const run = ST.Game.run;
    run.splits = [9, 18, 33];
    ST.Game._t.finish(false);
    ok('同じ区間数で遅ければ更新しない', ST.Save.d.ghosts['s1|pilot'].splits[2] === 30);
    ok('差がリザルトに出る', Math.abs(run.result.ghostDelta - 3) < 1e-6, run.result.ghostDelta);
    ST.Game.start('s1', 'pilot');
    ST.Game.run.splits = [9, 18, 27, 40];
    ST.Game._t.finish(false);
    ok('区間を多く進めたら更新', ST.Save.d.ghosts['s1|pilot'].splits.length === 4);
  }

  head('[機能] 技能');
  {
    const ST = boot({ seed: 190 }).ST;
    const p = ST.Save.d.pilot;
    ok('新規セーブは0ポイント', p.statPoints === 0 && p.skillsInit);
    ST.Growth.gainExp(p, ST.Growth.expToNext(1) + 1);
    ok('レベルアップで1ポイント', p.statPoints === 1, p.statPoints);
    ok('前提のない技能は覚えられる', ST.Skills.canLearn(p, 'gunnery'));
    ok('前提が未習得だと覚えられない', !ST.Skills.canLearn(p, 'finisher'));
    p.statPoints = 10;
    const a0 = ST.Game.computeStats().atk;
    for (let i = 0; i < 5; i++) ST.Skills.learn(p, 'gunnery');
    const a1 = ST.Game.computeStats().atk;
    ok('砲撃強化5で砲撃力 +15%', Math.abs(a1 / a0 - 1.15) < 1e-6, (a1 / a0).toFixed(4));
    ok('最大ランクを超えない', !ST.Skills.learn(p, 'gunnery'));
    for (let i = 0; i < 5; i++) ST.Skills.learn(p, 'hull');
    p.credits = 99999;
    ok('振り直しで全ポイントが戻る', ST.Skills.respec(p) && p.statPoints === 10 && ST.Skills.spent(p) === 0);
  }
  {
    /* 技能導入前のセーブ: 過去のレベル分を配る */
    const a = boot({ seed: 191 });
    const b = build({ seed: 191 });
    b._store['spacetyping.save.v1'] = JSON.stringify({ version: 1, pilot: { level: 25, exp: 0, credits: 0, statPoints: 0 } });
    b.loadAll();
    ok('旧セーブにレベル-1ポイント', b.ST.Save.d.pilot.statPoints === 24, b.ST.Save.d.pilot.statPoints);
    void a;
  }

  head('[機能] 実績');
  {
    const ST = boot({ seed: 200 }).ST;
    const d = ST.Save.d;
    const cr0 = d.pilot.credits;
    const res = {
      cleared: true, hits: 0, miss: 0, combo: 120, kps: 6, rank: 'S', parries: 0, odUsed: 1,
      sector: ST.Sectors.map.s2, diff: ST.Difficulty.get('pilot'), wave: 6, loot: []
    };
    const got = ST.Achievements.check(res, null, d).map(a => a.id).sort();
    ok('条件を満たした実績が解除される', ['combo100', 'first_clear', 'no_hit', 'perfect'].every(x => got.indexOf(x) >= 0), got.join(','));
    ok('満たさない実績は解除されない', got.indexOf('no_od') < 0 && got.indexOf('combo300') < 0);
    ok('報酬が入る', d.pilot.credits > cr0);
    ok('2回目は解除されない', ST.Achievements.check(res, null, d).length === 0);
  }

  head('[機能] 画面の組み立て');
  {
    const c = boot({ seed: 210 });
    const ST = c.ST;
    const $ = (id) => c.document.getElementById(id);
    ST.Save.d.progress.clearedSectors.s1 = 3;
    let threw = null;
    ['scr-title', 'scr-daily', 'scr-training', 'scr-analysis', 'scr-skills', 'scr-achieve', 'scr-hangar', 'scr-help']
      .forEach(id => { try { ST.UI.show(id, true); } catch (e) { threw = id + ': ' + e.message; } });
    ok('新しい画面がエラーなく組み上がる', !threw, threw);
    ok('タイトルにデイリーと訓練がある', $('titleMenu')._children.some(b => b.textContent.indexOf('DAILY') >= 0) &&
      $('titleMenu')._children.some(b => b.textContent.indexOf('TRAINING') >= 0));
    ST.UI.show('scr-training', true);
    $('customText').value = 'ほし\nつき';
    $('btnCustomSave').onclick();
    ok('訓練画面からカスタム単語を保存できる', ST.Save.d.customWords.length === 2);
    ST.Save.d.pilot.statPoints = 1;
    ST.UI.show('scr-skills', true);
    const sk = $('skillsBody').querySelectorAll('.skill').find(x => x.dataset.skill === 'gunnery');
    sk.onclick && sk.onclick();
    ok('技能画面から習得できる', ST.Save.d.pilot.skills.gunnery === 1);
  }
  void runMission;
}

/* ============================================================
   実行
   ============================================================ */
const SUITES = { romaji: testRomaji, play: testPlay, render: testRender, ui: testUI, controls: testControls, jitter: testJitter, fixes: testFixes, features: testFeatures };
const arg = (process.argv[2] || 'all').toLowerCase();
const list = arg === 'all' ? Object.keys(SUITES) : [arg];

if (list.some(k => !SUITES[k])) {
  console.error('使い方: node tools/test.js [all|' + Object.keys(SUITES).join('|') + ']');
  process.exit(2);
}
const t0 = Date.now();
list.forEach(k => SUITES[k]());
console.log('\n' + (failures === 0
  ? '=== 全通過 (' + ((Date.now() - t0) / 1000).toFixed(1) + '秒) ==='
  : '=== ' + failures + ' 件失敗 ==='));
process.exit(failures === 0 ? 0 : 1);
