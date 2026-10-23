/* ============================================================
   SPACE TYPING - ui.js
   画面遷移 / メニュー / 格納庫 / 補給ドック / 設定 / リザルト
   ============================================================ */
ST.UI = (function () {
  var U = ST.U, I = ST.Items;
  var $ = function (id) { return document.getElementById(id); };
  var cur = null;              /* 現在の画面ID */
  var stack = [];              /* 戻る用 */
  var sel = 0;                 /* キーボード選択位置 */
  var pending = { diff: 'pilot', sector: 's1' };
  var selectedItem = null;

  /* 画面ごとの再構築関数。show() は必ずこれを通してから表示するので、
     補給ドックでのガチャ・売却などでセーブデータが変わっても、
     戻ってきた画面が古い内容のまま残ることがない。
     （関数宣言は巻き上げられるため、ここで参照して問題ない） */
  var BUILDERS = {
    'scr-title': buildTitle,
    'scr-difficulty': buildDifficulty,
    'scr-sector': buildSector,
    'scr-hangar': buildHangar,
    'scr-shop': buildShop,
    'scr-settings': buildSettings,
    'scr-help': buildHelp,
    'scr-pause': buildPause,
    'scr-daily': buildDaily,
    'scr-training': buildTraining,
    'scr-analysis': buildAnalysis,
    'scr-skills': buildSkills,
    'scr-achieve': buildAchieve
  };

  function show(id, push) {
    var all = document.querySelectorAll('#screens .screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
    if (push && cur) stack.push(cur);
    cur = id;
    sel = 0;
    if (id) {
      var build = BUILDERS[id];
      if (build) build();
      var el = $(id);
      if (el) el.classList.add('active');
      syncSel();
    }
  }
  function back() {
    var prev = stack.pop();
    show(prev || 'scr-title');
    ST.Audio.play('ui');
  }

  /* ---------- キーボードナビゲーション ---------- */
  function navItems() {
    if (!cur) return [];
    var el = $(cur);
    if (!el) return [];
    return Array.prototype.slice.call(el.querySelectorAll('.menu-item:not(.locked), .card:not(.locked)'));
  }
  function syncSel() {
    var items = navItems();
    items.forEach(function (it, i) { it.classList.toggle('sel', i === sel); });
    if (items[sel] && items[sel].scrollIntoView) {
      items[sel].scrollIntoView({ block: 'nearest' });
    }
  }
  function onKey(ev) {
    if (!cur) return;
    /* 入力欄（カスタム単語）では矢印や Enter をメニュー操作に取らない */
    if (ev.target && /^(TEXTAREA|INPUT)$/.test(ev.target.tagName || '')) return;
    var items = navItems();
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
      if (!items.length) return;
      ev.preventDefault(); sel = (sel + 1) % items.length; syncSel(); ST.Audio.play('ui');
    } else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') {
      if (!items.length) return;
      ev.preventDefault(); sel = (sel - 1 + items.length) % items.length; syncSel(); ST.Audio.play('ui');
    } else if (ev.key === 'Enter') {
      if (!items.length) return;
      ev.preventDefault();
      if (items[sel]) items[sel].click();
    } else if (ev.key === 'Tab') {
      ev.preventDefault();                     /* 画面表示中のフォーカス移動を止める */
    } else if (ev.key === 'Escape') {
      if (cur === 'scr-pause') return;         /* game.js が処理 */
      if (cur === 'scr-title' || cur === 'scr-result') return;
      ev.preventDefault(); back();
    }
  }

  /* ---------- 汎用ビルダ ---------- */
  function menuItem(label, fn, locked) {
    var b = document.createElement('button');
    b.className = 'menu-item' + (locked ? ' locked' : '');
    b.textContent = label;
    if (!locked) b.onclick = function () { ST.Audio.play('ok'); fn(); };
    else b.onclick = function () { ST.Audio.play('deny'); };
    return b;
  }
  function card(opts) {
    var d = document.createElement('div');
    d.className = 'card' + (opts.locked ? ' locked' : '');
    var side = opts.side ? '<div class="c-side">' + opts.side + '</div>' : '';
    d.innerHTML = '<div class="c-main"><div class="c-name" style="' +
      (opts.color ? 'color:' + opts.color : '') + '">' + opts.name + '</div>' +
      '<div class="c-desc">' + opts.desc + '</div>' +
      (opts.tags ? '<div class="tagrow">' + opts.tags + '</div>' : '') +
      (opts.records ? '<div class="tagrow recrow">' + opts.records + '</div>' : '') +
      '</div>' + side;
    if (!opts.locked && opts.onclick) d.onclick = function () { ST.Audio.play('ok'); opts.onclick(); };
    else if (opts.locked) d.onclick = function () { ST.Audio.play('deny'); };
    return d;
  }

  /* ============================================================
     タイトル
     ============================================================ */
  function buildTitle() {
    var m = $('titleMenu');
    m.innerHTML = '';
    m.appendChild(menuItem('出 撃  SORTIE', function () { show('scr-difficulty', true); }));
    m.appendChild(menuItem('デイリー  DAILY OPS', function () { show('scr-daily', true); }, !dailyUnlocked()));
    m.appendChild(menuItem('訓 練  TRAINING', function () { show('scr-training', true); }));
    m.appendChild(menuItem('格 納 庫  HANGAR', function () { show('scr-hangar', true); }));
    m.appendChild(menuItem('分 析  ANALYSIS', function () { show('scr-analysis', true); }));
    m.appendChild(menuItem('実 績  ACHIEVEMENTS', function () { show('scr-achieve', true); }));
    m.appendChild(menuItem('遊 び 方  HOW TO PLAY', function () { show('scr-help', true); }));
    m.appendChild(menuItem('設 定  SETTINGS', function () { show('scr-settings', true); }));

    var d = ST.Save.d;
    var need = ST.Growth.expToNext(d.pilot.level);
    $('pilotStrip').innerHTML =
      'LV <b>' + d.pilot.level + '</b>' +
      (d.pilot.statPoints > 0 ? '<span style="color:#ffc24d">技能P <b>' + d.pilot.statPoints + '</b></span>' : '') +
      '<span>EXP <b>' + U.fmt(d.pilot.exp) + '</b> / ' + U.fmt(need) + '</span>' +
      '<span>CR <b>' + U.fmt(d.pilot.credits) + '</b></span>' +
      '<span>BEST 打/秒 <b>' + (d.stats.bestKps || 0).toFixed(1) + '</b></span>' +
      '<span>KILLS <b>' + U.fmt(d.stats.totalKills) + '</b></span>' +
      (ST.Save.lastError()
        ? '<span style="color:#ff4d5e">! ' + U.esc(ST.Save.lastError()) + '</span>' : '');
  }

  /* ============================================================
     難易度
     ============================================================ */
  function clearedCount() {
    var c = ST.Save.d.progress.clearedSectors, n = 0;
    for (var k in c) if (c[k]) n++;
    return n;
  }
  function diffUnlocked(d) {
    var n = clearedCount();
    if (d.id === 'ace') return n >= 1;
    if (d.id === 'veteran') return n >= 3;
    if (d.id === 'nightmare') return n >= 5;
    if (d.id === 'singularity') return !!ST.Save.d.progress.clearedSectors.s8;
    return true;
  }
  function diffReq(d) {
    if (d.id === 'ace') return '宙域を1つ制圧で解放';
    if (d.id === 'veteran') return '宙域を3つ制圧で解放';
    if (d.id === 'nightmare') return '宙域を5つ制圧で解放';
    if (d.id === 'singularity') return '銀河核の制圧で解放';
    return '';
  }

  function buildDifficulty() {
    var box = $('diffList');
    box.innerHTML = '';
    ST.Difficulty.list.forEach(function (d) {
      var un = diffUnlocked(d);
      var tags = '<span class="tag">敵耐久 x' + d.hpMul.toFixed(2) + '</span>' +
        '<span class="tag">弾速 x' + d.bulletSpeed.toFixed(2) + '</span>' +
        '<span class="tag">弾数 x' + d.bulletCount.toFixed(2) + '</span>' +
        '<span class="tag ' + (d.lockDrop ? 'hot' : '') + '">' + (d.lockDrop ? 'ミスでエネルギー減少' : 'ミス罰則なし') + '</span>' +
        '<span class="tag hot">レーザー x' + d.laser.toFixed(2) + '</span>' +
        '<span class="tag good">EXP x' + d.exp.toFixed(2) + '</span>' +
        '<span class="tag good">入手 x' + d.drop.toFixed(2) + '</span>';
      box.appendChild(card({
        name: d.name + '  /  ' + d.ja,
        desc: un ? d.desc : '<span style="color:#ff4d5e">LOCKED &mdash; ' + diffReq(d) + '</span>',
        tags: tags, color: d.color, locked: !un,
        side: 'SCORE<b>x' + d.score.toFixed(1) + '</b>',
        onclick: function () { pending.diff = d.id; show('scr-sector', true); }
      }));
    });
  }

  /* ============================================================
     宙域選択
     ============================================================ */
  function sectorUnlocked(s) {
    if (!s.req) return true;
    return !!ST.Save.d.progress.clearedSectors[s.req];
  }
  function buildSector() {
    var box = $('sectorList');
    box.innerHTML = '';
    var recs = ST.Save.d.records;
    var list = ST.Sectors.list.concat([ST.Sectors.endless]);
    list.forEach(function (s) {
      var un = sectorUnlocked(s);
      var key = s.id + '|' + pending.diff;
      var rec = recs[key];
      var cleared = ST.Save.d.progress.clearedSectors[s.id];
      var dname = ST.Difficulty.get(pending.diff).name;
      var side = '<span style="font-size:9px">BEST / ' + dname + '</span>' +
        '<b>' + (rec ? U.fmt(rec.score) : '-') + '</b>' +
        (rec ? '<span style="color:#ffc24d">RANK ' + rec.rank + '</span>' : '');

      /* 記録は (宙域 × 難易度) ごとに保存される。選択中の難易度ぶんだけを出すと
         難易度を変えた瞬間に過去のスコアが消えたように見えるので、
         その宙域で残した全難易度の記録を並べる。 */
      var recChips = '';
      ST.Difficulty.list.forEach(function (df) {
        var r = recs[s.id + '|' + df.id];
        if (!r) return;
        recChips += '<span class="tag" style="border-color:' + df.color + ';color:' + df.color +
          (df.id === pending.diff ? ';background:rgba(255,255,255,.08)' : '') + '">' +
          df.name + ' ' + U.fmt(r.score) +
          ' <b style="color:#ffc24d">' + r.rank + '</b></span>';
      });
      if (recChips) recChips = '<span class="tag rec-label">記録</span>' + recChips;

      var tags = '<span class="tag">敵 ' + s.enemies.length + '種</span>' +
        '<span class="tag">' + (s.endless ? 'WAVE ∞' : 'WAVE ' + s.waves + ' + BOSS') + '</span>' +
        '<span class="tag">装備Lv ' + s.ilvl + '</span>' +
        (cleared ? '<span class="tag good">制圧済</span>' : '');
      box.appendChild(card({
        name: (s.endless ? '∞' : 'SECTOR ' + s.num) + '  ' + s.ja,
        desc: un ? s.name + ' &mdash; ' + s.desc
          : '<span style="color:#ff4d5e">LOCKED &mdash; 前の宙域を制圧せよ</span>',
        tags: tags, records: recChips, locked: !un, side: side,
        onclick: function () {
          pending.sector = s.id;
          show(null);
          stack.length = 0;
          ST.Game.start(s.id, pending.diff);
        }
      }));
    });
  }

  /* ============================================================
     格納庫
     ============================================================ */
  var SLOT_LABEL = { weapon: '照準系', core: '機関系', armor: '装甲系', module1: '拡張1', module2: '拡張2' };
  var SLOT_KIND = { weapon: 'weapon', core: 'core', armor: 'armor', module1: 'module', module2: 'module' };

  /* 補給ドックでの売却などで選択中のアイテムが所持品から消えることがある。
     消えたアイテムを指したままだと詳細ペインから複製できてしまうため、
     格納庫を組み直すたびに実体が残っているか確かめる。 */
  function pruneSelection() {
    if (!selectedItem) return;
    var d = ST.Save.d;
    if (selectedItem.equipped) {
      if (d.equipped[selectedItem.equipped] !== selectedItem.item) selectedItem = null;
    } else if (d.inventory.indexOf(selectedItem.item) < 0) {
      selectedItem = null;
    }
  }

  function buildHangar() {
    pruneSelection();
    var d = ST.Save.d;
    /* --- パイロット --- */
    var st = ST.Game.computeStats();
    var need = ST.Growth.expToNext(d.pilot.level);
    var rows = [
      ['レベル', d.pilot.level],
      ['EXP', U.fmt(d.pilot.exp) + ' / ' + U.fmt(need)],
      ['所持資金', U.fmt(d.pilot.credits) + ' CR'],
      ['装甲値', st.maxHp],
      ['砲撃力', st.atk.toFixed(1)],
      ['会心率 / 倍率', st.crit.toFixed(1) + '% / ' + st.critMult.toFixed(0) + '%'],
      ['完撃倍率', '+' + st.finisher.toFixed(0) + '%'],
      ['被害軽減', st.def.toFixed(1) + '%'],
      ['障壁容量', st.shieldMax],
      ['迎撃射程', '210 (固定)'],
      ['迎撃爆風', Math.round(st.interceptBlast)],
      ['迎撃容量', st.energyMax],
      ['充填速度', st.energyCharge.toFixed(1) + ' / 打鍵'],
      ['迎撃消費', st.interceptCost.toFixed(1) + ' / 発'],
      ['無償迎撃', st.freeIntercept.toFixed(0) + '%'],
      ['満タンで迎撃', Math.floor(st.energyMax / Math.max(0.1, st.interceptCost)) + ' 発'],
      ['OD蓄積 / 持続', '+' + st.odGain.toFixed(0) + '% / +' + st.odDuration.toFixed(0) + '%'],
      ['経験値 / 入手率', '+' + st.expGain.toFixed(0) + '% / +' + st.dropRate.toFixed(0) + '%'],
      ['技能ポイント', d.pilot.statPoints + ' (使用 ' + ST.Skills.spent(d.pilot) + ')']
    ];
    $('pilotStats').innerHTML = rows.map(function (r) {
      return '<div class="kv"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    }).join('');

    /* --- 装備スロット --- */
    var es = $('equipSlots');
    es.innerHTML = '';
    ['weapon', 'core', 'armor', 'module1', 'module2'].forEach(function (k) {
      var it = d.equipped[k];
      var row = document.createElement('div');
      row.className = 'slot';
      row.innerHTML = '<span class="s-type">' + SLOT_LABEL[k] + '</span>' +
        (it ? '<span class="s-name r-' + it.rarity + '">' + U.esc(it.name) + '</span><span class="s-lv">Lv' + it.ilvl + '</span>'
          : '<span class="s-name empty-slot">&mdash; 空 &mdash;</span>');
      row.onclick = function () {
        if (it) { selectedItem = { item: it, equipped: k }; renderDetail(); }
      };
      es.appendChild(row);
    });

    /* --- インベントリ --- */
    renderInventory();
    renderDetail();
    $('btnShop').onclick = function () { ST.Audio.play('ok'); show('scr-shop', true); };
    $('btnSkills').onclick = function () { ST.Audio.play('ok'); show('scr-skills', true); };
  }

  function renderInventory() {
    var d = ST.Save.d;
    var box = $('invList');
    box.innerHTML = '';
    $('invCount').textContent = d.inventory.length + ' / ' + I.INV_MAX;
    if (!d.inventory.length) {
      box.innerHTML = '<div style="color:#3d5570;font-size:11px;padding:8px">戦闘で装備を入手すると、ここに並びます。</div>';
      return;
    }
    var ORDER = { mythic: 0, legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5 };
    var sorted = d.inventory.slice().sort(function (a, b) {
      if (ORDER[a.rarity] !== ORDER[b.rarity]) return ORDER[a.rarity] - ORDER[b.rarity];
      return b.ilvl - a.ilvl;
    });
    sorted.forEach(function (it) {
      var row = document.createElement('div');
      row.className = 'itemrow';
      var better = isUpgrade(it);
      row.innerHTML = '<span class="ir-lv">L' + it.ilvl + '</span>' +
        '<span class="ir-name r-' + it.rarity + '">' + U.esc(it.name) + '</span>' +
        (it.locked ? '<span class="ir-lock">LOCK</span>' : '') +
        (better ? '<span class="ir-e">▲</span>' : '') +
        '<span class="ir-lv">' + slotShort(it.slot) + '</span>';
      row.onclick = function () {
        selectedItem = { item: it, equipped: null };
        renderInventory(); renderDetail();
        row.classList.add('sel');
      };
      if (selectedItem && selectedItem.item === it) row.classList.add('sel');
      box.appendChild(row);
    });
  }
  function slotShort(s) { return { weapon: '照準', core: '機関', armor: '装甲', module: '拡張' }[s] || s; }

  /* 拡張スロットは2つある。空きがあればそちら、両方埋まっていれば
     弱い方を既定の置換先にする。（常に拡張1を返していたため、
     拡張2が一度埋まると入れ替えられなくなっていた） */
  function weakerModuleSlot() {
    var d = ST.Save.d;
    if (!d.equipped.module1) return 'module1';
    if (!d.equipped.module2) return 'module2';
    return I.powerOf(d.equipped.module1) <= I.powerOf(d.equipped.module2) ? 'module1' : 'module2';
  }
  function targetSlotFor(item) {
    return item.slot === 'module' ? weakerModuleSlot() : item.slot;
  }
  function isUpgrade(item) {
    var d = ST.Save.d;
    var cur = d.equipped[targetSlotFor(item)];
    if (!cur) return true;
    return I.powerOf(item) > I.powerOf(cur);
  }

  function renderDetail() {
    var box = $('itemDetail');
    if (!selectedItem) {
      box.innerHTML = '<div style="color:#3d5570;font-size:11px">左のリストから装備を選択してください。</div>';
      return;
    }
    var it = selectedItem.item;
    var rar = I.RMAP[it.rarity];
    var slotKey = selectedItem.equipped || targetSlotFor(it);
    var comparedTo = selectedItem.equipped ? null : ST.Save.d.equipped[slotKey];

    var html = '<div class="detail-name r-' + it.rarity + '">' + U.esc(it.name) + '</div>' +
      '<div class="detail-sub">' + rar.name + ' &middot; ' + slotShort(it.slot) + ' &middot; Lv' + it.ilvl +
      ' &middot; POWER ' + it.power + '</div>';

    var cmp = I.compare(it, comparedTo);
    html += cmp.map(function (a) {
      var lbl = I.affixLabel({ k: a.k, v: a.v });
      var delta = '';
      if (comparedTo) {
        var dv = Math.round(a.delta * 10) / 10;
        if (dv > 0) delta = ' <span style="color:#59ff9e">(+' + dv + ')</span>';
        else if (dv < 0) delta = ' <span style="color:#ff4d5e">(' + dv + ')</span>';
      }
      return '<div class="affix">' + lbl + delta + '</div>';
    }).join('');

    if (it.unique) {
      var u = I.uniqueDef(it.unique);
      if (u) html += '<div class="uniquetext"><b>【' + u.n + '】</b><br>' + u.d + '</div>';
    }

    if (comparedTo) {
      html += '<div style="font-size:9px;color:#6f8bab;margin-top:8px">比較対象: ' +
        SLOT_LABEL[slotKey] + ' ' + U.esc(comparedTo.name) +
        ' (POWER ' + comparedTo.power + ')</div>';
    }

    /* ロック中は売却ボタンを出さない（一括売却・所持上限の自動売却からも除外される） */
    var sellBtn = it.locked ? '' :
      '<button class="btn" id="btnSell">売却 ' + U.fmt(I.sellPrice(it)) + ' CR</button>';
    var lockBtn = '<button class="btn ghost" id="btnLock">' + (it.locked ? 'ロック解除' : 'ロック') + '</button>';
    html += '<div class="detail-actions">';
    if (selectedItem.equipped) {
      html += '<button class="btn" id="btnUnequip">外す</button>';
    } else if (it.slot === 'module') {
      /* 拡張は2スロットあるので、どちらへ装備するかを明示的に選ばせる */
      html += '<button class="btn' + (targetSlotFor(it) === 'module1' ? ' primary' : '') +
        '" id="btnEquip1">拡張1へ</button>' +
        '<button class="btn' + (targetSlotFor(it) === 'module2' ? ' primary' : '') +
        '" id="btnEquip2">拡張2へ</button>' + sellBtn;
    } else {
      html += '<button class="btn primary" id="btnEquip">装備する</button>' + sellBtn;
    }
    html += lockBtn + '</div>';
    box.innerHTML = html;

    var be = $('btnEquip'), bs = $('btnSell'), bu = $('btnUnequip'), bl = $('btnLock');
    var b1 = $('btnEquip1'), b2 = $('btnEquip2');
    if (bl) bl.onclick = function () { toggleLock(it); };
    if (be) be.onclick = function () { equipItem(it); };
    if (b1) b1.onclick = function () { equipItem(it, 'module1'); };
    if (b2) b2.onclick = function () { equipItem(it, 'module2'); };
    if (bs) bs.onclick = function () { sellItem(it); };
    if (bu) bu.onclick = function () { unequip(selectedItem.equipped); };
  }

  /* slot を渡すとそのスロットへ、省略時は既定の置換先へ装備する */
  function equipItem(it, slot) {
    var d = ST.Save.d;
    var idx = d.inventory.indexOf(it);
    /* 所持していないものは装備できない（複製防止） */
    if (idx < 0) {
      ST.Audio.play('deny');
      selectedItem = null;
      buildHangar();
      return;
    }
    /* 指定スロットが装備の種別と合わない場合は既定へ倒す */
    if (!slot || SLOT_KIND[slot] !== it.slot) slot = targetSlotFor(it);
    var prev = d.equipped[slot];
    d.inventory.splice(idx, 1);
    d.equipped[slot] = it;
    if (prev) d.inventory.push(prev);
    ST.Save.save();
    ST.Audio.play('ok');
    selectedItem = { item: it, equipped: slot };
    buildHangar();
  }
  function unequip(slot) {
    var d = ST.Save.d;
    var it = d.equipped[slot];
    if (!it) return;
    d.equipped[slot] = null;
    d.inventory.push(it);
    ST.Save.save();
    ST.Audio.play('ui');
    selectedItem = null;
    buildHangar();
  }
  function toggleLock(it) {
    it.locked = !it.locked;
    ST.Save.save();
    ST.Audio.play('ui');
    buildHangar();
  }
  function sellItem(it) {
    var d = ST.Save.d;
    var idx = d.inventory.indexOf(it);
    if (idx < 0 || it.locked) { ST.Audio.play('deny'); return; }
    d.inventory.splice(idx, 1);
    d.pilot.credits += I.sellPrice(it);
    ST.Save.save();
    ST.Audio.play('loot');
    selectedItem = null;
    buildHangar();
  }

  /* ============================================================
     補給ドック
     ============================================================ */
  function buildShop() {
    var d = ST.Save.d;
    var lv = d.pilot.level;
    var packs = [
      { name: '標準補給', desc: '装備を1つ入手。レアリティは運次第。', price: 350, ilvl: lv + 2, floor: null, n: 1 },
      { name: '精密補給', desc: 'RARE 以上を1つ確定で入手。', price: 1400, ilvl: lv + 5, floor: 2, n: 1 },
      { name: '特務補給', desc: 'EPIC 以上を1つ確定。稀にユニーク効果付き。', price: 4200, ilvl: lv + 9, floor: 3, n: 1 }
    ];
    var html = '<div class="credits">所持資金 ' + U.fmt(d.pilot.credits) + ' CR</div><div class="shop-grid">';
    packs.forEach(function (p, i) {
      html += '<div class="shop-card" data-i="' + i + '"><h4>' + p.name + '</h4><p>' + p.desc +
        '</p><div class="price">' + U.fmt(p.price) + ' CR</div></div>';
    });
    html += '</div>';
    html += '<div class="setrow"><div class="s-lab"><b>一括売却</b><small>COMMON / UNCOMMON をまとめて売却します（ロック中は除く）</small></div>' +
      '<button class="btn" id="btnSellJunk">売却する</button></div>';
    html += '<div id="shopResult" style="margin-top:14px"></div>';
    $('shopBody').innerHTML = html;

    var cards = $('shopBody').querySelectorAll('.shop-card');
    for (var i = 0; i < cards.length; i++) {
      (function (idx) {
        cards[idx].onclick = function () { buy(packs[idx]); };
      })(i);
    }
    junkArmed = false;
    $('btnSellJunk').onclick = sellJunk;
  }

  function buy(p) {
    var d = ST.Save.d;
    if (d.inventory.length >= I.INV_MAX) {
      ST.Audio.play('deny');
      $('shopResult').innerHTML = '<div style="color:#ff4d5e;font-size:11px">所持品が上限 (' + I.INV_MAX +
        ') に達しています。売却してから購入してください。</div>';
      return;
    }
    if (d.pilot.credits < p.price) {
      ST.Audio.play('deny');
      $('shopResult').innerHTML = '<div style="color:#ff4d5e;font-size:11px">資金が足りません。</div>';
      return;
    }
    d.pilot.credits -= p.price;
    var item = I.generate(p.ilvl, { floorTier: p.floor, luck: 0.4 });
    d.inventory.push(item);
    ST.Save.save();
    ST.Audio.play('loot');
    var u = item.unique ? I.uniqueDef(item.unique) : null;
    $('shopResult').innerHTML =
      '<div class="loot-title">入手</div>' +
      '<div class="detail-name r-' + item.rarity + '">' + U.esc(item.name) + '</div>' +
      '<div class="detail-sub">' + I.RMAP[item.rarity].name + ' &middot; ' + slotShort(item.slot) + ' &middot; Lv' + item.ilvl + '</div>' +
      item.affixes.map(function (a) { return '<div class="affix">' + I.affixLabel(a) + '</div>'; }).join('') +
      (u ? '<div class="uniquetext"><b>【' + u.n + '】</b> ' + u.d + '</div>' : '');
    buildShopCredits();
  }
  function buildShopCredits() {
    var c = $('shopBody').querySelector('.credits');
    if (c) c.textContent = '所持資金 ' + U.fmt(ST.Save.d.pilot.credits) + ' CR';
  }
  function isJunk(it) { return !it.locked && (it.rarity === 'common' || it.rarity === 'uncommon'); }
  /* 取り返しがつかないので、1回目は件数と金額を見せて確認し、2回目で実行する */
  var junkArmed = false;
  function sellJunk() {
    var d = ST.Save.d;
    var total = 0, n = 0;
    d.inventory.forEach(function (it) { if (isJunk(it)) { total += I.sellPrice(it); n++; } });
    var btn = $('btnSellJunk');
    if (!n) {
      ST.Audio.play('deny');
      $('shopResult').innerHTML = '<div style="font-size:11px;color:#6f8bab">売却できる COMMON / UNCOMMON はありません。</div>';
      return;
    }
    if (!junkArmed) {
      junkArmed = true;
      btn.textContent = n + '個 / ' + U.fmt(total) + ' CR で売却？';
      ST.Audio.play('deny');
      return;
    }
    junkArmed = false;
    btn.textContent = '売却する';
    d.inventory = d.inventory.filter(function (it) { return !isJunk(it); });
    d.pilot.credits += total;
    ST.Save.save();
    ST.Audio.play(n ? 'loot' : 'deny');
    $('shopResult').innerHTML = '<div style="font-size:11px;color:#59ff9e">' + n + ' 個を売却し ' +
      U.fmt(total) + ' CR を得た。</div>';
    buildShopCredits();
  }

  /* ============================================================
     設定
     ============================================================ */
  function seg(id, options, value) {
    var h = '<div class="seg" id="' + id + '">';
    options.forEach(function (o) {
      h += '<button data-v="' + o[0] + '" class="' + (o[0] === value ? 'on' : '') + '">' + o[1] + '</button>';
    });
    return h + '</div>';
  }
  function bindSeg(id, onPick) {
    var box = $(id); if (!box) return;
    var bs = box.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) {
      (function (b) {
        b.onclick = function () {
          for (var j = 0; j < bs.length; j++) bs[j].classList.remove('on');
          b.classList.add('on');
          ST.Audio.play('ui');
          onPick(b.getAttribute('data-v'));
        };
      })(bs[i]);
    }
  }

  function buildSettings() {
    var s = ST.Save.d.settings;
    var h = '';
    h += row('出題言語', 'かな(ローマ字入力) / 英単語 / 混合',
      seg('setLang', [['ja', '日本語'], ['en', 'ENGLISH'], ['mix', 'MIX']], s.lang));
    h += row('ローマ字ガイド', '敵の上にローマ字を表示する',
      seg('setRomaji', [['1', 'ON'], ['0', 'OFF']], s.showRomaji ? '1' : '0'));
    h += row('サウンド', '効果音とBGMの有効化',
      seg('setAudio', [['1', 'ON'], ['0', 'OFF']], s.audio ? '1' : '0'));
    h += '<div class="setrow"><div class="s-lab"><b>効果音 音量</b></div>' +
      '<input type="range" id="setSfx" min="0" max="1" step="0.05" value="' + s.sfxVol + '"></div>';
    h += '<div class="setrow"><div class="s-lab"><b>BGM 音量</b></div>' +
      '<input type="range" id="setMusic" min="0" max="0.6" step="0.02" value="' + s.musicVol + '"></div>';
    h += row('走査線エフェクト', 'CRT風のスキャンライン',
      seg('setCrt', [['1', 'ON'], ['0', 'OFF']], s.crt ? '1' : '0'));
    h += row('画面振動', '被弾・撃破時のシェイク',
      seg('setShake', [['1', 'ON'], ['0', 'OFF']], s.shake ? '1' : '0'));
    h += row('パーティクル', '描画が重い場合は控えめに',
      seg('setPtc', [['1', '標準'], ['0', '控えめ']], s.particles ? '1' : '0'));
    h += '<div class="setrow"><div class="s-lab"><b style="color:#ff4d5e">セーブデータ消去</b>' +
      '<small>レベル・装備・記録がすべて失われます</small></div>' +
      '<button class="btn" id="setReset">消去する</button></div>';
    $('settingsBody').innerHTML = h;

    bindSeg('setLang', function (v) { s.lang = v; save(); });
    bindSeg('setRomaji', function (v) { s.showRomaji = v === '1'; save(); });
    bindSeg('setAudio', function (v) { s.audio = v === '1'; save(); ST.Game.applyAudioSettings(); });
    bindSeg('setCrt', function (v) { s.crt = v === '1'; save(); ST.Game.applyAudioSettings(); });
    bindSeg('setShake', function (v) { s.shake = v === '1'; save(); });
    bindSeg('setPtc', function (v) { s.particles = v === '1' ? 1 : 0; save(); });
    $('setSfx').oninput = function () { s.sfxVol = parseFloat(this.value); ST.Audio.setSfx(s.sfxVol); save(); };
    $('setMusic').oninput = function () { s.musicVol = parseFloat(this.value); ST.Audio.setMusic(s.musicVol); save(); };
    var rst = $('setReset'), armed = false;
    rst.onclick = function () {
      if (!armed) { armed = true; rst.textContent = '本当に消去する？'; ST.Audio.play('deny'); return; }
      ST.Save.reset();
      ST.Audio.play('ok');
      show('scr-title'); stack.length = 0;
    };
    function save() { ST.Save.save(); }
  }
  function row(label, sub, control) {
    return '<div class="setrow"><div class="s-lab"><b>' + label + '</b><small>' + sub + '</small></div>' + control + '</div>';
  }

  /* ============================================================
     遊び方
     ============================================================ */
  function buildHelp() {
    $('helpBody').innerHTML = [
      '<h4>基本ルール</h4>',
      '<p>敵は単語を背負って飛来し、同時に<em>弾幕</em>を撒きます。単語を打ち切って撃墜しつつ、迫る弾は<em>迎撃エネルギー</em>で自動的に叩き落とします。</p>',
      '<h4>2つのモード</h4>',
      '<p><span class="kbig">TAB</span> で切り替えます。打鍵の行き先はモードだけで決まるので、狙った相手を外すことはありません。</p>',
      '<p><em>攻撃モード</em> &mdash; 打鍵は目標の敵だけに入ります。1打ごとにダメージ、打ち切ると<em>完撃</em>で確実に撃破。ただしエネルギーは充填されません。</p>',
      '<p><em>迎撃モード</em> &mdash; 敵とは無関係のワードが出ます。それを打つとエネルギーが貯まりますが、その間ダメージは出せません。</p>',
      '<h4>迎撃エネルギー</h4>',
      '<p>迎撃は<span class="kbig">モードに関係なく自動</span>で行われ、1発ごとにエネルギーを消費します。つまり<em>容量 = 攻撃モードを続けられる時間</em>です。',
      '撃ち落とした弾の<em>爆風</em>に巻き込まれた弾は無償なので、爆風強化は燃費に直結します。</p>',
      '<p>迎撃には<em>発射間隔</em>があり、一度に押し寄せる弾は撃ち切れません。密集した弾幕は爆風で巻き込むしかありません。</p>',
      '<h4>戦域圧力とレーザー</h4>',
      '<p>画面上部の<em>戦域圧力</em>は時間とともに上がり、敵を撃破すると下がります。',
      '圧力が高いほど、敵は通常弾の代わりに<span class="kbig">迎撃できないレーザー</span>を撃ってきます。</p>',
      '<p>レーザーは予告線が<em>自機を追尾</em>したあと一瞬で着弾します。<em>必中で、撃ち落とす手段もありません</em>。',
      '対処法は圧力を下げること &mdash; つまり<em>敵を素早く倒し、任務を早く終わらせること</em>だけです。</p>',
      '<p>圧力の効きは加速度的です。半分程度なら散発的ですが、<em>85%を超えると連射域</em>に入り、',
      '1発の威力も3倍近くまで上がります。<span class="kbig">100%では数秒で撃沈</span>します。',
      'CRITICAL PRESSURE の警告が出たら、何を措いても敵を落としてください。</p>',
      '<p>迎撃モードに篭れば弾は防げますが撃破が止まり、圧力が振り切れたまま任務が終わらず',
      'レーザーに焼かれます。守りに入り続けることが答えにならないよう設計されています。</p>',
      '<h4>オーバーロード</h4>',
      '<p>エネルギーが尽きると迎撃系がダウンし、<em>容量の35%まで充填し直すまで一切迎撃できません</em>。',
      'その間は<em>被害が1.5倍</em>になり、障壁も回復しません。一度枯渇させると立て直しが効かないので、',
      'ENGYバーが赤くなる前に迎撃モードへ戻ってください。</p>',
      '<p>また<em>被弾に無敵時間はありません</em>。弾幕の中に立ち尽くせば連続で削られます。</p>',
      '<h4>このゲームの肝</h4>',
      '<p>攻撃し続ければ火力は出ますが、エネルギーは減る一方です。<em>いつ手を止めて充填に戻るか</em> &mdash; この収支の判断が本作の核心です。',
      'ENGYバーが赤く点滅したら切替の合図。</p>',
      '<h4>目標の順番</h4>',
      '<p>敵には出現順に番号が振られ、<em>1番が自動的に目標</em>になります。撃破すれば次へ自動で進みます。',
      '倒しにくい敵を後回しにしたいときは <span class="kbig">SHIFT+TAB</span> で最後尾に回せます。</p>',
      '<h4>オーバードライブ</h4>',
      '<p>ゲージは正確な打鍵と、完撃・撃破で溜まります。<em>敵弾を迎撃してもゲージは一切増えません</em> &mdash; ',
      '守りに徹するほど切り札が遠のく、という取引です。</p>',
      '<p>満タンで <span class="kbig">ENTER</span>。<em>画面上の敵弾を全滅</em>させ、<em>戦域圧力を半減</em>、',
      '<em>迎撃エネルギーと障壁を全回復</em>し、そのうえ敵弾が減速してダメージが2倍になります。',
      '崩れかけた盤面をまとめて立て直せる、唯一の手段です。</p>',
      '<p>ただし必要量は<em>宙域が奥ほど、難易度が高いほど</em>増えます（最奥/特異点では入り口の9倍近く）。',
      '任務中は一定なので、出撃前に「この面では何発撃てるか」を見積もっておいてください。</p>',
      '<h4>成長と装備</h4>',
      '<p>撃破で経験値と装備を入手。<em>迎撃容量・充填速度・迎撃燃費・迎撃爆風</em>を伸ばすほど攻撃モードに留まれる時間が延び、',
      '<em>砲撃力・完撃倍率</em>を伸ばすほど1単語あたりの火力が上がります。EPIC以上には特殊効果が宿ります。</p>',
      '<h4>パリィ</h4>',
      '<p>レーザーの予告線が出ている間に、<em>攻撃モードで単語を打ち切る</em>と、予告を1本はじき返して撃った敵へ反射します',
      '（雑魚なら最大HPの半分、ボスなら2.5%）。迎撃モードの充填ワードでは発動しません。',
      '予告が出たら、打ちかけの単語を急いで打ち切ってください。技能「反射神経」で予告時間が延びます。</p>',
      '<h4>単語の仕掛け</h4>',
      '<p>一部の敵は単語に仕掛けを持ちます。目標にすると名札が出ます。</p>',
      '<p><em>分裂</em>（爆撃機）打ち切って倒すと、短い単語の破片2体に分かれる &nbsp; ',
      '<em>伏字</em>（幽鬼）先の2文字より後ろが＊で隠れる &nbsp; ',
      '<em>時限</em>（呪縛機）目標にしてから時間内に打てないと単語が変わる &nbsp; ',
      '<em>鏡像</em>（天輪）単語が左右反転して表示される</p>',
      '<p>ボスはフェーズが進むごとに 伏字 → 鏡像 → <em>残像</em>（最初の1.3秒だけ見え、その後は次の1文字以外が隠れる）と変化します。',
      '分裂以外の仕掛けは PILOT 以上で有効です。</p>',
      '<h4>コンボの節目</h4>',
      '<p>コンボが <em>50 / 100 / 200 以降100ごと</em>に達すると、自機の周りの敵弾が消え、戦域圧力が下がります（200以降は障壁も全快）。',
      'ミスをすると節目は遠のきます。被弾ではコンボは半分残ります。</p>',
      '<h4>訓練と打鍵分析</h4>',
      '<p>訓練では被弾もレーザーもなく、敵は単語を打ち切るまで落ちません。出題は<em>通常 / 苦手克服 / カスタム単語</em>から選べます。',
      '任務と訓練でミスしたキー・かな・単語は記録され、<em>分析</em>画面でキーボードの色分けとして見られます。',
      '苦手克服は、その記録をもとにミスの多い語を優先して出します。</p>',
      '<h4>デイリー任務</h4>',
      '<p>宙域1を制圧すると解放。日付で敵・ボス・補正が決まり、機体は全員共通の<em>規格機</em>（LV30 / RARE 装備）です。',
      '盤面と出題の並びは誰が遊んでも同じなので、記録を共有して競えます。その日の初クリアで 800 CR。</p>',
      '<h4>技能と実績</h4>',
      '<p>レベルが1上がるごとに<em>技能ポイント</em>を1得ます。格納庫の「技能」で攻撃・防御・技巧の3系統に振り分けられます（資金を払えば振り直し可）。',
      '実績は初回の解除時に資金がもらえます。</p>',
      '<p>自己ベストを持っている任務では、ウェーブを片付けるたびに<em>BEST比</em>（区間タイムの差）が表示されます。</p>',
      '<h4>操作一覧</h4>',
      '<p><span class="kbig">A-Z</span> と <span class="kbig">SPACE</span> タイピング &nbsp; ',
      '<span class="kbig">TAB</span> 攻撃/迎撃 切替 &nbsp; <span class="kbig">SHIFT+TAB</span> 目標を次へ &nbsp; ',
      '<span class="kbig">ENTER</span> オーバードライブ &nbsp; <span class="kbig">ESC</span> ポーズ</p>',
      '<h4>難易度</h4>',
      '<p>NOVICE から SINGULARITY まで7段階。上位ほど弾速・弾数が上がり迎撃の消費が激しくなります。</p>',
      '<p><em>ミスの重さも難易度で変わります。</em>ミスすると入力が硬直し、その間は何も打てません。',
      'NOVICE では0.16秒ですが、<em>SINGULARITY では0.78秒</em> &mdash; 単語ひとつ分の時間が丸ごと消えます。',
      'さらに VETERAN 以上では<em>迎撃エネルギーも削られ</em>、こちらも難易度に比例して重くなります。',
      '硬直中は画面中央に残り時間が表示されます。上位難易度では<em>速さより正確さ</em>が生存条件です。</p>',
      '<p>その分、経験値と入手率が大きく伸びます。</p>'
    ].join('');
  }

  /* ============================================================
     デイリー任務
     ============================================================ */
  function dailyUnlocked() { return !!ST.Save.d.progress.clearedSectors.s1; }
  function shareText(key, rec, mod) {
    return 'SPACE TYPING DAILY ' + key + ' [' + mod.n + '] ' +
      (rec.cleared ? 'CLEAR' : 'WAVE ' + rec.wave) + ' / SCORE ' + U.fmt(rec.score) +
      ' / RANK ' + rec.rank + ' / ' + rec.kps.toFixed(1) + '打/秒 / 正確率' + rec.acc + '%' +
      ' (' + ({ ja: '日本語', en: 'ENGLISH', mix: 'MIX' }[rec.lang] || '') + ')';
  }
  function copyText(text, msgEl) {
    var done = function (ok) {
      if (msgEl) msgEl.textContent = ok ? 'コピーしました' : 'コピーできませんでした。上の文を選択してコピーしてください';
    };
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        return;
      }
    } catch (e) { /* 下でまとめて扱う */ }
    done(false);
  }

  function buildDaily() {
    var d = ST.Save.d;
    var cfg = ST.Training.daily();
    var st = ST.Game.computeStats({ equipped: cfg.loadout, level: cfg.level, noSkills: true });
    var diff = ST.Difficulty.get(cfg.diffId);
    var rec = d.daily[cfg.key];
    var names = cfg.sector.enemies.map(function (k) { return ST.EnemyTypes.T[k].ja; }).join(' / ');
    var h = '<div class="card daily-card"><div class="c-main">' +
      '<div class="c-name" style="color:#ffc24d">' + cfg.key + '  日替わり任務</div>' +
      '<div class="c-desc">補正 <b style="color:#ff4d5e">【' + cfg.mod.n + '】</b> ' + cfg.mod.d + '<br>' +
      '敵: ' + names + '<br>ボス: ' + ST.EnemyTypes.BOSS[cfg.sector.boss].ja +
      ' &middot; 難易度 ' + diff.name + ' &middot; WAVE ' + cfg.sector.waves + ' + BOSS</div>' +
      '<div class="tagrow"><span class="tag">規格機 LV' + cfg.level + '</span>' +
      '<span class="tag">砲撃力 ' + st.atk.toFixed(0) + '</span>' +
      '<span class="tag">装甲値 ' + st.maxHp + '</span>' +
      '<span class="tag">迎撃容量 ' + st.energyMax + '</span>' +
      '<span class="tag">技能・自分の装備は使えない</span></div>' +
      '</div><div class="c-side">本日の記録<b>' + (rec ? U.fmt(rec.score) : '-') + '</b>' +
      (rec ? '<span style="color:#ffc24d">RANK ' + rec.rank + '</span>' : '<span>未挑戦</span>') +
      '</div></div>';
    h += '<div class="setrow"><div class="s-lab"><b>初クリア報酬</b><small>その日に初めてクリアすると資金を獲得。装備は落ちません</small></div>' +
      '<b style="color:' + (rec && rec.cleared ? '#6f8bab' : '#ffc24d') + '">' +
      (rec && rec.cleared ? '受取済' : '800 CR') + '</b></div>';
    if (rec) {
      h += '<div class="loot-title">記録を共有</div><div class="share-box">' + U.esc(shareText(cfg.key, rec, cfg.mod)) + '</div>' +
        '<div class="detail-actions"><button class="btn" id="btnDailyShare">コピー</button>' +
        '<span id="dailyShareMsg" style="font-size:10px;color:#6f8bab;align-self:center"></span></div>';
    }
    /* 直近の履歴 */
    var keys = Object.keys(d.daily).sort().reverse().slice(0, 7);
    if (keys.length) {
      h += '<div class="loot-title">履歴</div>';
      keys.forEach(function (k) {
        var r = d.daily[k];
        h += '<div class="kv"><span>' + k + '</span><b>' + U.fmt(r.score) + '  RANK ' + r.rank +
          (r.cleared ? '  CLEAR' : '') + '</b></div>';
      });
    }
    h += '<div style="font-size:9px;color:#3d5570;margin-top:10px;line-height:1.6">盤面と出題は日付で決まり、誰が遊んでも同じ並びになります。' +
      '出題言語は設定のものを使うので、共有するときは言語も合わせてください。</div>';
    $('dailyBody').innerHTML = h;
    var go = $('dailyBody').querySelector('.daily-card');
    if (go) go.onclick = function () { ST.Audio.play('ok'); startRun(function () { ST.Game.startDaily(); }); };
    var bs = $('btnDailyShare');
    if (bs) bs.onclick = function () { copyText(shareText(cfg.key, rec, cfg.mod), $('dailyShareMsg')); };
  }

  /* 任務へ移るときの共通処理 */
  function startRun(fn) {
    show(null);
    stack.length = 0;
    fn();
  }

  /* ============================================================
     訓練
     ============================================================ */
  var trainOpt = { source: 'normal', tier: 2 };
  var PRACTICE_DESC = ' 全6ウェーブ。報酬はありませんが、打鍵の記録は分析に反映されます。';
  function buildTraining() {
    var d = ST.Save.d;
    var hasData = ST.Training.hasData(d);
    var nCustom = (d.customWords || []).length;
    var note = '';
    if (trainOpt.source === 'weak' && !hasData) note = '分析データがまだありません。任務か訓練を一度遊ぶと苦手が記録されます（それまでは通常の出題）。';
    if (trainOpt.source === 'custom' && !nCustom) note = 'カスタム単語が登録されていません。下の欄に入力して保存してください。';
    var h = '<div class="card train-go"><div class="c-main"><div class="c-name">訓練開始</div>' +
      '<div class="c-desc">被弾・レーザー・戦域圧力なし。敵は撃ってこず、単語を打ち切るまで落ちません。' +
      PRACTICE_DESC + '</div></div><div class="c-side">START<b>▶</b></div></div>';
    if (note) h += '<div style="font-size:10px;color:#ffc24d;padding:6px 12px">' + note + '</div>';
    h += row('出題', '苦手克服はミスの多いキー・かな・単語を優先して出す',
      seg('trSource', [['normal', '通常'], ['weak', '苦手克服'], ['custom', 'カスタム (' + nCustom + ')']], trainOpt.source));
    h += row('単語の長さ', 'カスタム単語は近い長さを優先（語数が少なければ全体から）',
      seg('trTier', [['0', '短い'], ['2', '普通'], ['3', '長い'], ['4', 'とても長い']], String(trainOpt.tier)));
    h += row('出題言語', '設定画面と共通（カスタム単語には効かない）',
      seg('trLang', [['ja', '日本語'], ['en', 'ENGLISH'], ['mix', 'MIX']], d.settings.lang));

    h += '<div class="loot-title">カスタム単語</div>' +
      '<div style="font-size:9px;color:#6f8bab;line-height:1.7;margin-bottom:6px">' +
      '1行に1語。日本語は <b>よみ,表記,意味</b>（表記と意味は省略可。カタカナは自動で平仮名に）。' +
      '英語はそのまま書き、<b>タブの後ろ</b>に意味を書けます。# で始まる行は無視します。最大' + ST.Training.CUSTOM_MAX + '語。</div>' +
      '<textarea id="customText" class="custom-text" spellcheck="false" placeholder="こうせい,恒星,fixed star&#10;じゅうりょく,重力&#10;photosynthesis">' +
      U.esc(ST.Training.formatCustom(d.customWords)) + '</textarea>' +
      '<div class="detail-actions"><button class="btn primary" id="btnCustomSave">保存</button>' +
      '<button class="btn ghost" id="btnCustomClear">全消去</button></div>' +
      '<div id="customMsg" style="font-size:10px;margin-top:6px"></div>';
    $('trainingBody').innerHTML = h;

    bindSeg('trSource', function (v) { trainOpt.source = v; buildTraining(); });
    bindSeg('trTier', function (v) { trainOpt.tier = parseInt(v, 10); });
    bindSeg('trLang', function (v) { d.settings.lang = v; ST.Save.save(); });
    var go = $('trainingBody').querySelector('.train-go');
    if (go) go.onclick = startTraining;
    $('btnCustomSave').onclick = function () { saveCustom($('customText').value); };
    var clr = $('btnCustomClear'), armed = false;
    clr.onclick = function () {
      if (!armed) { armed = true; clr.textContent = '本当に消去する？'; ST.Audio.play('deny'); return; }
      ST.Save.d.customWords = [];
      ST.Save.save();
      buildTraining();
    };
  }
  function startTraining() {
    if (trainOpt.source === 'custom' && !(ST.Save.d.customWords || []).length) { ST.Audio.play('deny'); return; }
    ST.Audio.play('ok');
    startRun(function () { ST.Game.startPractice({ source: trainOpt.source, tier: trainOpt.tier }); });
  }

  function saveCustom(text) {
    var res = ST.Training.parseCustom(text);
    ST.Save.d.customWords = res.words;
    ST.Save.save();
    buildTraining();
    var msg = '<span style="color:#59ff9e">' + res.words.length + ' 語を登録しました。</span>';
    if (res.errors.length) {
      msg += '<br><span style="color:#ff4d5e">' + res.errors.slice(0, 5).map(U.esc).join('<br>') +
        (res.errors.length > 5 ? '<br>ほか ' + (res.errors.length - 5) + ' 件' : '') + '</span>';
    }
    $('customMsg').innerHTML = msg;
    ST.Audio.play(res.words.length ? 'ok' : 'deny');
    return res;
  }

  /* ============================================================
     打鍵分析
     ============================================================ */
  var KB_ROWS = ['1234567890-', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm,./'];
  var KB_MIN = 15;             /* これ未満の標本は色を付けない */
  function heat(rate) {
    var k = U.clamp(rate / 0.12, 0, 1);       /* ミス率12%で真っ赤 */
    var r = Math.round(30 + k * 225), g = Math.round(90 - k * 30), b = Math.round(130 - k * 60);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (0.25 + k * 0.6).toFixed(2) + ')';
  }
  function keyCell(a, ch, label, extra) {
    var v = a.keys[ch];
    var n = v ? v[0] + v[1] : 0;
    var rate = n ? v[1] / n : 0;
    var bg = n >= KB_MIN ? heat(rate) : 'rgba(10,18,36,.6)';
    return '<div class="kb-key' + (extra || '') + '" style="background:' + bg + '"><span>' + U.esc(label) + '</span>' +
      '<small>' + (n >= KB_MIN ? (rate * 100).toFixed(1) + '%' : '-') + '</small></div>';
  }
  function buildAnalysis() {
    var d = ST.Save.d;
    var a = ST.Training.analysis(d);
    var tot = [0, 0];
    for (var k in a.keys) { tot[0] += a.keys[k][0]; tot[1] += a.keys[k][1]; }
    if (!tot[1] && !tot[0]) {
      $('analysisBody').innerHTML = '<div style="color:#6f8bab;font-size:11px;padding:20px;text-align:center">' +
        'まだ記録がありません。任務か訓練を遊ぶと、ここに苦手なキーが表示されます。</div>';
      return;
    }
    var h = '<div class="kv"><span>記録した打鍵</span><b>' + U.fmt(tot[0] + tot[1]) + '</b></div>';
    h += '<div class="kv"><span>正確率</span><b>' + U.pct(tot[0], tot[0] + tot[1]) + '%</b></div>';
    h += '<div class="loot-title">キー別ミス率（打つべきだったキー）</div><div class="kb">';
    KB_ROWS.forEach(function (rowS, ri) {
      h += '<div class="kb-row" style="padding-left:' + (ri * 14) + 'px">';
      rowS.split('').forEach(function (ch) { h += keyCell(a, ch, ch.toUpperCase()); });
      h += '</div>';
    });
    h += '<div class="kb-row">' + keyCell(a, ' ', 'SPACE', ' kb-space') + '</div></div>';

    var wk = ST.Training.weakKeys(a, 6, KB_MIN);
    var wkana = ST.Training.weakKana(a, 8);
    var ww = ST.Training.weakWords(a, 8);
    var list = function (title, arr, fmt) {
      return '<div><div class="loot-title">' + title + '</div>' +
        (arr.length ? arr.map(fmt).join('') : '<div class="kv"><span>-</span></div>') + '</div>';
    };
    h += '<div class="an-cols">' +
      list('苦手なキー', wk, function (x) {
        return '<div class="kv"><span>' + U.esc(x.ch === ' ' ? 'SPACE' : x.ch.toUpperCase()) + '</span><b>' +
          (x.rate * 100).toFixed(1) + '% (' + x.miss + '/' + (x.ok + x.miss) + ')</b></div>';
      }) +
      list('ミスの多いかな', wkana, function (x) {
        return '<div class="kv"><span>' + U.esc(x.k) + '</span><b>' + x.n.toFixed(1) + '</b></div>';
      }) +
      list('ミスの多い単語', ww, function (x) {
        return '<div class="kv"><span>' + U.esc(x.w.kana || x.w.text) + '</span><b>' + x.n.toFixed(1) + '</b></div>';
      }) + '</div>';
    h += '<div style="font-size:9px;color:#3d5570;margin-top:6px">かなと単語の回数は任務ごとに少しずつ減衰します（克服すると順位が下がる）。</div>';
    h += '<div class="detail-actions"><button class="btn primary" id="btnWeakTrain">苦手克服で訓練する</button>' +
      '<button class="btn ghost" id="btnAnReset">記録を消去</button></div>';
    $('analysisBody').innerHTML = h;
    $('btnWeakTrain').onclick = function () {
      trainOpt.source = 'weak';
      ST.Audio.play('ok');
      show('scr-training', true);
    };
    var rst = $('btnAnReset'), armed = false;
    rst.onclick = function () {
      if (!armed) { armed = true; rst.textContent = '本当に消去する？'; ST.Audio.play('deny'); return; }
      d.analysis = { keys: {}, kana: {}, words: {} };
      ST.Save.save();
      buildAnalysis();
    };
  }

  /* ============================================================
     技能
     ============================================================ */
  function buildSkills() {
    var d = ST.Save.d, p = d.pilot, S = ST.Skills;
    var h = '<div class="skill-head"><span>技能ポイント <b>' + p.statPoints + '</b></span>' +
      '<span>使用済 ' + S.spent(p) + '</span>' +
      '<span style="color:#6f8bab">レベルが1上がるごとに1ポイント</span>' +
      '<button class="btn ghost" id="btnRespec">振り直し ' + U.fmt(S.respecCost(p)) + ' CR</button></div>';
    h += '<div class="skill-grid">';
    S.TREE.forEach(function (b) {
      h += '<div class="skill-col"><div class="skill-branch" style="color:' + b.color + '">' + b.ja + '  ' + b.en + '</div>';
      b.skills.forEach(function (sk) {
        var r = S.rank(p, sk.id);
        var can = S.canLearn(p, sk.id);
        var reqOk = !sk.req || S.rank(p, sk.req) >= 1;
        var cls = r >= sk.max ? ' maxed' : (can ? ' can' : (!reqOk ? ' locked' : ''));
        var pips = '';
        for (var i = 0; i < sk.max; i++) pips += i < r ? '●' : '○';
        h += '<div class="card skill' + cls + '" data-skill="' + sk.id + '">' +
          '<div class="sk-name">' + sk.n + '<span class="sk-pips" style="color:' + b.color + '">' + pips + '</span></div>' +
          '<div class="sk-desc">' + (r ? '現在: ' + S.describe(sk, r) : '1ランク: ' + S.describe(sk, 1)) +
          (r && r < sk.max ? '<br>次: ' + S.describe(sk, r + 1) : '') + '</div>' +
          (!reqOk ? '<div class="sk-req">要: ' + S.MAP[sk.req].n + '</div>' : '') +
          '</div>';
      });
      h += '</div>';
    });
    h += '</div><div id="skillMsg" style="font-size:10px;margin-top:8px;color:#6f8bab"></div>';
    $('skillsBody').innerHTML = h;
    var cards = $('skillsBody').querySelectorAll('.skill');
    for (var i = 0; i < cards.length; i++) {
      (function (c) {
        c.onclick = function () {
          if (S.learn(p, c.getAttribute('data-skill'))) { ST.Save.save(); ST.Audio.play('ok'); buildSkills(); }
          else ST.Audio.play('deny');
        };
      })(cards[i]);
    }
    var rs = $('btnRespec'), armed = false;
    rs.onclick = function () {
      if (!S.spent(p)) { ST.Audio.play('deny'); return; }
      if (!armed) { armed = true; rs.textContent = '本当に振り直す？'; ST.Audio.play('deny'); return; }
      if (S.respec(p)) { ST.Save.save(); ST.Audio.play('ok'); buildSkills(); }
      else { ST.Audio.play('deny'); $('skillMsg').textContent = '資金が足りません。'; }
    };
  }

  /* ============================================================
     実績
     ============================================================ */
  function buildAchieve() {
    var d = ST.Save.d, A = ST.Achievements;
    var h = '<div class="credits">' + A.count(d) + ' / ' + A.LIST.length + ' 解除</div>';
    A.LIST.forEach(function (a) {
      var t = d.achievements[a.id];
      h += '<div class="ach' + (t ? ' got' : '') + '"><span class="ach-mark">' + (t ? '★' : '☆') + '</span>' +
        '<div class="ach-main"><b>' + a.n + '</b><small>' + a.d + '</small></div>' +
        '<span class="ach-cr">' + (t ? new Date(t).toLocaleDateString() : '+' + U.fmt(a.cr) + ' CR') + '</span></div>';
    });
    $('achieveBody').innerHTML = h;
  }

  /* ============================================================
     ポーズ
     ============================================================ */
  function buildPause() {
    var m = $('pauseMenu');
    m.innerHTML = '';
    m.appendChild(menuItem('再 開  RESUME', function () { ST.Game.resume(); }));
    if (ST.Game.run && ST.Game.run.practice) {
      m.appendChild(menuItem('訓練を終える  FINISH', function () { ST.Game.endPractice(); }));
    }
    m.appendChild(menuItem('遊 び 方  HELP', function () { show('scr-help', true); }));
    m.appendChild(menuItem('撤 退  ABORT', function () {
      ST.Game.quit(); show('scr-title'); stack.length = 0;
    }));
  }

  /* ============================================================
     リザルト
     ============================================================ */
  var RANK_COLOR = { SS: '#ff4dd2', S: '#ffc24d', A: '#59ff9e', B: '#4da6ff', C: '#cfe6ff', D: '#9fb4c9', E: '#6f8bab' };
  function showResult(res) {
    var title = res.cleared ? 'MISSION COMPLETE' : 'MISSION FAILED';
    if (res.practice) title = res.cleared ? 'TRAINING COMPLETE' : 'TRAINING END';
    else if (res.daily) title = res.cleared ? 'DAILY COMPLETE' : 'DAILY FAILED';
    $('resultTitle').textContent = title;
    $('resultTitle').style.color = res.cleared ? '#59ff9e' : (res.practice ? '#4df3ff' : '#ff4d5e');

    var h = '<div class="rank-badge" style="color:' + (RANK_COLOR[res.rank] || '#fff') + '">' + res.rank + '</div>';
    h += '<div class="res-grid">';
    var rows = [
      ['SCORE', U.fmt(res.score)], ['正確率', res.acc + '%'],
      ['平均打鍵/秒', res.kps.toFixed(1)], ['最大コンボ', res.combo],
      ['撃破数', res.kills], ['完成単語', res.words],
      ['迎撃数', res.intercepts], ['被弾数', res.hits],
      ['到達', res.sector.endless ? 'WAVE ' + res.wave : (res.cleared ? 'CLEAR' : 'WAVE ' + res.wave)],
      ['時間', Math.floor(res.time / 60) + ':' + ('0' + Math.floor(res.time % 60)).slice(-2)]
    ];
    rows.forEach(function (r) {
      h += '<div class="kv"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    });
    h += '</div>';

    if (res.ghostDelta != null) {
      var gd = res.ghostDelta;
      h += '<div class="kv"><span>自己ベスト比</span><b style="color:' + (gd <= 0 ? '#59ff9e' : '#ff4d5e') + '">' +
        (gd <= 0 ? '-' : '+') + Math.abs(gd).toFixed(1) + 's' + (res.ghostNew ? '  更新!' : '') + '</b></div>';
    }
    if (res.parries) h += '<div class="kv"><span>パリィ</span><b>' + res.parries + '</b></div>';
    if (res.weakKeys && res.weakKeys.length) {
      h += '<div class="kv"><span>この任務の苦手キー</span><b>' + res.weakKeys.map(function (x) {
        return U.esc(x.ch === ' ' ? 'SPACE' : x.ch.toUpperCase()) + ' (' + x.miss + ')';
      }).join('  ') + '</b></div>';
    }

    if (!res.practice) {
      h += '<div class="kv"><span>獲得経験値</span><b class="up">+' + U.fmt(res.exp) + ' EXP</b></div>';
      h += '<div class="kv"><span>獲得資金</span><b class="up">+' + U.fmt(res.credits) + ' CR' +
        (res.dailyBonus ? '（初クリア +' + U.fmt(res.dailyBonus) + '）' : '') + '</b></div>';
    }

    if (res.levels.levels > 0) {
      h += '<div class="levelup">LEVEL UP!  ' + res.levels.from + ' → ' + res.levels.to +
        '  （技能ポイント +' + res.levels.levels + '）</div>';
    }

    (res.achievements || []).forEach(function (a) {
      h += '<div class="ach-new">★ 実績解除【' + a.n + '】' + a.d + '  +' + U.fmt(a.cr) + ' CR</div>';
    });

    if (res.daily) {
      var rec = ST.Save.d.daily[res.daily.key];
      if (rec) {
        h += '<div class="loot-title">記録を共有（本日のベスト）</div><div class="share-box">' +
          U.esc(shareText(res.daily.key, rec, res.daily.mod)) + '</div>' +
          '<div class="detail-actions"><button class="btn" id="btnResShare">コピー</button>' +
          '<span id="resShareMsg" style="font-size:10px;color:#6f8bab;align-self:center"></span></div>';
      }
    } else if (res.practice) {
      /* 訓練は戦利品がない */
    } else if (res.loot.length) {
      h += '<div class="loot-title">戦利品 ' + res.loot.length + '件</div>';
      res.loot.forEach(function (it) {
        var u = it.unique ? I.uniqueDef(it.unique) : null;
        h += '<div class="itemrow"><span class="ir-lv">L' + it.ilvl + '</span>' +
          '<span class="ir-name r-' + it.rarity + '">' + U.esc(it.name) + '</span>' +
          '<span class="ir-lv">' + slotShort(it.slot) + '</span>' +
          (u ? '<span class="ir-e">【' + u.n + '】</span>' : '') + '</div>';
      });
    } else {
      h += '<div class="loot-title">戦利品なし</div>';
    }
    if (res.overflow > 0) {
      h += '<div style="font-size:11px;color:#ffc24d;margin-top:8px">所持上限を超えたため、価値の低い装備 ' +
        res.overflow + ' 個を自動売却しました (+' + U.fmt(res.overflowCr) + ' CR)</div>';
    }
    $('resultBody').innerHTML = h;
    var rsb = $('btnResShare');
    if (rsb && res.daily) rsb.onclick = function () {
      copyText(shareText(res.daily.key, ST.Save.d.daily[res.daily.key], res.daily.mod), $('resShareMsg'));
    };
    $('btnResultOk').onclick = function () {
      ST.Audio.play('ok');
      ST.Game.quit();
      show('scr-title');
      stack.length = 0;
    };
    show('scr-result');
  }

  /* ============================================================
     init
     ============================================================ */
  function init() {
    /* 戻るボタン */
    var backs = document.querySelectorAll('[data-back]');
    for (var i = 0; i < backs.length; i++) backs[i].onclick = back;

    window.addEventListener('keydown', onKey);
    show('scr-title');
  }

  return {
    init: init, show: show, showResult: showResult, back: back,
    buildTitle: buildTitle, buildPause: buildPause
  };
})();
