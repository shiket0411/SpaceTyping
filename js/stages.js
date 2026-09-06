/* ============================================================
   SPACE TYPING - stages.js
   難易度 / 宙域 / ウェーブ生成 / 成長カーブ
   ============================================================ */
ST.Difficulty = (function () {
  /* bulletSpeed:弾速 bulletCount:弾数 hpMul:敵耐久 tierAdd:単語難度
     dmgTaken:被弾倍率 exp/drop:報酬 lockDrop:ミスでロック解除
     graceMul:ミス硬直 homing:全弾にかかる誘導バイアス(rad/s)
     laser:迎撃不可レーザーの発生しやすさ odCost:OD必要量の倍率
     (迎撃射程は難易度に依らず固定) */
  var L = [
    {
      id: 'novice', name: 'NOVICE', ja: '新兵', color: '#5ce08a',
      desc: '弾はゆっくり、数も控えめ。まずは操作とロックオンに慣れる。',
      bulletSpeed: 0.60, bulletCount: 0.50, hpMul: 0.85, tierAdd: -1,
      dmgTaken: 0.45, exp: 0.70, drop: 0.70, score: 0.6,
      lockDrop: false, graceMul: 0.6, spawnMul: 0.75, homing: 0, laser: 0.2, odCost: 0.6
    },
    {
      id: 'cadet', name: 'CADET', ja: '士官候補', color: '#4da6ff',
      desc: '標準的な弾幕の入り口。迎撃タイピングを覚えるならここ。',
      bulletSpeed: 0.78, bulletCount: 0.70, hpMul: 0.92, tierAdd: -1,
      dmgTaken: 0.70, exp: 0.88, drop: 0.85, score: 0.8,
      lockDrop: false, graceMul: 0.8, spawnMul: 0.9, homing: 0.05, laser: 0.35, odCost: 0.75
    },
    {
      id: 'pilot', name: 'PILOT', ja: '正規兵', color: '#4df3ff',
      desc: '基準となる難易度。設計上もっともバランスが取れている。',
      bulletSpeed: 1.00, bulletCount: 1.00, hpMul: 1.00, tierAdd: 0,
      dmgTaken: 1.00, exp: 1.00, drop: 1.00, score: 1.0,
      lockDrop: false, graceMul: 1.0, spawnMul: 1.0, homing: 0.12, laser: 0.55, odCost: 1.0
    },
    {
      id: 'ace', name: 'ACE', ja: '撃墜王', color: '#ffc24d',
      desc: '弾幕が厚くなり、単語も長い。モード切替の判断が要求される。',
      bulletSpeed: 1.15, bulletCount: 1.28, hpMul: 1.15, tierAdd: 1,
      dmgTaken: 1.30, exp: 1.40, drop: 1.30, score: 1.4,
      lockDrop: false, graceMul: 1.15, spawnMul: 1.15, homing: 0.22, laser: 0.8, odCost: 1.25
    },
    {
      id: 'veteran', name: 'VETERAN', ja: '歴戦', color: '#ffa93d',
      desc: 'ミスで迎撃エネルギーが減る。正確さが生存に直結する領域。',
      bulletSpeed: 1.30, bulletCount: 1.55, hpMul: 1.35, tierAdd: 1,
      dmgTaken: 1.60, exp: 1.85, drop: 1.60, score: 1.9,
      lockDrop: true, graceMul: 1.3, spawnMul: 1.3, homing: 0.34, laser: 0.9, odCost: 1.5
    },
    {
      id: 'nightmare', name: 'NIGHTMARE', ja: '悪夢', color: '#ff4d5e',
      desc: '画面が弾で埋まる。充填が追いつかず容量勝負になる。',
      bulletSpeed: 1.50, bulletCount: 1.95, hpMul: 1.60, tierAdd: 2,
      dmgTaken: 2.10, exp: 2.50, drop: 2.10, score: 2.6,
      lockDrop: true, graceMul: 1.5, spawnMul: 1.5, homing: 0.5, laser: 1.12, odCost: 1.9
    },
    {
      id: 'singularity', name: 'SINGULARITY', ja: '特異点', color: '#ff4dd2',
      desc: '理不尽。装備を極めた者のための最終試練。報酬も最大。',
      bulletSpeed: 1.72, bulletCount: 2.40, hpMul: 1.90, tierAdd: 2,
      dmgTaken: 3.00, exp: 3.60, drop: 2.80, score: 3.6,
      lockDrop: true, graceMul: 1.7, spawnMul: 1.75, homing: 0.7, laser: 2.6, odCost: 2.5
    }
  ];
  var M = {};
  L.forEach(function (d, i) { M[d.id] = d; d.index = i; });
  return { list: L, map: M, get: function (id) { return M[id] || M.pilot; } };
})();


ST.Sectors = (function () {
  var L = [
    {
      id: 's1', num: 1, name: 'LOW EARTH ORBIT', ja: '近地球軌道',
      desc: 'デブリ化した無人機が漂う。訓練にはちょうどいい。',
      enemies: ['drone', 'scout'], waves: 5, boss: 'aegis', bossScale: 0.85,
      ilvl: 3, req: null, hue: [200, 240], tierBase: 0
    },
    {
      id: 's2', num: 2, name: 'ASTEROID BELT', ja: '小惑星帯',
      desc: '岩礁に潜む自動砲塔。遮蔽物のない空間で撃ち合う。',
      enemies: ['drone', 'scout', 'turret', 'lancer'], waves: 5, boss: 'nyx', bossScale: 0.85,
      ilvl: 8, req: 's1', hue: [30, 60], tierBase: 0
    },
    {
      id: 's3', num: 3, name: 'JOVIAN ORBIT', ja: '木星圏',
      desc: '巨大重力井戸。編隊機のスパイラル弾が空間を編む。',
      enemies: ['turret', 'weaver', 'lancer', 'scout'], waves: 6, boss: 'vulcan', bossScale: 0.9,
      ilvl: 14, req: 's2', hue: [20, 45], tierBase: 1
    },
    {
      id: 's4', num: 4, name: 'INTERSTELLAR LANE', ja: '星間航路',
      desc: '恒星間の細い回廊。爆撃機と幽鬼が待ち伏せる。',
      enemies: ['weaver', 'bomber', 'phantom', 'lancer'], waves: 6, boss: 'aegis', bossScale: 1.5,
      ilvl: 21, req: 's3', hue: [250, 290], tierBase: 1
    },
    {
      id: 's5', num: 5, name: 'DARK NEBULA', ja: '暗黒星雲',
      desc: '視界を奪う塵の海。守護機関の二重リングが牙を剥く。',
      enemies: ['bomber', 'sentinel', 'phantom', 'weaver'], waves: 6, boss: 'nyx', bossScale: 1.3,
      ilvl: 29, req: 's4', hue: [270, 320], tierBase: 2
    },
    {
      id: 's6', num: 6, name: 'EVENT HORIZON', ja: '特異点境界',
      desc: '時間が歪む臨界面。封鎖機の弾幕壁に隙間はひとつ。',
      enemies: ['sentinel', 'warden', 'hexer', 'phantom'], waves: 7, boss: 'oblivion', bossScale: 1.1,
      ilvl: 38, req: 's5', hue: [180, 210], tierBase: 2
    },
    {
      id: 's7', num: 7, name: 'ANTIMATTER FIELD', ja: '反物質領域',
      desc: '触れれば対消滅。天輪の花弁が視界を埋め尽くす。',
      enemies: ['warden', 'seraph', 'hexer', 'sentinel'], waves: 7, boss: 'vulcan', bossScale: 1.35,
      ilvl: 48, req: 's6', hue: [300, 340], tierBase: 3
    },
    {
      id: 's8', num: 8, name: 'GALACTIC CORE', ja: '銀河核',
      desc: '全ての始まりにして終わり。特異点が待っている。',
      enemies: ['warden', 'seraph', 'hexer', 'sentinel', 'bomber', 'phantom'], waves: 8,
      boss: 'singularis', bossScale: 1.0,
      ilvl: 60, req: 's7', hue: [340, 20], tierBase: 3
    }
  ];
  var M = {};
  L.forEach(function (s) { M[s.id] = s; });

  var ENDLESS = {
    id: 'endless', num: 99, name: 'ENDLESS DRIFT', ja: '無限航行',
    desc: '終わりのない航海。倒し続けるほど激化する。記録に挑め。',
    enemies: ['drone', 'scout', 'turret', 'weaver', 'lancer', 'bomber', 'sentinel', 'phantom', 'warden', 'seraph', 'hexer'],
    waves: 999, boss: null, ilvl: 30, req: 's4', hue: [200, 320], tierBase: 1, endless: true,
    odSector: 5
  };
  M.endless = ENDLESS;

  /* ---- ウェーブ生成 ----
     戻り値: [{type, x, y, delay, boss?}] */
  function buildWave(sector, waveIdx, diff) {
    var U = ST.U;
    var out = [];
    var isEndless = !!sector.endless;
    var w = waveIdx;                       /* 0-based */
    var pool = sector.enemies;
    /* エンドレスは進むほど強い敵が解禁される */
    if (isEndless) {
      var unlocked = Math.min(pool.length, 2 + Math.floor(w / 2));
      pool = pool.slice(0, unlocked);
    }
    var density = 3 + Math.floor(w * 0.9) + (isEndless ? Math.floor(w * 0.55) : 0);
    density = Math.round(density * diff.spawnMul);
    density = U.clamp(density, 3, 16);

    var formation = U.choice(['line', 'v', 'column', 'arc', 'random']);
    var count = density;
    var t = 0;
    for (var i = 0; i < count; i++) {
      var type = U.choice(pool);
      var x, y = -40, delay;
      switch (formation) {
        case 'line':
          x = 120 + (720 * i / Math.max(1, count - 1));
          delay = t + i * 0.18; break;
        case 'v':
          x = 480 + (i % 2 === 0 ? 1 : -1) * (60 + Math.floor(i / 2) * 78);
          delay = t + Math.floor(i / 2) * 0.30; break;
        case 'column':
          x = U.rand(160, 800);
          delay = t + i * 0.42; break;
        case 'arc':
          var a = Math.PI * (0.15 + 0.7 * i / Math.max(1, count - 1));
          x = 480 - Math.cos(a) * 340; y = -40 - Math.sin(a) * 60;
          delay = t + i * 0.22; break;
        default:
          x = U.rand(110, 850);
          delay = t + U.rand(0, count * 0.35);
      }
      out.push({ type: type, x: U.clamp(x, 70, 890), y: y, delay: delay });
    }
    return out;
  }

  return { list: L, map: M, endless: ENDLESS, buildWave: buildWave };
})();


/* ============================================================
   成長カーブ
   ============================================================ */
ST.Growth = (function () {
  function expToNext(level) {
    return Math.round(55 * Math.pow(level, 1.42) + 45 * level + 30);
  }
  function baseStats(level) {
    return {
      maxHp: 100 + (level - 1) * 9,
      atk: 10 + (level - 1) * 1.7,
      crit: 5,
      critMult: 175,
      def: 0,
      shieldMax: 30 + (level - 1) * 2
    };
  }
  /* exp を加算しレベルアップ結果を返す */
  function gainExp(pilot, amount) {
    var res = { gained: Math.round(amount), levels: 0, from: pilot.level };
    pilot.exp += res.gained;
    var guard = 0;
    while (pilot.exp >= expToNext(pilot.level) && guard++ < 200) {
      pilot.exp -= expToNext(pilot.level);
      pilot.level++;
      res.levels++;
    }
    res.to = pilot.level;
    return res;
  }
  return { expToNext: expToNext, baseStats: baseStats, gainExp: gainExp };
})();
