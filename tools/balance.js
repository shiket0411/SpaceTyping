/* ============================================================
   SpaceTyping バランス計測

   使い方:
     node tools/balance.js clear   [試行回数] [ミス率]  難易度ごとのクリア率
     node tools/balance.js style   [秒数]       立ち回り3種の比較
     node tools/balance.js energy  [試行回数]   迎撃エネルギーの収支
     node tools/balance.js boss    [試行回数]   ボス戦の所要単語数
     node tools/balance.js laser                圧力とレーザー致死力の表（実測なし）
     node tools/balance.js gear    [試行回数]   レアリティ別の装備性能
     node tools/balance.js sweep   NAME=a,b,c   パラメータを振ってクリア率を比較

   すべてシード固定なので、同じ引数なら結果は完全に再現します。
   ============================================================ */
'use strict';
const { boot } = require('./harness');
const { runMission, repeat, equip, pad, padEnd, pct } = require('./sim');

const KPS = 5.75;   /* 約69WPM。実プレイの基準にしている打鍵速度 */

/* 「その装備でその宙域に挑む」典型的な組み合わせ。
   slots を省略すると5スロット全て埋めた完成形。
   スロットが1つ空くだけで体感が大きく変わるので、比較用の4個構成も入れてある。 */
const FOUR = ['weapon', 'core', 'armor', 'module1'];
const LADDER = [
  ['s1/NOVICE    LV5  Common ', { sector: 's1', diff: 'novice', level: 5, ilvl: 3, rarity: 'common' }],
  ['s1/PILOT     LV8  Uncommon', { sector: 's1', diff: 'pilot', level: 8, ilvl: 5, rarity: 'uncommon' }],
  ['s3/PILOT     LV16 Uncommon', { sector: 's3', diff: 'pilot', level: 16, ilvl: 14, rarity: 'uncommon' }],
  ['s4/CADET     LV20 Uncommon', { sector: 's4', diff: 'cadet', level: 20, ilvl: 18, rarity: 'uncommon' }],
  ['s4/ACE       LV24 Rare   ', { sector: 's4', diff: 'ace', level: 24, ilvl: 21, rarity: 'rare' }],
  ['s6/VETERAN   LV30 Epic   ', { sector: 's6', diff: 'veteran', level: 30, ilvl: 30, rarity: 'epic' }],
  ['s6/VETERAN   LV34 Legend ', { sector: 's6', diff: 'veteran', level: 34, ilvl: 34, rarity: 'legendary' }],
  ['s8/NIGHTMARE LV30 Legend ', { sector: 's8', diff: 'nightmare', level: 30, ilvl: 35, rarity: 'legendary' }],
  ['s8/NIGHTMARE LV70 Legend ', { sector: 's8', diff: 'nightmare', level: 70, ilvl: 60, rarity: 'legendary' }],
  ['s8/SINGULAR. LV30 Legend ', { sector: 's8', diff: 'singularity', level: 30, ilvl: 35, rarity: 'legendary' }],
  ['s8/SINGULAR. LV70 Legend ', { sector: 's8', diff: 'singularity', level: 70, ilvl: 60, rarity: 'legendary' }],
  ['s8/NIGHTMARE LV30 Leg x4 ', { sector: 's8', diff: 'nightmare', level: 30, ilvl: 35, rarity: 'legendary', slots: FOUR }],
  ['s8/SINGULAR. LV30 Leg x4 ', { sector: 's8', diff: 'singularity', level: 30, ilvl: 35, rarity: 'legendary', slots: FOUR }]
];

/* ------------------------------------------------------------
   clear: 難易度ごとのクリア率
   ------------------------------------------------------------ */
function cmdClear(n, miss, overrides) {
  n = n || 16;
  miss = isFinite(miss) ? miss : 0;   /* 未指定なら 0（調整時の基準） */
  console.log('打鍵 ' + KPS + '/秒 (約' + Math.round(KPS * 12) + 'WPM) / ミス率 ' +
    (miss * 100).toFixed(0) + '% / 各' + n + '回 / シード固定');
  console.log('※ ミス率0%が調整時の基準。README の数値はこの条件で計測している。');
  if (overrides) console.log('override: ' + JSON.stringify(overrides));
  console.log('');
  console.log('条件                        クリア率  平均最低HP  被弾  攻撃滞在  最大圧力  平均秒');
  const out = [];
  LADDER.forEach(([label, o]) => {
    const r = repeat(n, Object.assign({ kps: KPS, missRate: miss, overrides }, o));
    out.push([label, r]);
    console.log(padEnd(label, 27) +
      pad(r.clears + '/' + n, 8) + pct(r.minHpPct, 12) + pad(Math.round(r.hits), 6) +
      pct(r.attackPct, 10) + pct(r.pressureMax, 10) + pad(Math.round(r.seconds), 8));
  });
  return out;
}

/* ------------------------------------------------------------
   style: 立ち回りの比較（篭る / 切替 / 攻め続ける）
   ------------------------------------------------------------ */
function cmdStyle(secs) {
  secs = secs || 90;
  const base = { sector: 's5', diff: 'ace', level: 30, ilvl: 35, rarity: 'legendary', kps: KPS, godMode: true, maxSeconds: secs };
  console.log('s5/ACE を ' + secs + '秒 / LV30 Legendary / godMode（被弾数を数えるため死なない）');
  console.log('');
  console.log('立ち回り            最終圧力  撃破  被弾  レーザー着弾  到達ウェーブ');
  [['camp', '迎撃モードに篭る'], ['balanced', 'エネルギーで切替'], ['rush', '攻撃モードに固定']]
    .forEach(([policy, label]) => {
      const r = runMission(Object.assign({}, base, { policy, seed: 500 }));
      console.log(padEnd(label, 20) + pct(r.pressureMax, 8) + pad(r.kills, 6) +
        pad(r.hits, 6) + pad(r.lasers, 14) + pad(r.wave, 14));
    });
  console.log('\n篭ると撃破が止まって任務が終わらず、高い圧力のままレーザーを浴び続けることになる。');
}

/* ------------------------------------------------------------
   energy: 迎撃エネルギーの収支
   ------------------------------------------------------------ */
function cmdEnergy(n) {
  n = n || 4;
  const CASES = [
    ['s1/PILOT      ', { sector: 's1', diff: 'pilot', level: 8, ilvl: 5, rarity: 'uncommon' }],
    ['s4/ACE        ', { sector: 's4', diff: 'ace', level: 24, ilvl: 21, rarity: 'rare' }],
    ['s6/VETERAN    ', { sector: 's6', diff: 'veteran', level: 34, ilvl: 34, rarity: 'legendary' }],
    ['s8/NIGHTMARE  ', { sector: 's8', diff: 'nightmare', level: 70, ilvl: 60, rarity: 'legendary' }]
  ];
  console.log('攻撃モードに居座り続けた場合と、エネルギーを見て切り替えた場合の比較（各' + n + '回）');
  console.log('');
  console.log('条件            立ち回り   攻撃滞在  枯渇時間  被弾  最低HP   容量  1発  満タンで');
  CASES.forEach(([label, o]) => {
    [['rush', '攻め固定'], ['balanced', '切替あり']].forEach(([policy, pl]) => {
      const r = repeat(n, Object.assign({ kps: KPS, policy, godMode: true, maxSeconds: 150 }, o));
      const s = r.runs[0].stats;
      console.log(padEnd(label, 16) + padEnd(pl, 10) +
        pct(r.attackPct, 9) + pct(r.overloadPct, 10) + pad(Math.round(r.hits), 6) +
        pct(r.minHpPct, 8) + pad(s.energyMax, 7) + pad(s.interceptCost.toFixed(1), 5) +
        pad(Math.floor(s.energyMax / s.interceptCost) + '発', 8));
    });
  });
}

/* ------------------------------------------------------------
   boss: ボス戦の所要単語数
   ------------------------------------------------------------ */
function cmdBoss(n) {
  n = n || 3;
  const ST = boot({ seed: 1 }).ST;
  console.log('各宙域のボスを「その宙域相当の装備」で倒すのに要する単語数（各' + n + '回）');
  console.log('');
  console.log('宙域 ボス              所要単語  想定打鍵  60WPMなら  設計目標');

  ST.Sectors.list.forEach(s => {
    let words = 0, keys = 0;
    for (let i = 0; i < n; i++) {
      const r = runMission({
        sector: s.id, diff: 'pilot', level: Math.max(1, Math.round(s.ilvl * 1.15)),
        ilvl: s.ilvl, rarity: 'rare', kps: KPS, toBoss: true, missRate: 0, seed: 800 + i, maxSeconds: 400
      });
      words += r.words; keys += r.keys;
    }
    const w = words / n, k = keys / n;
    /* 設計目標 = ボス定義の想定単語数 x 宙域ごとの倍率 */
    const scale = (ST.EnemyTypes.BOSS[s.boss].words || 10) * (s.bossScale || 1);
    console.log(pad(s.num, 3) + ' ' + padEnd(ST.EnemyTypes.BOSS[s.boss].name, 16) +
      pad(w.toFixed(1) + '語', 9) + pad(Math.round(k) + '打', 10) +
      pad(Math.round(k / 5) + '秒', 11) + pad(scale.toFixed(1) + '語', 10));
  });
}

/* ------------------------------------------------------------
   laser: 圧力に対するレーザーの致死力（式から算出）
   ------------------------------------------------------------ */
function cmdLaser() {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js/game.js'), 'utf8');
  const num = (name) => parseFloat((src.match(new RegExp('var ' + name + ' = ([0-9.]+)')) || [])[1]);
  const B = num('LASER_BASE'), C = num('LASER_CURVE'), D = num('LASER_DMG'), R = num('LASER_RAMP');
  const ST = boot({ seed: 1 }).ST;
  console.log('LASER_BASE=' + B + ' LASER_CURVE=' + C + ' LASER_DMG=' + D + ' LASER_RAMP=' + R);
  console.log('間隔 = ' + B + ' / (0.25 + 圧力^2 x ' + C + ' x 難易度係数),  威力 = ' + D + ' x (1 + 圧力 x ' + R + ')');
  console.log('');
  const diffs = ST.Difficulty.list.filter(d => ['pilot', 'ace', 'veteran', 'nightmare', 'singularity'].indexOf(d.id) >= 0);
  process.stdout.write('圧力  ');
  diffs.forEach(d => process.stdout.write(padEnd(d.name, 14)));
  console.log('');
  process.stdout.write('      ');
  diffs.forEach(() => process.stdout.write('間隔    毎秒  '));
  console.log('');
  [0, 0.25, 0.5, 0.75, 0.9, 1].forEach(pr => {
    process.stdout.write(pad(Math.round(pr * 100) + '%', 4) + '  ');
    diffs.forEach(d => {
      const iv = B / (0.25 + pr * pr * C * d.laser);
      const dmg = D * (1 + pr * R);
      process.stdout.write(pad(iv.toFixed(1) + 's', 6) + pad(Math.round(dmg / iv), 6) + '  ');
    });
    console.log('');
  });
  console.log('\n毎秒ダメージは難易度の被害倍率を掛けない生値。障壁と被害軽減で実際はもう少し下がる。');
}

/* ------------------------------------------------------------
   gear: レアリティ別の装備性能
   ------------------------------------------------------------ */
function cmdGear(n) {
  n = n || 200;
  const ilvl = 38;
  console.log('ilvl' + ilvl + ' の装備を5スロット揃えたときの性能（各' + n + '回, 中央値）');
  console.log('');
  console.log('レアリティ    砲撃力   装甲値  迎撃容量  1発消費  満タンで  障壁  被害軽減');
  ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].forEach(rar => {
    const rows = [];
    for (let i = 0; i < n; i++) {
      const c = boot({ seed: 3000 + i });
      const ST = c.ST;
      equip(ST, { level: 44, ilvl, rarity: rar });
      const st = ST.Game.computeStats();
      rows.push(st);
    }
    const med = (f) => {
      const a = rows.map(f).sort((x, y) => x - y);
      return a[Math.floor(a.length / 2)];
    };
    console.log(padEnd(rar, 13) +
      pad(med(s => s.atk).toFixed(0), 6) + pad(med(s => s.maxHp).toFixed(0), 9) +
      pad(med(s => s.energyMax).toFixed(0), 10) + pad(med(s => s.interceptCost).toFixed(1), 9) +
      pad(Math.floor(med(s => s.energyMax / s.interceptCost)) + '発', 10) +
      pad(med(s => s.shieldMax).toFixed(0), 6) + pad(med(s => s.def).toFixed(0) + '%', 10));
  });
}

/* ------------------------------------------------------------
   sweep: パラメータを振ってクリア率を比較
   ------------------------------------------------------------ */
function cmdSweep(spec, n) {
  n = n || 8;
  const m = /^([A-Z_]+)=(.+)$/.exec(spec || '');
  if (!m) {
    console.error('例: node tools/balance.js sweep LASER_BASE=4,5,7');
    process.exit(2);
  }
  const name = m[1];
  const values = m[2].split(',').map(v => parseFloat(v));
  const CASES = LADDER.filter(([l]) => /ACE|VETERAN   LV30|NIGHTMARE LV30|SINGULAR. LV30/.test(l));
  console.log(name + ' を ' + values.join(' / ') + ' で比較（各' + n + '回 / シード固定）\n');
  console.log(padEnd('条件', 27) + values.map(v => pad(name.slice(0, 6) + '=' + v, 14)).join(''));
  CASES.forEach(([label, o]) => {
    let line = padEnd(label, 27);
    values.forEach(v => {
      const ov = {}; ov[name] = v;
      const r = repeat(n, Object.assign({ kps: KPS, missRate: 0, overrides: ov }, o));
      line += pad(r.clears + '/' + n + ' HP' + Math.round(r.minHpPct) + '%', 14);
    });
    console.log(line);
  });
  console.log('\n※ ソースは書き換えません。定数はメモリ上でのみ差し替えています。');
}

/* ------------------------------------------------------------ */
const cmd = (process.argv[2] || 'clear').toLowerCase();
const arg = process.argv[3];
const t0 = Date.now();
switch (cmd) {
  case 'clear': cmdClear(parseInt(arg, 10) || 16, parseFloat(process.argv[4])); break;
  case 'style': cmdStyle(parseInt(arg, 10) || 90); break;
  case 'energy': cmdEnergy(parseInt(arg, 10) || 4); break;
  case 'boss': cmdBoss(parseInt(arg, 10) || 3); break;
  case 'laser': cmdLaser(); break;
  case 'gear': cmdGear(parseInt(arg, 10) || 200); break;
  case 'sweep': cmdSweep(arg, parseInt(process.argv[4], 10) || 8); break;
  default:
    console.error('使い方: node tools/balance.js [clear|style|energy|boss|laser|gear|sweep]');
    process.exit(2);
}
console.log('\n(' + ((Date.now() - t0) / 1000).toFixed(1) + '秒)');
