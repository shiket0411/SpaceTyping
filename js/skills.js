/* ============================================================
   SPACE TYPING - skills.js
   パイロット技能。レベルアップごとに1ポイント得て、3系統に振り分ける。
   装備とは別の軸で「どう戦うか」を決めるためのもの。
   ============================================================ */
ST.Skills = (function () {
  /* k: 加算先のステータス / per: 1ランクあたりの値 / max: 最大ランク
     req: 習得に必要な前提技能（1ランク以上） */
  var TREE = [
    {
      id: 'offense', ja: '攻撃系', en: 'OFFENSE', color: '#ffc24d',
      skills: [
        { id: 'gunnery', n: '砲撃強化', d: '砲撃力 +{v}%', k: 'atkPct', per: 3, max: 5 },
        { id: 'finisher', n: '完撃強化', d: '完撃倍率 +{v}%', k: 'finisher', per: 8, max: 5, req: 'gunnery' },
        { id: 'critical', n: '急所狙い', d: '会心率 +{v}%', k: 'crit', per: 2, max: 5, req: 'gunnery' },
        { id: 'suppress', n: '圧力制御', d: '撃破で下がる戦域圧力 +{v}%', k: 'pressureKill', per: 10, max: 3, req: 'finisher' }
      ]
    },
    {
      id: 'defense', ja: '防御系', en: 'DEFENSE', color: '#4df3ff',
      skills: [
        { id: 'hull', n: '装甲強化', d: '装甲値 +{v}%', k: 'hpPct', per: 4, max: 5 },
        { id: 'barrier', n: '障壁強化', d: '障壁容量 +{v}%', k: 'shieldPct', per: 8, max: 5, req: 'hull' },
        { id: 'efficiency', n: '迎撃効率', d: '迎撃燃費 +{v}%（装備と合わせて最大40%）', k: 'interceptCost', per: 3, max: 5, req: 'hull' },
        { id: 'plating', n: '耐弾処理', d: '被害軽減 +{v}%', k: 'def', per: 2, max: 5, req: 'barrier' }
      ]
    },
    {
      id: 'technique', ja: '技巧系', en: 'TECHNIQUE', color: '#59ff9e',
      skills: [
        { id: 'composure', n: '平常心', d: 'ミス硬直 -{v}%', k: 'grace', per: 5, max: 5 },
        { id: 'rhythm', n: '律動維持', d: 'ミス時のコンボ保持 +{v}%', k: 'comboKeep', per: 6, max: 5, req: 'composure' },
        { id: 'charge', n: '切り札充填', d: 'OD蓄積 +{v}%', k: 'odGain', per: 6, max: 5, req: 'composure' },
        { id: 'reflex', n: '反射神経', d: 'レーザーの予告時間 +{v}秒（パリィの猶予が延びる）', k: 'parryWindow', per: 0.1, max: 3, req: 'rhythm' }
      ]
    }
  ];
  var MAP = {};
  TREE.forEach(function (b) { b.skills.forEach(function (s) { s.branch = b.id; MAP[s.id] = s; }); });

  function rank(pilot, id) { return (pilot.skills && pilot.skills[id]) || 0; }
  function spent(pilot) {
    var n = 0;
    for (var k in pilot.skills) n += pilot.skills[k] || 0;
    return n;
  }
  function canLearn(pilot, id) {
    var s = MAP[id];
    if (!s) return false;
    if ((pilot.statPoints || 0) < 1) return false;
    if (rank(pilot, id) >= s.max) return false;
    if (s.req && rank(pilot, s.req) < 1) return false;
    return true;
  }
  function learn(pilot, id) {
    if (!canLearn(pilot, id)) return false;
    pilot.skills[id] = rank(pilot, id) + 1;
    pilot.statPoints--;
    return true;
  }
  /* 振り直しは資金を払って全ポイントを戻す */
  function respecCost(pilot) { return Math.max(200, pilot.level * 40); }
  function respec(pilot) {
    var cost = respecCost(pilot);
    if (pilot.credits < cost || spent(pilot) === 0) return false;
    pilot.credits -= cost;
    pilot.statPoints += spent(pilot);
    pilot.skills = {};
    return true;
  }
  /* ステータスへの加算値 {k: 値} */
  function bonus(pilot) {
    var out = {};
    if (!pilot || !pilot.skills) return out;
    for (var id in pilot.skills) {
      var s = MAP[id];
      if (!s) continue;
      out[s.k] = (out[s.k] || 0) + s.per * pilot.skills[id];
    }
    return out;
  }
  function describe(s, r) {
    var v = Math.round(s.per * Math.max(1, r) * 100) / 100;
    return s.d.replace('{v}', v);
  }

  return {
    TREE: TREE, MAP: MAP, rank: rank, spent: spent, canLearn: canLearn, learn: learn,
    respec: respec, respecCost: respecCost, bonus: bonus, describe: describe
  };
})();
