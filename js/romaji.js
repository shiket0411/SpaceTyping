/* ============================================================
   SPACE TYPING - romaji.js
   かな -> ローマ字 の NFA マッチャ
   「しゃ = sha / sya / shixya」「っ = 子音重ね / xtu」
   「ん = n / nn / xn」など複数入力を全て受理する。
   ============================================================ */
ST.Romaji = (function () {

  /* ---- 拗音・特殊音（2文字以上、長い順に判定） ---- */
  var DIGRAPH = {
    'きゃ': ['kya'], 'きぃ': ['kyi'], 'きゅ': ['kyu'], 'きぇ': ['kye'], 'きょ': ['kyo'],
    'ぎゃ': ['gya'], 'ぎぃ': ['gyi'], 'ぎゅ': ['gyu'], 'ぎぇ': ['gye'], 'ぎょ': ['gyo'],
    'しゃ': ['sha', 'sya'], 'しぃ': ['syi'], 'しゅ': ['shu', 'syu'], 'しぇ': ['she', 'sye'], 'しょ': ['sho', 'syo'],
    'じゃ': ['ja', 'jya', 'zya'], 'じぃ': ['jyi', 'zyi'], 'じゅ': ['ju', 'jyu', 'zyu'],
    'じぇ': ['je', 'jye', 'zye'], 'じょ': ['jo', 'jyo', 'zyo'],
    'ちゃ': ['cha', 'tya', 'cya'], 'ちぃ': ['tyi'], 'ちゅ': ['chu', 'tyu', 'cyu'],
    'ちぇ': ['che', 'tye', 'cye'], 'ちょ': ['cho', 'tyo', 'cyo'],
    'ぢゃ': ['dya'], 'ぢゅ': ['dyu'], 'ぢょ': ['dyo'],
    'にゃ': ['nya'], 'にぃ': ['nyi'], 'にゅ': ['nyu'], 'にぇ': ['nye'], 'にょ': ['nyo'],
    'ひゃ': ['hya'], 'ひぃ': ['hyi'], 'ひゅ': ['hyu'], 'ひぇ': ['hye'], 'ひょ': ['hyo'],
    'びゃ': ['bya'], 'びゅ': ['byu'], 'びょ': ['byo'],
    'ぴゃ': ['pya'], 'ぴゅ': ['pyu'], 'ぴょ': ['pyo'],
    'みゃ': ['mya'], 'みゅ': ['myu'], 'みょ': ['myo'],
    'りゃ': ['rya'], 'りぃ': ['ryi'], 'りゅ': ['ryu'], 'りぇ': ['rye'], 'りょ': ['ryo'],
    'ふぁ': ['fa', 'hwa'], 'ふぃ': ['fi', 'hwi'], 'ふぇ': ['fe', 'hwe'], 'ふぉ': ['fo', 'hwo'],
    'ふゅ': ['fyu'], 'ふょ': ['fyo'],
    'てぃ': ['thi'], 'てゅ': ['thu'], 'でぃ': ['dhi'], 'でゅ': ['dhu'],
    'とぅ': ['twu'], 'どぅ': ['dwu'],
    'うぃ': ['wi', 'whi'], 'うぇ': ['we', 'whe'], 'うぉ': ['who'],
    'つぁ': ['tsa'], 'つぃ': ['tsi'], 'つぇ': ['tse'], 'つぉ': ['tso'],
    'ゔぁ': ['va'], 'ゔぃ': ['vi'], 'ゔぇ': ['ve'], 'ゔぉ': ['vo'], 'ゔゅ': ['vyu'],
    'くぁ': ['qa', 'kwa'], 'くぃ': ['qi'], 'くぇ': ['qe'], 'くぉ': ['qo'],
    'ぐぁ': ['gwa'], 'すぃ': ['swi'], 'ずぃ': ['zwi']
  };

  /* ---- 単独かな ---- */
  var MONO = {
    'あ': ['a'], 'い': ['i', 'yi'], 'う': ['u', 'wu', 'whu'], 'え': ['e'], 'お': ['o'],
    'か': ['ka', 'ca'], 'き': ['ki'], 'く': ['ku', 'cu', 'qu'], 'け': ['ke'], 'こ': ['ko', 'co'],
    'が': ['ga'], 'ぎ': ['gi'], 'ぐ': ['gu'], 'げ': ['ge'], 'ご': ['go'],
    'さ': ['sa'], 'し': ['shi', 'si', 'ci'], 'す': ['su'], 'せ': ['se', 'ce'], 'そ': ['so'],
    'ざ': ['za'], 'じ': ['ji', 'zi'], 'ず': ['zu'], 'ぜ': ['ze'], 'ぞ': ['zo'],
    'た': ['ta'], 'ち': ['chi', 'ti'], 'つ': ['tsu', 'tu'], 'て': ['te'], 'と': ['to'],
    'だ': ['da'], 'ぢ': ['di'], 'づ': ['du'], 'で': ['de'], 'ど': ['do'],
    'な': ['na'], 'に': ['ni'], 'ぬ': ['nu'], 'ね': ['ne'], 'の': ['no'],
    'は': ['ha'], 'ひ': ['hi'], 'ふ': ['fu', 'hu'], 'へ': ['he'], 'ほ': ['ho'],
    'ば': ['ba'], 'び': ['bi'], 'ぶ': ['bu'], 'べ': ['be'], 'ぼ': ['bo'],
    'ぱ': ['pa'], 'ぴ': ['pi'], 'ぷ': ['pu'], 'ぺ': ['pe'], 'ぽ': ['po'],
    'ま': ['ma'], 'み': ['mi'], 'む': ['mu'], 'め': ['me'], 'も': ['mo'],
    'や': ['ya'], 'ゆ': ['yu'], 'よ': ['yo'],
    'ら': ['ra'], 'り': ['ri'], 'る': ['ru'], 'れ': ['re'], 'ろ': ['ro'],
    'わ': ['wa'], 'ゐ': ['wi'], 'ゑ': ['we'], 'を': ['wo'], 'ゔ': ['vu'],
    'ぁ': ['xa', 'la'], 'ぃ': ['xi', 'li'], 'ぅ': ['xu', 'lu'], 'ぇ': ['xe', 'le'], 'ぉ': ['xo', 'lo'],
    'ゃ': ['xya', 'lya'], 'ゅ': ['xyu', 'lyu'], 'ょ': ['xyo', 'lyo'], 'ゎ': ['xwa', 'lwa'],
    'ー': ['-'], '、': [','], '。': ['.'], '・': ['/'], '　': [' '], ' ': [' ']
  };

  var VOWELS = 'aiueo';

  /* カタカナ -> ひらがな */
  function toHira(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      out += (c >= 0x30A1 && c <= 0x30F6) ? String.fromCharCode(c - 0x60) : s[i];
    }
    return out;
  }

  /* 拗音を「親かな + 小文字かな」に分解した打ち方も許可する。
     例: しゅ = shu / syu / shixyu / silyu ... (IME と同じ挙動) */
  var _digraphCache = {};
  function expandDigraph(key) {
    if (_digraphCache[key]) return _digraphCache[key];
    var cands = DIGRAPH[key].slice();
    var a = MONO[key[0]], b = MONO[key[1]];
    if (a && b) {
      for (var i = 0; i < a.length; i++) {
        for (var j = 0; j < b.length; j++) {
          var s = a[i] + b[j];
          if (cands.indexOf(s) < 0) cands.push(s);
        }
      }
    }
    _digraphCache[key] = cands;
    return cands;
  }

  /* かな文字列 -> セグメント配列 */
  function segment(kanaRaw) {
    var kana = toHira(kanaRaw);
    var segs = [];
    var i = 0;
    while (i < kana.length) {
      var two = kana.substr(i, 2);
      if (DIGRAPH[two]) { segs.push({ k: two, cands: expandDigraph(two) }); i += 2; continue; }
      var one = kana[i];
      if (one === 'っ' || one === 'ッ') { segs.push({ k: 'っ', sokuon: true, cands: null }); i += 1; continue; }
      if (one === 'ん' || one === 'ン') { segs.push({ k: 'ん', hatsuon: true, cands: null }); i += 1; continue; }
      if (MONO[one]) { segs.push({ k: one, cands: MONO[one].slice() }); i += 1; continue; }
      /* テーブル外（英数字など）はそのまま1打鍵 */
      segs.push({ k: one, cands: [one.toLowerCase()] });
      i += 1;
    }

    /* 促音・撥音の候補を後ろから解決 */
    for (var s = segs.length - 1; s >= 0; s--) {
      var seg = segs[s];
      var nxt = segs[s + 1];
      if (seg.sokuon) {
        var set = {};
        if (nxt && nxt.cands) {
          for (var c = 0; c < nxt.cands.length; c++) {
            var ch = nxt.cands[c][0];
            if (VOWELS.indexOf(ch) < 0 && ch !== 'n') set[ch] = 1;
          }
        }
        var list = Object.keys(set);
        seg.cands = list.concat(['xtu', 'ltu', 'xtsu', 'ltsu']);
        if (!list.length) seg.cands = ['xtu', 'ltu', 'xtsu', 'ltsu'];
      } else if (seg.hatsuon) {
        var cands = ['nn', 'xn'];
        var allowSingle = true;
        if (nxt && nxt.cands) {
          for (var d = 0; d < nxt.cands.length; d++) {
            var f = nxt.cands[d][0];
            if (VOWELS.indexOf(f) >= 0 || f === 'n' || f === 'y') { allowSingle = false; break; }
          }
        }
        if (allowSingle) cands.unshift('n');
        seg.cands = cands;
      }
      /* 表示用の既定ローマ字 = 最短候補 */
      seg.def = seg.cands.reduce(function (a, b) { return b.length < a.length ? b : a; });
    }
    return segs;
  }

  function defaultRomaji(kana) {
    return segment(kana).map(function (s) { return s.def; }).join('');
  }

  /* ---------------- Matcher (NFA) ---------------- */
  function KanaMatcher(word) {
    this.word = word;
    this.display = word.kana || word.text;
    this.sub = word.text && word.kana ? word.text + (word.en ? '  /  ' + word.en : '') : (word.en || '');
    this.segs = segment(word.kana);
    this.total = this.segs.reduce(function (a, s) { return a + s.def.length; }, 0);
    this.count = 0;
    this.typed = '';
    this.done = false;
    this.states = [];
    this._spawn(this.states, 0);
    this.endsWithN = this.segs.length > 0 && this.segs[this.segs.length - 1].hatsuon;
  }
  KanaMatcher.prototype._spawn = function (arr, segIdx) {
    if (segIdx >= this.segs.length) return true; /* 完了 */
    var cands = this.segs[segIdx].cands;
    for (var i = 0; i < cands.length; i++) arr.push({ s: segIdx, c: i, p: 0 });
    return false;
  };
  KanaMatcher.prototype.feed = function (ch) {
    if (this.done) return 'done';
    var next = [], complete = false, singleN = false;
    for (var i = 0; i < this.states.length; i++) {
      var st = this.states[i];
      var cand = this.segs[st.s].cands[st.c];
      if (cand.charAt(st.p) !== ch) continue;
      var np = st.p + 1;
      if (np >= cand.length) {
        if (this._spawn(next, st.s + 1)) {
          complete = true;
          /* 語尾「ん」を "n" 1打で確定した場合、直後の余分な "n" を許容する */
          if (this.segs[st.s].hatsuon && cand.length === 1) singleN = true;
        }
      } else {
        next.push({ s: st.s, c: st.c, p: np });
      }
    }
    if (!next.length && !complete) return 'miss';
    this.typed += ch;
    this.count++;
    this.states = next;
    if (complete) { this.done = true; this.swallowN = singleN; return 'done'; }
    return 'ok';
  };
  KanaMatcher.prototype.firstChars = function () {
    var set = {};
    for (var i = 0; i < this.states.length; i++) {
      var st = this.states[i];
      var c = this.segs[st.s].cands[st.c].charAt(st.p);
      if (c) set[c] = 1;
    }
    return Object.keys(set);
  };
  KanaMatcher.prototype._best = function () {
    var best = null;
    for (var i = 0; i < this.states.length; i++) {
      var st = this.states[i];
      var cand = this.segs[st.s].cands[st.c];
      if (!best) { best = st; continue; }
      var bc = this.segs[best.s].cands[best.c];
      if (st.s > best.s) best = st;
      else if (st.s === best.s && (st.p > best.p || (st.p === best.p && cand.length < bc.length))) best = st;
    }
    return best;
  };
  /* 表示用: [済み, 次の1文字, 残り] */
  KanaMatcher.prototype.parts = function () {
    if (this.done) return [this.typed, '', ''];
    var b = this._best();
    if (!b) return [this.typed, '', ''];
    var cand = this.segs[b.s].cands[b.c];
    var rest = cand.slice(b.p);
    for (var i = b.s + 1; i < this.segs.length; i++) rest += this.segs[i].def;
    return [this.typed, rest.charAt(0), rest.slice(1)];
  };
  KanaMatcher.prototype.progress = function () {
    var b = this._best();
    if (this.done) return 1;
    if (!b) return 0;
    var acc = 0;
    for (var i = 0; i < b.s; i++) acc += this.segs[i].def.length;
    acc += b.p;
    return ST.U.clamp(acc / Math.max(1, this.total), 0, 1);
  };
  /* かな表示の分割: [打ち終えたかな, 残りのかな] */
  KanaMatcher.prototype.kanaParts = function () {
    var b = this._best();
    var idx = b ? b.s : this.segs.length;
    if (this.done) idx = this.segs.length;
    var a = '', r = '';
    for (var i = 0; i < this.segs.length; i++) {
      if (i < idx) a += this.segs[i].k; else r += this.segs[i].k;
    }
    return [a, r];
  };

  /* ---------------- 英単語マッチャ ---------------- */
  function AsciiMatcher(word) {
    this.word = word;
    this.src = (word.text || '').toLowerCase();
    this.display = word.text;
    this.sub = word.ja || word.en || '';
    this.total = this.src.length;
    this.count = 0;
    this.typed = '';
    this.done = this.total === 0;
    this.endsWithN = false;
  }
  AsciiMatcher.prototype.feed = function (ch) {
    if (this.done) return 'done';
    if (this.src.charAt(this.count) !== ch) return 'miss';
    this.count++; this.typed += ch;
    if (this.count >= this.total) { this.done = true; return 'done'; }
    return 'ok';
  };
  AsciiMatcher.prototype.firstChars = function () {
    return this.done ? [] : [this.src.charAt(this.count)];
  };
  AsciiMatcher.prototype.parts = function () {
    return [this.src.slice(0, this.count), this.src.charAt(this.count), this.src.slice(this.count + 1)];
  };
  AsciiMatcher.prototype.progress = function () { return this.count / Math.max(1, this.total); };
  AsciiMatcher.prototype.kanaParts = function () {
    return [this.display.slice(0, this.count), this.display.slice(this.count)];
  };

  function create(word) {
    if (word && word.kana) return new KanaMatcher(word);
    return new AsciiMatcher(word);
  }

  return {
    segment: segment, defaultRomaji: defaultRomaji, create: create,
    toHira: toHira, KanaMatcher: KanaMatcher, AsciiMatcher: AsciiMatcher
  };
})();
