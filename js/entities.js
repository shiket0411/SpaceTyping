/* ============================================================
   SPACE TYPING - entities.js
   敵アーキタイプ / 弾幕パターン / 移動スクリプト
   ============================================================ */
ST.Patterns = (function () {
  var U = ST.U;
  var TAU = U.TAU;

  /* 共通ヘルパ: 敵から弾を1発 */
  function shoot(g, e, ang, spd, opt) {
    opt = opt || {};
    var b = g.newBullet();
    if (!b) return null;
    b.x = e.x + (opt.ox || 0); b.y = e.y + (opt.oy || 0);
    var s = spd * g.diff.bulletSpeed * (1 - g.stats.bulletSlow / 100);
    b.vx = Math.cos(ang) * s;
    b.vy = Math.sin(ang) * s;
    b.r = opt.r || 6;
    b.color = opt.color || e.color || '#ff4dd2';
    b.kind = opt.kind || 'orb';
    b.ang = ang;
    b.spin = opt.spin || 0;
    b.accel = opt.accel || 0;
    /* 難易度に応じて、通常弾もわずかに自機へ寄る。
        全方位にばら撒くパターンでも「当たらないから安全」ではなくなる。 */
    b.homing = opt.homing || (g.diff.homing || 0);
    b.life = opt.life || 14;
    b.age = 0;
    b.split = opt.split || 0;
    b.splitT = opt.splitT || 0;
    b.dmg = opt.dmg || 1;
    b.grazed = false;
    b.code = null;
    return b;
  }

  function aimAng(g, e) { return U.angleTo(e.x, e.y, g.player.x, g.player.y); }

  /* 難易度による弾数スケール */
  function nOf(g, base) { return Math.max(1, Math.round(base * g.diff.bulletCount)); }

  var P = {
    /* 自機狙い n way */
    aimed: function (g, e, p) {
      var n = nOf(g, p.n || 1);
      var spread = (p.spread || 0.28);
      var a0 = aimAng(g, e) - spread * (n - 1) / 2;
      for (var i = 0; i < n; i++) {
        shoot(g, e, a0 + spread * i, p.spd || 190, p);
      }
    },
    /* 全方位リング */
    ring: function (g, e, p) {
      var n = nOf(g, p.n || 12);
      var off = (p.off || 0) + (p.aim ? aimAng(g, e) : 0) + e.t * (p.rot || 0);
      for (var i = 0; i < n; i++) shoot(g, e, off + TAU * i / n, p.spd || 130, p);
    },
    /* 回転する腕（スパイラル）。aim を付けると自機方向を基準に回る */
    spiral: function (g, e, p) {
      var arms = p.arms || 2;
      var rot = e.fireCount * (p.step || 0.42) + (p.aim ? aimAng(g, e) : 0);
      for (var i = 0; i < arms; i++) shoot(g, e, rot + TAU * i / arms, p.spd || 145, p);
    },
    /* 自機狙い扇 */
    fan: function (g, e, p) {
      var n = nOf(g, p.n || 7);
      var arc = p.arc || 1.1;
      var a0 = aimAng(g, e) - arc / 2;
      for (var i = 0; i < n; i++) shoot(g, e, a0 + arc * i / Math.max(1, n - 1), p.spd || 165, p);
    },
    /* 隙間つきの弾幕壁 */
    wall: function (g, e, p) {
      var n = nOf(g, p.n || 16);
      var gap = U.randInt(1, n - 2);
      var gw = p.gap || 2;
      for (var i = 0; i < n; i++) {
        if (i >= gap && i < gap + gw) continue;
        var b = shoot(g, e, Math.PI / 2, p.spd || 120, p);
        if (b) { b.x = 40 + (880 * i / (n - 1)); b.y = e.y; }
      }
    },
    /* 交互にずれる二重リング */
    burstRing: function (g, e, p) {
      var n = nOf(g, p.n || 10);
      var half = ((e.fireCount % 2) ? TAU / n / 2 : 0) + (p.aim ? aimAng(g, e) : 0);
      for (var i = 0; i < n; i++) {
        shoot(g, e, half + TAU * i / n, p.spd || 120, p);
        shoot(g, e, half + TAU * i / n, (p.spd || 120) * 1.5, p);
      }
    },
    /* 花弁状 */
    flower: function (g, e, p) {
      var petals = p.petals || 5;
      var per = nOf(g, p.n || 5);
      var base = e.t * (p.rot || 0.5);
      for (var i = 0; i < petals; i++) {
        var c = base + TAU * i / petals;
        for (var j = 0; j < per; j++) {
          shoot(g, e, c + (j - (per - 1) / 2) * 0.11, (p.spd || 110) + j * 14, p);
        }
      }
    },
    /* 追尾弾 */
    seeker: function (g, e, p) {
      var n = nOf(g, p.n || 3);
      for (var i = 0; i < n; i++) {
        shoot(g, e, aimAng(g, e) + U.rand(-0.9, 0.9), p.spd || 95,
          { r: p.r || 7, color: p.color, kind: 'seeker', homing: p.homing || 1.5, life: p.life || 9, dmg: p.dmg });
      }
    },
    /* レーザー掃射（細長い高速弾） */
    sweep: function (g, e, p) {
      var n = nOf(g, p.n || 5);
      var a = aimAng(g, e) + (e.fireCount % 2 ? 1 : -1) * (p.off || 0.5) - e.fireCount * 0.06;
      for (var i = 0; i < n; i++) {
        shoot(g, e, a, (p.spd || 340) + i * 26, { r: p.r || 4, color: p.color, kind: 'shard', dmg: p.dmg });
      }
    },
    /* 上空からの雨 */
    rain: function (g, e, p) {
      var n = nOf(g, p.n || 6);
      for (var i = 0; i < n; i++) {
        var b = shoot(g, e, Math.PI / 2 + U.rand(-0.25, 0.25), p.spd || 150, p);
        if (b) { b.x = U.rand(30, 930); b.y = -12; }
      }
    },
    /* 分裂弾 */
    seed: function (g, e, p) {
      var n = nOf(g, p.n || 3);
      var a0 = aimAng(g, e) - 0.5;
      for (var i = 0; i < n; i++) {
        shoot(g, e, a0 + i * 0.5, p.spd || 100,
          { r: 9, color: p.color || '#ffc24d', kind: 'seed', split: p.split || 8, splitT: p.splitT || 1.1, dmg: p.dmg });
      }
    },
    /* 十字 */
    cross: function (g, e, p) {
      var arms = 4, per = nOf(g, p.n || 4);
      var base = e.t * (p.rot || 1.2);
      for (var i = 0; i < arms; i++) {
        for (var j = 1; j <= per; j++) {
          shoot(g, e, base + TAU * i / arms, (p.spd || 90) + j * 34, p);
        }
      }
    },
    /* 加速する遅延弾 */
    delay: function (g, e, p) {
      var n = nOf(g, p.n || 14);
      for (var i = 0; i < n; i++) {
        shoot(g, e, TAU * i / n + e.t, p.spd || 40, { r: 7, color: p.color, accel: p.accel || 130, life: 12, dmg: p.dmg });
      }
    }
  };

  return { fns: P, shoot: shoot, aimAng: aimAng };
})();


/* ============================================================
   移動スクリプト
   ============================================================ */
ST.Moves = (function () {
  var U = ST.U;
  var SETTLE = 0.8;   /* 定位パターンへ馴染ませる秒数。短いと軌道が遠い個体が滑り込みで飛んで見える */

  /* 降下フェーズ。定位高度に達したらパターン専用の時計 holdT を 0 から回し、
     入りの座標を控える。位相を敵の生存時間 e.t ではなく holdT に取ることで、
     定位に切り替わる瞬間に sin() が飛んで座標がワープするのを防ぐ。
     戻り値が false の間はまだ降下中。 */
  function enterHold(e, dt) {
    if (!e.held) {
      if (e.y < e.holdY) { e.y += e.spd * dt; return false; }
      e.held = true; e.holdT = 0; e.settle = 1;
      e.sx = e.x; e.sy = e.y; e.px = e.x;
    }
    e.holdT += dt;
    if (e.settle > 0) e.settle = Math.max(0, e.settle - dt / SETTLE);
    return true;
  }

  /* パターンが示す座標へ配置する。定位直後は入りの座標から SETTLE 秒かけて
     寄せるので、位相を揃えきれない軌道(orbit)でも位置が飛ばない。 */
  function place(e, tx, ty) {
    var k = e.settle;
    if (k > 0) {
      var s = k * k * (3 - 2 * k);            /* 両端で速度が滑らかになるよう補間 */
      e.x = tx + (e.sx - tx) * s;
      e.y = ty + (e.sy - ty) * s;
    } else { e.x = tx; e.y = ty; }
  }

  return {
    dive: function (e, dt) { e.y += e.spd * dt; },
    sine: function (e, dt) {
      e.y += e.spd * dt;
      e.x = e.baseX + Math.sin(e.t * (e.freq || 1.8)) * (e.amp || 110);
    },
    hover: function (e, dt) {
      if (!enterHold(e, dt)) return;
      place(e, e.baseX + Math.sin(e.holdT * 0.7) * (e.amp || 60),
        e.holdY + Math.sin(e.holdT * 1.1) * 12);
    },
    strafe: function (e, dt) {
      if (!enterHold(e, dt)) return;
      e.px += e.dir * e.spd * 0.7 * dt;
      if (e.px < 70) { e.px = 70; e.dir = 1; }
      if (e.px > 890) { e.px = 890; e.dir = -1; }
      place(e, e.px, e.holdY + Math.sin(e.holdT * 1.6) * 16);
    },
    orbit: function (e, dt) {
      if (!enterHold(e, dt)) return;
      var a = e.orbA + e.holdT * (e.orbSpd || 0.8);
      place(e, 480 + Math.cos(a) * (e.orbR || 260), e.holdY + Math.sin(a) * 60);
    },
    teleport: function (e, dt) {
      e.tpT = (e.tpT || 0) - dt;
      if (e.tpT <= 0) {
        e.tpT = U.rand(1.6, 2.8);
        e.tpFlash = 0.35;
        e.x = U.rand(120, 840);
        e.y = U.rand(90, 330);
      }
      if (e.tpFlash > 0) e.tpFlash -= dt;
    },
    boss: function (e, dt) {
      if (!enterHold(e, dt)) return;
      place(e, 480 + Math.sin(e.holdT * 0.55) * 250, e.holdY + Math.sin(e.holdT * 0.9) * 26);
    }
  };
})();


/* ============================================================
   敵アーキタイプ
   ============================================================ */
ST.EnemyTypes = (function () {
  /* hp: 基準倍率 / tier: 単語難度 / atk: 攻撃定義
     gimmick: 単語の仕掛け（game.js の GIMMICK を参照）
       split  : 打ち切って倒すと、短い単語を持つ破片2体に分かれる
       mask   : 先の2文字より後ろが伏字になる
       timed  : 目標にしてから一定時間で単語が変わる（進捗は失う）
       mirror : 単語が左右反転して表示される
     spawned: ウェーブには出ず、他の敵から生まれる専用種 */
  var T = {
    drone: {
      name: 'DRONE', ja: '偵察ドローン', shape: 'tri', color: '#5ce08a',
      hp: 0.8, r: 16, spd: 52, tier: 0, exp: 6, move: 'dive',
      atk: [{ p: 'aimed', every: 1.8, n: 2, spread: 0.2, spd: 185, r: 6 }]
    },
    scout: {
      name: 'SCOUT', ja: '哨戒機', shape: 'diamond', color: '#4da6ff',
      hp: 1.0, r: 17, spd: 46, tier: 0, exp: 8, move: 'sine',
      atk: [{ p: 'aimed', every: 1.7, n: 3, spread: 0.26, spd: 175, r: 6 }]
    },
    turret: {
      name: 'TURRET', ja: '自動砲塔', shape: 'hex', color: '#ffc24d',
      hp: 1.7, r: 20, spd: 60, tier: 1, exp: 14, move: 'hover', holdY: 150,
      atk: [
        { p: 'ring', every: 2.6, n: 11, spd: 118, r: 6, aim: true },
        { p: 'aimed', every: 1.9, n: 2, spread: 0.16, spd: 205, r: 5 }
      ]
    },
    weaver: {
      name: 'WEAVER', ja: '編隊機', shape: 'star', color: '#c078ff',
      hp: 1.4, r: 18, spd: 40, tier: 1, exp: 15, move: 'sine',
      atk: [
        { p: 'spiral', every: 0.34, arms: 2, spd: 140, r: 5, step: 0.5, aim: true },
        { p: 'aimed', every: 2.4, n: 3, spread: 0.22, spd: 190, r: 5 }
      ]
    },
    lancer: {
      name: 'LANCER', ja: '突撃槍騎', shape: 'lance', color: '#ff8a5c',
      hp: 1.2, r: 17, spd: 96, tier: 1, exp: 16, move: 'dive',
      atk: [
        { p: 'sweep', every: 1.4, n: 4, spd: 330, r: 4 },
        { p: 'aimed', every: 2.2, n: 1, spd: 260, r: 6 }
      ]
    },
    bomber: {
      name: 'BOMBER', ja: '爆撃機', shape: 'square', color: '#ff4d5e',
      hp: 2.4, r: 23, spd: 34, tier: 2, exp: 24, move: 'hover', holdY: 130, gimmick: 'split',
      atk: [
        { p: 'seed', every: 2.9, n: 3, spd: 95, split: 9, splitT: 1.2 },
        { p: 'seeker', every: 3.2, n: 2, homing: 1.7, spd: 105 }
      ]
    },
    sentinel: {
      name: 'SENTINEL', ja: '守護機関', shape: 'ring', color: '#4df3ff',
      hp: 2.8, r: 24, spd: 55, tier: 2, exp: 28, move: 'strafe', holdY: 165,
      atk: [
        { p: 'burstRing', every: 3.0, n: 9, spd: 112, r: 6, aim: true },
        { p: 'fan', every: 1.9, n: 6, arc: 0.9, spd: 175, r: 5, off: 1.0 },
        { p: 'seeker', every: 4.0, n: 2, homing: 1.6, spd: 100 }
      ]
    },
    phantom: {
      name: 'PHANTOM', ja: '幽鬼', shape: 'cross', color: '#ff4dd2',
      hp: 2.0, r: 19, spd: 0, tier: 2, exp: 30, move: 'teleport', gimmick: 'mask',
      atk: [
        { p: 'seeker', every: 2.0, n: 4, homing: 1.9, spd: 100 },
        { p: 'aimed', every: 2.6, n: 3, spread: 0.18, spd: 200, r: 5 }
      ]
    },
    warden: {
      name: 'WARDEN', ja: '封鎖機', shape: 'hex', color: '#59ff9e',
      hp: 3.4, r: 26, spd: 48, tier: 3, exp: 40, move: 'hover', holdY: 110,
      atk: [
        { p: 'wall', every: 3.2, n: 15, gap: 2, spd: 120, r: 7 },
        { p: 'aimed', every: 1.8, n: 4, spread: 0.14, spd: 215, r: 5 }
      ]
    },
    seraph: {
      name: 'SERAPH', ja: '天輪', shape: 'star', color: '#ffa93d',
      hp: 3.8, r: 26, spd: 45, tier: 3, exp: 46, move: 'orbit', holdY: 175, gimmick: 'mirror',
      atk: [
        { p: 'flower', every: 1.9, petals: 5, n: 4, spd: 108, r: 6, rot: 0.6 },
        { p: 'seeker', every: 2.8, n: 3, homing: 1.8, spd: 105 }
      ]
    },
    hexer: {
      name: 'HEXER', ja: '呪縛機', shape: 'diamond', color: '#a44dff',
      hp: 3.0, r: 22, spd: 42, tier: 3, exp: 44, move: 'strafe', holdY: 145, gimmick: 'timed',
      atk: [
        { p: 'delay', every: 3.0, n: 16, spd: 38, accel: 145 },
        { p: 'fan', every: 2.0, n: 5, arc: 0.7, spd: 195, r: 5 }
      ]
    },
    /* 爆撃機が分裂して生まれる破片。単語は短く、弾も控えめ */
    shard: {
      name: 'SHARD', ja: '破片', shape: 'tri', color: '#ff8a8a',
      hp: 0.6, r: 11, spd: 64, tier: 0, exp: 4, move: 'dive', spawned: true,
      atk: [{ p: 'aimed', every: 2.4, n: 1, spd: 170, r: 5 }]
    }
  };

  /* ---- ボス ---- */
  var BOSS = {
    aegis: {
      name: 'AEGIS PRIME', ja: '要塞核 イージス', shape: 'boss1', color: '#ff4d5e',
      hp: 26, words: 8, r: 54, spd: 42, tier: 3, exp: 300, move: 'boss', holdY: 150, boss: true,
      phases: [
        { hpAbove: 0.66, atk: [{ p: 'ring', every: 1.9, n: 16, spd: 120, r: 7, aim: true }, { p: 'aimed', every: 1.1, n: 3, spread: 0.2, spd: 215 }, { p: 'seeker', every: 3.4, n: 2, homing: 1.7 }] },
        { hpAbove: 0.33, atk: [{ p: 'spiral', every: 0.16, arms: 3, spd: 150, step: 0.34 }, { p: 'fan', every: 2.4, n: 9, arc: 1.4, spd: 175 }] },
        { hpAbove: 0, atk: [{ p: 'burstRing', every: 1.5, n: 14, spd: 130 }, { p: 'seeker', every: 2.2, n: 4, homing: 1.8 }, { p: 'rain', every: 1.4, n: 5, spd: 175 }] }
      ]
    },
    nyx: {
      name: 'NYX WEAVER', ja: '虚空の織り手 ニュクス', shape: 'boss2', color: '#c078ff',
      hp: 32, words: 10, r: 50, spd: 46, tier: 4, exp: 420, move: 'boss', holdY: 140, boss: true,
      phases: [
        { hpAbove: 0.7, atk: [{ p: 'flower', every: 1.5, petals: 6, n: 4, spd: 115, rot: 0.7 }, { p: 'seeker', every: 2.6, n: 3, homing: 1.8 }, { p: 'aimed', every: 1.6, n: 3, spread: 0.2, spd: 200 }] },
        { hpAbove: 0.4, atk: [{ p: 'spiral', every: 0.12, arms: 5, spd: 135, step: 0.27 }, { p: 'sweep', every: 1.8, n: 6, spd: 350 }] },
        { hpAbove: 0, atk: [{ p: 'delay', every: 2.4, n: 22, spd: 34, accel: 160 }, { p: 'ring', every: 1.1, n: 20, spd: 140, rot: 1.4 }, { p: 'seeker', every: 2.6, n: 5, homing: 2.0 }] }
      ]
    },
    vulcan: {
      name: 'VULCAN CORE', ja: '灼熱炉心 ヴァルカン', shape: 'boss1', color: '#ff8a5c',
      hp: 40, words: 12, r: 56, spd: 44, tier: 4, exp: 560, move: 'boss', holdY: 145, boss: true,
      phases: [
        { hpAbove: 0.75, atk: [{ p: 'wall', every: 2.4, n: 17, gap: 3, spd: 135 }, { p: 'aimed', every: 1.0, n: 5, spread: 0.17, spd: 235 }, { p: 'seeker', every: 3.0, n: 3, homing: 1.8 }] },
        { hpAbove: 0.45, atk: [{ p: 'cross', every: 0.9, n: 5, spd: 100, rot: 1.5 }, { p: 'rain', every: 1.0, n: 6, spd: 190 }] },
        { hpAbove: 0.2, atk: [{ p: 'burstRing', every: 1.2, n: 16, spd: 140 }, { p: 'sweep', every: 1.3, n: 7, spd: 380 }] },
        { hpAbove: 0, atk: [{ p: 'spiral', every: 0.1, arms: 6, spd: 160, step: 0.21 }, { p: 'seed', every: 2.0, n: 4, split: 12 }, { p: 'rain', every: 0.8, n: 7, spd: 200 }] }
      ]
    },
    oblivion: {
      name: 'OBLIVION', ja: '終焉機構 オブリヴィオン', shape: 'boss2', color: '#4df3ff',
      hp: 52, words: 14, r: 58, spd: 48, tier: 4, exp: 760, move: 'boss', holdY: 135, boss: true,
      phases: [
        { hpAbove: 0.8, atk: [{ p: 'ring', every: 1.4, n: 22, spd: 125, rot: 0.9, aim: true }, { p: 'seeker', every: 1.8, n: 5, homing: 2.0 }, { p: 'fan', every: 1.9, n: 7, arc: 0.8, spd: 210 }] },
        { hpAbove: 0.55, atk: [{ p: 'flower', every: 1.2, petals: 7, n: 5, spd: 120, rot: -0.8 }, { p: 'sweep', every: 1.4, n: 8, spd: 370 }] },
        { hpAbove: 0.3, atk: [{ p: 'wall', every: 1.9, n: 19, gap: 2, spd: 150 }, { p: 'spiral', every: 0.1, arms: 4, spd: 155, step: 0.39 }] },
        { hpAbove: 0, atk: [{ p: 'spiral', every: 0.08, arms: 7, spd: 165, step: 0.19 }, { p: 'burstRing', every: 1.1, n: 18, spd: 145 }, { p: 'rain', every: 0.7, n: 8, spd: 215 }, { p: 'seeker', every: 2.4, n: 6, homing: 2.2 }] }
      ]
    },
    singularis: {
      name: 'SINGULARIS', ja: '特異点 シンギュラリス', shape: 'boss3', color: '#ff4dd2',
      hp: 70, words: 17, r: 62, spd: 50, tier: 4, exp: 1100, move: 'boss', holdY: 130, boss: true,
      phases: [
        { hpAbove: 0.85, atk: [{ p: 'ring', every: 1.1, n: 26, spd: 130, rot: 1.2, aim: true }, { p: 'fan', every: 1.4, n: 11, arc: 1.3, spd: 200 }, { p: 'seeker', every: 2.2, n: 4, homing: 2.0 }] },
        { hpAbove: 0.65, atk: [{ p: 'spiral', every: 0.07, arms: 5, spd: 150, step: 0.25 }, { p: 'delay', every: 2.2, n: 26, spd: 36, accel: 175 }] },
        { hpAbove: 0.45, atk: [{ p: 'flower', every: 1.0, petals: 8, n: 5, spd: 125, rot: 0.9 }, { p: 'sweep', every: 1.1, n: 9, spd: 400 }] },
        { hpAbove: 0.22, atk: [{ p: 'wall', every: 1.6, n: 21, gap: 2, spd: 160 }, { p: 'cross', every: 0.8, n: 6, spd: 110, rot: 1.9 }, { p: 'seeker', every: 2.0, n: 6, homing: 2.1 }] },
        { hpAbove: 0, atk: [{ p: 'spiral', every: 0.06, arms: 8, spd: 170, step: 0.17 }, { p: 'burstRing', every: 0.9, n: 20, spd: 150 }, { p: 'rain', every: 0.6, n: 9, spd: 225 }, { p: 'seeker', every: 1.8, n: 7, homing: 2.3 }] }
      ]
    }
  };

  return { T: T, BOSS: BOSS };
})();
