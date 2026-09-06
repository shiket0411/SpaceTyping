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
    'scr-pause': buildPause
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
    m.appendChild(menuItem('格 納 庫  HANGAR', function () { show('scr-hangar', true); }));
    m.appendChild(menuItem('遊 び 方  HOW TO PLAY', function () { show('scr-help', true); }));
    m.appendChild(menuItem('設 定  SETTINGS', function () { show('scr-settings', true); }));

    var d = ST.Save.d;
    var need = ST.Growth.expToNext(d.pilot.level);
    $('pilotStrip').innerHTML =
      'LV <b>' + d.pilot.level + '</b>' +
      '<span>EXP <b>' + U.fmt(d.pilot.exp) + '</b> / ' + U.fmt(need) + '</span>' +
      '<span>CR <b>' + U.fmt(d.pilot.credits) + '</b></span>' +
      '<span>BEST WPM <b>' + d.stats.bestWpm + '</b></span>' +
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
      ['経験値 / 入手率', '+' + st.expGain.toFixed(0) + '% / +' + st.dropRate.toFixed(0) + '%']
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
  }

  function renderInventory() {
    var d = ST.Save.d;
    var box = $('invList');
    box.innerHTML = '';
    $('invCount').textContent = d.inventory.length + ' / 120';
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

    html += '<div class="detail-actions">';
    if (selectedItem.equipped) {
      html += '<button class="btn" id="btnUnequip">外す</button>';
    } else if (it.slot === 'module') {
      /* 拡張は2スロットあるので、どちらへ装備するかを明示的に選ばせる */
      html += '<button class="btn' + (targetSlotFor(it) === 'module1' ? ' primary' : '') +
        '" id="btnEquip1">拡張1へ</button>' +
        '<button class="btn' + (targetSlotFor(it) === 'module2' ? ' primary' : '') +
        '" id="btnEquip2">拡張2へ</button>' +
        '<button class="btn" id="btnSell">売却 ' + U.fmt(I.sellPrice(it)) + ' CR</button>';
    } else {
      html += '<button class="btn primary" id="btnEquip">装備する</button>' +
        '<button class="btn" id="btnSell">売却 ' + U.fmt(I.sellPrice(it)) + ' CR</button>';
    }
    html += '</div>';
    box.innerHTML = html;

    var be = $('btnEquip'), bs = $('btnSell'), bu = $('btnUnequip');
    var b1 = $('btnEquip1'), b2 = $('btnEquip2');
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
  function sellItem(it) {
    var d = ST.Save.d;
    var idx = d.inventory.indexOf(it);
    if (idx < 0) return;
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
    html += '<div class="setrow"><div class="s-lab"><b>一括売却</b><small>COMMON / UNCOMMON をまとめて売却します</small></div>' +
      '<button class="btn" id="btnSellJunk">売却する</button></div>';
    html += '<div id="shopResult" style="margin-top:14px"></div>';
    $('shopBody').innerHTML = html;

    var cards = $('shopBody').querySelectorAll('.shop-card');
    for (var i = 0; i < cards.length; i++) {
      (function (idx) {
        cards[idx].onclick = function () { buy(packs[idx]); };
      })(i);
    }
    $('btnSellJunk').onclick = sellJunk;
  }

  function buy(p) {
    var d = ST.Save.d;
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
  function sellJunk() {
    var d = ST.Save.d;
    var total = 0, n = 0;
    d.inventory = d.inventory.filter(function (it) {
      if (it.rarity === 'common' || it.rarity === 'uncommon') {
        total += I.sellPrice(it); n++; return false;
      }
      return true;
    });
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
      '<p>正確な打鍵と撃破でODゲージが溜まります。満タンで <span class="kbig">ENTER</span>。敵弾が減速し、ダメージ2倍、',
      '自機周辺の弾を<em>エネルギーを消費せず</em>薙ぎ払います。</p>',
      '<h4>成長と装備</h4>',
      '<p>撃破で経験値と装備を入手。<em>迎撃容量・充填速度・迎撃燃費・迎撃爆風</em>を伸ばすほど攻撃モードに留まれる時間が延び、',
      '<em>砲撃力・完撃倍率</em>を伸ばすほど1単語あたりの火力が上がります。EPIC以上には特殊効果が宿ります。</p>',
      '<h4>操作一覧</h4>',
      '<p><span class="kbig">A-Z</span> と <span class="kbig">SPACE</span> タイピング &nbsp; ',
      '<span class="kbig">TAB</span> 攻撃/迎撃 切替 &nbsp; <span class="kbig">SHIFT+TAB</span> 目標を次へ &nbsp; ',
      '<span class="kbig">ENTER</span> オーバードライブ &nbsp; <span class="kbig">ESC</span> ポーズ</p>',
      '<h4>難易度</h4>',
      '<p>NOVICE から SINGULARITY まで7段階。上位ほど弾速・弾数が上がり迎撃の消費が激しくなります。',
      'VETERAN 以上は<em>ミスで迎撃エネルギーも減少</em>します。その分、経験値と入手率が大きく伸びます。</p>'
    ].join('');
  }

  /* ============================================================
     ポーズ
     ============================================================ */
  function buildPause() {
    var m = $('pauseMenu');
    m.innerHTML = '';
    m.appendChild(menuItem('再 開  RESUME', function () { ST.Game.resume(); }));
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
    $('resultTitle').textContent = res.cleared ? 'MISSION COMPLETE' : 'MISSION FAILED';
    $('resultTitle').style.color = res.cleared ? '#59ff9e' : '#ff4d5e';

    var h = '<div class="rank-badge" style="color:' + (RANK_COLOR[res.rank] || '#fff') + '">' + res.rank + '</div>';
    h += '<div class="res-grid">';
    var rows = [
      ['SCORE', U.fmt(res.score)], ['正確率', res.acc + '%'],
      ['WPM', res.wpm], ['最大コンボ', res.combo],
      ['撃破数', res.kills], ['完成単語', res.words],
      ['迎撃数', res.intercepts], ['被弾数', res.hits],
      ['到達', res.sector.endless ? 'WAVE ' + res.wave : (res.cleared ? 'CLEAR' : 'WAVE ' + res.wave)],
      ['時間', Math.floor(res.time / 60) + ':' + ('0' + Math.floor(res.time % 60)).slice(-2)]
    ];
    rows.forEach(function (r) {
      h += '<div class="kv"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    });
    h += '</div>';

    h += '<div class="kv"><span>獲得経験値</span><b class="up">+' + U.fmt(res.exp) + ' EXP</b></div>';
    h += '<div class="kv"><span>獲得資金</span><b class="up">+' + U.fmt(res.credits) + ' CR</b></div>';

    if (res.levels.levels > 0) {
      h += '<div class="levelup">LEVEL UP!  ' + res.levels.from + ' → ' + res.levels.to + '</div>';
    }

    if (res.loot.length) {
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
    $('resultBody').innerHTML = h;
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
