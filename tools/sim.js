/* ============================================================
   SpaceTyping シミュレーション補助

   仮想プレイヤーにミッションを走らせて結果を集計する。
   打鍵速度は「1秒あたりの打鍵数」で指定する（WPM = 打鍵数 x 12 が目安）。
   ============================================================ */
'use strict';
const { boot } = require('./harness');

const FRAME = 1000 / 60;

/* 装備のレアリティ分布。プレイヤーは手持ちのベストを装備するので実ドロップより上振れさせる */
function pickRarity(rnd) {
  const r = rnd();
  if (r < 0.02) return 'legendary';
  if (r < 0.14) return 'epic';
  if (r < 0.48) return 'rare';
  return 'uncommon';
}

/**
 * パイロットと装備を用意する。
 * @param {object} ST
 * @param {object} g  {level, ilvl, rarity|'mixed', slots}
 */
function equip(ST, g) {
  const d = ST.Save.d;
  d.pilot.level = g.level;
  d.pilot.credits = 99999;
  const slots = g.slots || ['weapon', 'core', 'armor', 'module1', 'module2'];
  const kind = { weapon: 'weapon', core: 'core', armor: 'armor', module1: 'module', module2: 'module' };
  slots.forEach(s => {
    const rar = g.rarity === 'mixed' ? pickRarity(Math.random) : g.rarity;
    d.equipped[s] = ST.Items.generate(g.ilvl, { slot: kind[s], rarity: rar });
  });
  /* 全宙域・全難易度を解放しておく */
  ST.Sectors.list.forEach(s => { d.progress.clearedSectors[s.id] = 7; });
  return d;
}

/**
 * 仮想プレイヤーの立ち回り。
 *  balanced : エネルギー残量を見て攻撃/迎撃を切り替える（標準的な上手いプレイ）
 *  camp     : 迎撃モードに篭る
 *  rush     : 攻撃モードに固定する
 */
function decideMode(policy, run, st, key) {
  /* モード切替は TAB。SPACE は英文のスペースを打つ通常キーになった。 */
  const toggle = () => key('Tab');
  if (policy === 'camp') { if (run.mode !== 'intercept') toggle(); return; }
  if (policy === 'rush') { if (run.mode !== 'attack') toggle(); return; }
  const low = run.energy < st.energyMax * 0.3;
  const full = run.energy > st.energyMax * 0.9;
  if (run.mode === 'attack' && low) toggle();
  else if (run.mode === 'intercept' && full) toggle();
}

function wrongChar(valid, rnd) {
  const all = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < 40; i++) {
    const ch = all[Math.floor(rnd() * all.length)];
    if (valid.indexOf(ch) < 0) return ch;
  }
  return 'q';
}

/**
 * 1ミッションを走らせる。
 *
 * @param {object} o
 *   sector, diff        : 宙域ID / 難易度ID
 *   level, ilvl, rarity : 装備条件
 *   kps                 : 1秒あたりの打鍵数（既定 5.75 ≒ 69WPM）
 *   policy              : 'balanced' | 'camp' | 'rush'
 *   missRate            : ミス率（既定 0.05）
 *   maxSeconds          : 打ち切り秒数（既定 700）
 *   seed                : 乱数シード（指定すると完全に再現される）
 *   overrides           : game.js の定数差し替え
 *   godMode             : true なら毎フレームHP全回復（被弾数だけ数えたいとき）
 *   toBoss              : true ならウェーブを飛ばして即ボス戦
 * @returns 集計結果
 */
function runMission(o) {
  const opt = Object.assign({
    kps: 5.75, policy: 'balanced', missRate: 0.05, maxSeconds: 700
  }, o);

  const c = boot({ seed: opt.seed, overrides: opt.overrides });
  const ST = c.ST;
  const rnd = c.Math.random;
  equip(ST, opt);

  const sector = ST.Sectors.map[opt.sector];
  ST.Game.start(opt.sector, opt.diff);
  const run = ST.Game.run;
  const st = run.stats;
  if (opt.toBoss && !sector.endless) {
    run.waveIdx = sector.waves; run.waveState = 'boss'; run.waveStateT = 0.01;
  }

  const every = Math.max(1, Math.round(60 / opt.kps));
  const maxFrames = Math.round(opt.maxSeconds * 60);
  let t = 0, f = 0;
  let atkFrames = 0, overloadFrames = 0;
  let minHp = run.player.maxHp, maxPressure = 0, sumPressure = 0;
  let keys = 0, spaces = 0, lasersFired = 0;
  const seenLasers = new Set();

  for (; f < maxFrames; f++) {
    if (ST.Game.state !== 'playing') break;

    if (f % every === 0) {
      decideMode(opt.policy, run, st, c.key);
      const m = run.mode === 'intercept'
        ? run.ic.matcher
        : (run.target && !run.target.dead ? run.target.matcher : null);
      if (m) {
        const fc = m.firstChars();
        if (fc.length) {
          /* 人間は入力方式が一貫しているので、候補は常に先頭（最短経路）を選ぶ。
             毎回ランダムに選ぶと shi/si のような長い経路を踏んで所要打鍵が膨らむ。 */
          if (rnd() < opt.missRate) c.key(wrongChar(fc, rnd));
          else c.key(fc[0]);
          keys++;
        }
      }
      if (run.od.ready) c.key('Enter');
    }

    atkFrames += run.mode === 'attack' ? 1 : 0;
    if (run.overload) overloadFrames++;
    if (run.player.hp < minHp) minHp = run.player.hp;
    if (run.pressure > maxPressure) maxPressure = run.pressure;
    sumPressure += run.pressure;
    for (const L of run.lasers) if (L.fired && !seenLasers.has(L)) { seenLasers.add(L); lasersFired++; }
    if (opt.godMode || opt.toBoss) run.player.hp = run.player.maxHp;

    t += FRAME; c._t = t;
    c._takeRaf().forEach(cb => cb(t));
  }

  const res = run.result;
  const total = Math.max(1, f);
  return {
    cleared: res ? res.cleared : null,
    rank: res ? res.rank : '-',
    score: run.s.score,
    hits: run.s.hits,
    kills: run.s.kills,
    words: run.s.words,
    intercepts: run.s.intercepts,
    lasers: lasersFired,
    accuracy: run.s.correct + run.s.miss ? Math.round(run.s.correct / (run.s.correct + run.s.miss) * 100) : 100,
    minHpPct: Math.round(minHp / run.player.maxHp * 100),
    attackPct: Math.round(atkFrames / total * 100),
    overloadPct: Math.round(overloadFrames / total * 100),
    pressureAvg: Math.round(sumPressure / total * 100),
    pressureMax: Math.round(maxPressure * 100),
    wave: run.waveIdx + 1,
    seconds: Math.round(f / 60),
    keys,
    stats: {
      atk: st.atk, maxHp: run.player.maxHp, energyMax: st.energyMax,
      interceptCost: st.interceptCost, shieldMax: st.shieldMax,
      shieldRegen: st.shieldRegen, def: st.def
    },
    _ctx: c
  };
}

/** 同一条件を n 回（シードを変えて）走らせて平均を取る */
function repeat(n, o, baseSeed) {
  const runs = [];
  for (let i = 0; i < n; i++) {
    runs.push(runMission(Object.assign({}, o, { seed: (baseSeed === undefined ? 1000 : baseSeed) + i })));
  }
  const avg = (k) => runs.reduce((s, r) => s + (r[k] || 0), 0) / n;
  return {
    n,
    clears: runs.filter(r => r.cleared).length,
    hits: avg('hits'), minHpPct: avg('minHpPct'),
    attackPct: avg('attackPct'), overloadPct: avg('overloadPct'),
    pressureAvg: avg('pressureAvg'), pressureMax: avg('pressureMax'),
    kills: avg('kills'), lasers: avg('lasers'), seconds: avg('seconds'),
    runs
  };
}

/* 表示ヘルパ。日本語は全角なので、桁合わせは表示幅で行う。 */
function width(s) {
  let w = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    w += (c >= 0x1100 && (c <= 0x115f || (c >= 0x2e80 && c <= 0xa4cf) ||
      (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6))) ? 2 : 1;
  }
  return w;
}
const pad = (v, n) => ' '.repeat(Math.max(0, n - width(v))) + String(v);
const padEnd = (v, n) => String(v) + ' '.repeat(Math.max(0, n - width(v)));
const pct = (v, n) => pad(Math.round(v) + '%', n);

module.exports = { runMission, repeat, equip, pickRarity, pad, padEnd, pct, width, FRAME };
