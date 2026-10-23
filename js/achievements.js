/* ============================================================
   SPACE TYPING - achievements.js
   実績。任務の終了時にまとめて判定し、初回だけ資金を与える。
   test(res, run, save) の res はリザルト、run は任務の実行状態。
   ============================================================ */
ST.Achievements = (function () {
  function mission(res) { return !res.practice && !res.daily; }
  function numOf(res) { return res.sector && res.sector.num ? res.sector.num : 0; }

  var LIST = [
    { id: 'first_clear', n: '初陣', d: '任務を初めて達成する', cr: 200,
      test: function (r) { return r.cleared && mission(r); } },
    { id: 'no_hit', n: '無傷の帰還', d: '被弾0で任務を達成する', cr: 600,
      test: function (r) { return r.cleared && mission(r) && r.hits === 0; } },
    { id: 'perfect', n: '精密射撃', d: 'ミス0（正確率100%）で任務を達成する', cr: 800,
      test: function (r) { return r.cleared && mission(r) && r.miss === 0; } },
    { id: 'no_od', n: '切り札不要', d: 'オーバードライブを使わずに宙域3以降を制圧する', cr: 700,
      test: function (r) { return r.cleared && mission(r) && numOf(r) >= 3 && r.odUsed === 0; } },
    { id: 'combo100', n: '連撃', d: '1任務で100コンボを達成する', cr: 300,
      test: function (r) { return r.combo >= 100; } },
    { id: 'combo300', n: '止まらない指', d: '1任務で300コンボを達成する', cr: 1200,
      test: function (r) { return r.combo >= 300; } },
    { id: 'kps8', n: '疾風', d: '平均8打/秒以上で任務を達成する', cr: 1500,
      test: function (r) { return r.cleared && r.kps >= 8; } },
    { id: 'parry1', n: '反射', d: 'レーザーをパリィする', cr: 200,
      test: function (r) { return r.parries >= 1; } },
    { id: 'parry10', n: '反射の達人', d: '1任務でレーザーを10回パリィする', cr: 1000,
      test: function (r) { return r.parries >= 10; } },
    { id: 'rank_ss', n: '完全勝利', d: 'ランク SS を獲得する', cr: 1500,
      test: function (r) { return r.rank === 'SS'; } },
    { id: 'core', n: '銀河核制圧', d: '宙域8「銀河核」を制圧する', cr: 2500,
      test: function (r) { return r.cleared && mission(r) && r.sector.id === 's8'; } },
    { id: 'singularity', n: '特異点踏破', d: 'SINGULARITY で任務を達成する', cr: 5000,
      test: function (r) { return r.cleared && mission(r) && r.diff.id === 'singularity'; } },
    { id: 'endless20', n: '果てなき航海', d: '無限航行で WAVE 20 に到達する', cr: 2000,
      test: function (r) { return r.sector.endless && r.wave >= 20; } },
    { id: 'daily', n: '日課', d: 'デイリー任務に挑戦する', cr: 200,
      test: function (r) { return !!r.daily; } },
    { id: 'practice', n: '訓練生', d: '訓練を完了する', cr: 100,
      test: function (r) { return r.practice && r.cleared; } },
    { id: 'custom', n: '自習', d: 'カスタム単語で訓練を完了する', cr: 200,
      test: function (r) { return r.practice && r.cleared && r.source === 'custom'; } },
    { id: 'level30', n: '熟練', d: 'パイロットレベル30に到達する', cr: 1000,
      test: function (r, run, s) { return s.pilot.level >= 30; } },
    { id: 'legendary', n: '伝説との邂逅', d: 'LEGENDARY 以上の装備を入手する', cr: 800,
      test: function (r) {
        return (r.loot || []).some(function (it) { return it.rarity === 'legendary' || it.rarity === 'mythic'; });
      } }
  ];
  var MAP = {};
  LIST.forEach(function (a) { MAP[a.id] = a; });

  /* 新たに解除された実績の配列を返し、セーブへ記録して報酬を払う */
  function check(res, run, save) {
    save.achievements = save.achievements || {};
    var got = [];
    for (var i = 0; i < LIST.length; i++) {
      var a = LIST[i];
      if (save.achievements[a.id]) continue;
      var hit = false;
      try { hit = !!a.test(res, run, save); } catch (e) { hit = false; }
      if (!hit) continue;
      save.achievements[a.id] = Date.now();
      save.pilot.credits += a.cr;
      got.push(a);
    }
    return got;
  }
  function count(save) {
    var n = 0;
    for (var k in (save.achievements || {})) if (MAP[k]) n++;
    return n;
  }

  return { LIST: LIST, MAP: MAP, check: check, count: count };
})();
