/* ============================================================
   SPACE TYPING - items.js
   装備生成 / レアリティ / アフィックス / ステータス集計
   ============================================================ */
ST.Items = (function () {
  var U = ST.U;

  var RARITY = [
    { id: 'common', name: 'COMMON', ja: '量産', affixes: 1, mul: 1.00, w: 100, price: 40 },
    { id: 'uncommon', name: 'UNCOMMON', ja: '改修', affixes: 2, mul: 1.18, w: 55, price: 110 },
    { id: 'rare', name: 'RARE', ja: '精密', affixes: 3, mul: 1.40, w: 24, price: 300 },
    { id: 'epic', name: 'EPIC', ja: '試作', affixes: 4, mul: 1.70, w: 9, price: 800 },
    { id: 'legendary', name: 'LEGENDARY', ja: '伝説', affixes: 5, mul: 2.10, w: 2.6, price: 2200 },
    { id: 'mythic', name: 'MYTHIC', ja: '神話', affixes: 6, mul: 2.70, w: 0.6, price: 6000 }
  ];
  var RMAP = {};
  RARITY.forEach(function (r, i) { RMAP[r.id] = r; r.tier = i; });

  var SLOTS = [
    { id: 'weapon', ja: '照準系', en: 'WEAPON' },
    { id: 'core', ja: '機関系', en: 'CORE' },
    { id: 'armor', ja: '装甲系', en: 'ARMOR' },
    { id: 'module', ja: '拡張系', en: 'MODULE' }
  ];

  /* ---- アフィックス定義 ----
     v: 基礎値レンジ / p: レベル毎の増分係数 / s: 出現スロット / w: 重み  */
  var AFFIX = [
    { k: 'atk', n: '砲撃力', u: '', v: [3, 7], p: 0.55, s: ['weapon', 'core', 'module'], w: 100 },
    { k: 'atkPct', n: '砲撃力', u: '%', v: [4, 9], p: 0.11, s: ['weapon', 'module'], w: 55 },
    { k: 'crit', n: '会心率', u: '%', v: [3, 7], p: 0.09, s: ['weapon', 'module'], w: 60 },
    { k: 'critMult', n: '会心倍率', u: '%', v: [8, 18], p: 0.20, s: ['weapon', 'module'], w: 34 },
    { k: 'finisher', n: '完撃倍率', u: '%', v: [10, 22], p: 0.26, s: ['weapon'], w: 42 },
    { k: 'maxHp', n: '装甲値', u: '', v: [8, 18], p: 1.25, s: ['armor', 'core'], w: 90 },
    { k: 'def', n: '被害軽減', u: '%', v: [2, 5], p: 0.07, s: ['armor'], w: 55 },
    { k: 'hpRegen', n: '自己修復', u: '/s', v: [0.2, 0.5], p: 0.020, s: ['armor', 'core'], w: 30 },
    { k: 'shieldMax', n: '障壁容量', u: '', v: [6, 14], p: 0.50, s: ['armor', 'core'], w: 60 },
    { k: 'shieldRegen', n: '障壁回復', u: '%', v: [4, 10], p: 0.08, s: ['armor', 'core'], w: 44 },
    { k: 'interceptBlast', n: '迎撃爆風', u: '', v: [6, 14], p: 0.62, s: ['module', 'weapon'], w: 60 },
    { k: 'energyMax', n: '迎撃容量', u: '', v: [8, 16], p: 0.70, s: ['core', 'armor', 'module'], w: 62 },
    { k: 'energyCharge', n: '充填速度', u: '%', v: [6, 14], p: 0.18, s: ['module', 'core'], w: 70 },
    { k: 'interceptCost', n: '迎撃燃費', u: '%', v: [3, 7], p: 0.09, s: ['module', 'weapon'], w: 50 },
    { k: 'freeIntercept', n: '無償迎撃', u: '%', v: [3, 7], p: 0.09, s: ['module'], w: 24 },
    { k: 'odGain', n: 'OD蓄積', u: '%', v: [6, 15], p: 0.19, s: ['core', 'module'], w: 46 },
    { k: 'odDuration', n: 'OD持続', u: '%', v: [8, 16], p: 0.17, s: ['core'], w: 26 },
    { k: 'bulletSlow', n: '弾速低下', u: '%', v: [2, 5], p: 0.05, s: ['core', 'module'], w: 22 },
    { k: 'comboKeep', n: 'コンボ保持', u: '%', v: [8, 18], p: 0.20, s: ['module', 'core'], w: 30 },
    { k: 'grace', n: '硬直短縮', u: '%', v: [6, 14], p: 0.15, s: ['module', 'weapon'], w: 30 },
    { k: 'expGain', n: '経験値', u: '%', v: [5, 12], p: 0.14, s: ['module', 'core'], w: 36 },
    { k: 'dropRate', n: '入手率', u: '%', v: [5, 14], p: 0.16, s: ['module'], w: 34 },
    { k: 'creditGain', n: '資金獲得', u: '%', v: [6, 16], p: 0.18, s: ['module', 'core'], w: 30 },
    { k: 'scoreMul', n: 'スコア', u: '%', v: [4, 10], p: 0.12, s: ['module'], w: 26 }
  ];
  var AMAP = {};
  AFFIX.forEach(function (a) { AMAP[a.k] = a; });
  /* 旧仕様のアフィックス。生成対象からは外れているが、
     既存セーブの装備を表示・集計するために定義だけ残す。 */
  AMAP.autoIntercept = { k: 'autoIntercept', n: '無償迎撃', u: '%', v: [3, 8], p: 0.10, s: [] };
  AMAP.interceptRadius = { k: 'interceptRadius', n: '迎撃爆風', u: '', v: [12, 28], p: 1.1, s: [] };

  var INT_KEYS = {
    atk: 1, maxHp: 1, shieldMax: 1,
    interceptBlast: 1, energyMax: 1
  };

  /* ---- ユニーク効果（epic 以上で低確率付与） ---- */
  var UNIQUES = [
    { k: 'chain', n: '連撃回路', d: '正確打鍵が8連続する毎に、追加の貫通弾を放つ。', s: ['weapon'] },
    { k: 'nova', n: '拡散炸裂', d: '迎撃時の爆風が2倍に拡大する。', s: ['module', 'weapon'] },
    { k: 'phase', n: '零式緩衝', d: '被弾時、周囲180の敵弾を消滅させる(6秒毎)。', s: ['armor'] },
    { k: 'vampire', n: '吸収機構', d: '敵撃破時、装甲値を1.5%回復する。', s: ['core', 'armor'] },
    { k: 'overload', n: '限界駆動', d: '装甲値が低いほど砲撃力が上昇(最大+60%)。', s: ['core'] },
    { k: 'precision', n: '精密照準', d: 'ノーミス中、10打鍵毎に砲撃力+4%(最大+60%)。', s: ['weapon'] },
    { k: 'echo', n: '残響共鳴', d: '単語完成時、周囲の敵にも完撃の30%が波及する。', s: ['weapon', 'core'] },
    { k: 'aegis', n: '不動障壁', d: '障壁が満タンの間、被害軽減+25%。', s: ['armor'] },
    { k: 'harvest', n: '戦利品磁場', d: '撃破時、確率でOD蓄積が大きく増加する。', s: ['module'] },
    { k: 'timeflux', n: '時間偏差', d: 'オーバードライブ中、敵弾がさらに40%減速。', s: ['core', 'module'] }
  ];

  /* ---- 名前生成 ---- */
  var BASE = {
    weapon: ['照準ユニット', 'ロックオン機構', 'フェーズドアレイ', 'キーストローク砲', '走査照準器', '狙撃演算器'],
    core: ['反応炉', 'ドライブコア', '量子機関', 'ゼロポイント炉', '推進機関', '励起コア'],
    armor: ['複合装甲', '偏向フィールド', '慣性中和装甲', '積層シールド', '耐衝殻', '斥力障壁'],
    module: ['戦術チップ', '演算モジュール', '補助ユニット', '戦域プロセッサ', '拡張基板', '同調装置']
  };
  var PREFIX = {
    common: ['汎用', '標準', '量産型', '簡易'],
    uncommon: ['改良', '強化', '調整済', '軍用'],
    rare: ['精密', '高性能', '実戦型', '特務'],
    epic: ['試作', '極致', '特異点', '限界突破'],
    legendary: ['伝説の', '英雄の', '不滅の', '星喰みの'],
    mythic: ['神話級', '創世の', '終焉の', '無限の']
  };
  var SUFFIX = ['MkI', 'MkII', 'MkIII', 'Type-0', 'Type-R', 'EX', 'ZERO', 'ALPHA', 'OMEGA', 'PROTO', 'NOVA', 'VOID'];

  function rollRarity(luckBonus, floorTier) {
    var pool = RARITY.map(function (r) {
      var w = r.w;
      if (r.tier >= 2) w *= (1 + (luckBonus || 0));
      if (floorTier != null && r.tier < floorTier) w = 0;
      return { r: r, w: w };
    }).filter(function (x) { return x.w > 0; });
    if (!pool.length) return RARITY[floorTier || 0];
    return U.weighted(pool).r;
  }

  function rollAffixes(slot, count, ilvl, rar) {
    var pool = AFFIX.filter(function (a) { return a.s.indexOf(slot) >= 0; });
    var picked = [], used = {};
    for (var i = 0; i < count && pool.length; i++) {
      var cand = pool.filter(function (a) { return !used[a.k]; });
      if (!cand.length) break;
      var a = U.weighted(cand);
      used[a.k] = 1;
      var base = U.rand(a.v[0], a.v[1]);
      var val = (base + a.p * ilvl) * rar.mul;
      /* 小さな個体差 */
      val *= U.rand(0.92, 1.10);
      if (INT_KEYS[a.k]) val = Math.max(1, Math.round(val));
      else val = Math.round(val * 10) / 10;
      picked.push({ k: a.k, v: val });
    }
    return picked;
  }

  function makeName(slot, rar, affixes) {
    var pre = U.choice(PREFIX[rar.id]);
    var base = U.choice(BASE[slot]);
    var suf = (rar.tier >= 2 && Math.random() < 0.7) ? ' ' + U.choice(SUFFIX) : '';
    return pre + base + suf;
  }

  /* ilvl: 装備レベル / opts:{slot, rarity, luck, floorTier} */
  function generate(ilvl, opts) {
    opts = opts || {};
    ilvl = Math.max(1, Math.round(ilvl));
    var slot = opts.slot || U.choice(['weapon', 'core', 'armor', 'module', 'module']);
    var rar = opts.rarity ? RMAP[opts.rarity] : rollRarity(opts.luck || 0, opts.floorTier);
    var affixes = rollAffixes(slot, rar.affixes, ilvl, rar);
    var item = {
      id: U.uid(),
      slot: slot,
      rarity: rar.id,
      ilvl: ilvl,
      name: makeName(slot, rar, affixes),
      affixes: affixes,
      unique: null
    };
    /* ユニーク効果 */
    var uchance = rar.tier === 3 ? 0.16 : rar.tier === 4 ? 0.55 : rar.tier === 5 ? 1.0 : 0;
    if (Math.random() < uchance) {
      var cands = UNIQUES.filter(function (u) { return u.s.indexOf(slot) >= 0; });
      if (cands.length) item.unique = U.choice(cands).k;
    }
    item.power = powerOf(item);
    return item;
  }

  function powerOf(item) {
    var p = 0;
    for (var i = 0; i < item.affixes.length; i++) {
      var a = AMAP[item.affixes[i].k];
      var norm = item.affixes[i].v / Math.max(0.01, (a.v[1] + a.p * item.ilvl));
      p += norm * 100;
    }
    if (item.unique) p += 120;
    return Math.round(p);
  }

  function sellPrice(item) {
    var r = RMAP[item.rarity];
    return Math.round(r.price * (1 + item.ilvl * 0.14) * (item.unique ? 1.6 : 1) * 0.45);
  }

  function affixLabel(af) {
    var a = AMAP[af.k];
    if (!a) return '';
    var v = af.v;
    var sign = v >= 0 ? '+' : '';
    var txt = INT_KEYS[af.k] ? Math.round(v) : (Math.round(v * 10) / 10);
    return a.n + ' ' + sign + txt + a.u;
  }

  function uniqueDef(k) {
    for (var i = 0; i < UNIQUES.length; i++) if (UNIQUES[i].k === k) return UNIQUES[i];
    return null;
  }

  /* ---- 装備集計 ---- */
  function blankStats() {
    return {
      atk: 0, atkPct: 0, crit: 0, critMult: 0, finisher: 0,
      maxHp: 0, def: 0, hpRegen: 0, shieldMax: 0, shieldRegen: 0,
      interceptBlast: 0,
      energyMax: 0, energyCharge: 0, interceptCost: 0, freeIntercept: 0,
      odGain: 0, odDuration: 0, bulletSlow: 0, comboKeep: 0, grace: 0,
      expGain: 0, dropRate: 0, creditGain: 0, scoreMul: 0,
      uniques: {}
    };
  }

  /* equipped: {weapon:item|null,...} */
  function aggregate(equipped) {
    var s = blankStats();
    for (var slotKey in equipped) {
      var it = equipped[slotKey];
      if (!it) continue;
      for (var i = 0; i < it.affixes.length; i++) {
        var af = it.affixes[i];
        /* 旧セーブのアフィックスを現行の項目へ読み替える。
           迎撃射程は固定値になったので、近い役割の迎撃爆風に引き継ぐ。 */
        var k = af.k;
        if (k === 'autoIntercept') k = 'freeIntercept';
        else if (k === 'interceptRadius') k = 'interceptBlast';
        if (s[k] != null) s[k] += af.v;
      }
      if (it.unique) s.uniques[it.unique] = true;
    }
    return s;
  }

  /* 比較用: 装備中アイテムとの差分 */
  function compare(item, current) {
    var a = {}, i;
    if (current) for (i = 0; i < current.affixes.length; i++) a[current.affixes[i].k] = current.affixes[i].v;
    var out = [];
    for (i = 0; i < item.affixes.length; i++) {
      var af = item.affixes[i];
      var cur = a[af.k] || 0;
      out.push({ k: af.k, v: af.v, delta: af.v - cur });
    }
    return out;
  }

  /* ---- 所持上限 ----
     上限を超えたら、ロックされていないものの中から
     レアリティが低い順 → 性能が低い順 → 古い順に取り除く。
     （古い順に捨てると、昔拾った LEGENDARY が黙って消える）
     取り除いた装備の配列を返す。inv はその場で書き換える。 */
  var INV_MAX = 120;
  function trimInventory(inv, max) {
    max = max || INV_MAX;
    if (inv.length <= max) return [];
    var idx = [];
    for (var i = 0; i < inv.length; i++) if (!inv[i].locked) idx.push(i);
    idx.sort(function (a, b) {
      var ta = RMAP[inv[a].rarity] ? RMAP[inv[a].rarity].tier : 0;
      var tb = RMAP[inv[b].rarity] ? RMAP[inv[b].rarity].tier : 0;
      if (ta !== tb) return ta - tb;
      var pa = powerOf(inv[a]), pb = powerOf(inv[b]);
      if (pa !== pb) return pa - pb;
      return a - b;
    });
    var cut = idx.slice(0, inv.length - max);
    var drop = {};
    cut.forEach(function (j) { drop[j] = true; });
    var removed = [], kept = [];
    for (var k = 0; k < inv.length; k++) (drop[k] ? removed : kept).push(inv[k]);
    inv.length = 0;
    for (var m = 0; m < kept.length; m++) inv.push(kept[m]);
    return removed;
  }

  return {
    RARITY: RARITY, RMAP: RMAP, SLOTS: SLOTS, AFFIX: AFFIX, AMAP: AMAP, UNIQUES: UNIQUES,
    generate: generate, sellPrice: sellPrice, affixLabel: affixLabel, uniqueDef: uniqueDef,
    aggregate: aggregate, blankStats: blankStats, compare: compare, powerOf: powerOf,
    rollRarity: rollRarity, trimInventory: trimInventory, INV_MAX: INV_MAX
  };
})();
