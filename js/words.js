/* ============================================================
   SPACE TYPING - words.js
   単語バンク。打鍵数(既定ローマ字長)で自動的に tier 1..5 へ振り分ける。
   ============================================================ */
ST.Words = (function () {

  /* [かな, 表記, 英訳] */
  var JA = [
    ['ほし', '星', 'star'], ['つき', '月', 'moon'], ['そら', '空', 'sky'],
    ['ひかり', '光', 'light'], ['やみ', '闇', 'dark'], ['かぜ', '風', 'wind'],
    ['ほのお', '炎', 'flame'], ['こおり', '氷', 'ice'], ['たね', '種', 'seed'],
    ['きり', '霧', 'mist'], ['なみ', '波', 'wave'], ['いわ', '岩', 'rock'],
    ['かべ', '壁', 'wall'], ['はね', '羽', 'wing'], ['ゆめ', '夢', 'dream'],
    ['きぼう', '希望', 'hope'], ['ぜつぼう', '絶望', 'despair'], ['うちゅう', '宇宙', 'space'],
    ['わくせい', '惑星', 'planet'], ['えいせい', '衛星', 'satellite'], ['こうせい', '恒星', 'fixed star'],
    ['ぎんが', '銀河', 'galaxy'], ['りゅうせい', '流星', 'meteor'], ['すいせい', '彗星', 'comet'],
    ['たいよう', '太陽', 'sun'], ['ちきゅう', '地球', 'earth'], ['かせい', '火星', 'mars'],
    ['もくせい', '木星', 'jupiter'], ['どせい', '土星', 'saturn'], ['きんせい', '金星', 'venus'],
    ['めいおう', '冥王', 'pluto'], ['じくう', '時空', 'spacetime'], ['じげん', '次元', 'dimension'],
    ['くうかん', '空間', 'space'], ['しんくう', '真空', 'vacuum'], ['じゅうりょく', '重力', 'gravity'],
    ['じりょく', '磁力', 'magnetism'], ['でんりゅう', '電流', 'current'], ['こうそく', '光速', 'lightspeed'],
    ['おんそく', '音速', 'mach'], ['かそく', '加速', 'accelerate'], ['げんそく', '減速', 'decelerate'],
    ['きどう', '軌道', 'orbit'], ['こうろ', '航路', 'route'], ['ざひょう', '座標', 'coordinate'],
    ['ほうこう', '方向', 'direction'], ['きょり', '距離', 'distance'], ['そくど', '速度', 'velocity'],
    ['しつりょう', '質量', 'mass'], ['えねるぎー', 'エネルギー', 'energy'], ['ねつりょう', '熱量', 'calorie'],
    ['はんのう', '反応', 'reaction'], ['ばくはつ', '爆発', 'explosion'], ['ゆうごう', '融合', 'fusion'],
    ['ぶんれつ', '分裂', 'fission'], ['ほうしゃ', '放射', 'radiation'], ['りょうし', '量子', 'quantum'],
    ['げんし', '原子', 'atom'], ['ぶんし', '分子', 'molecule'], ['そりゅうし', '素粒子', 'particle'],
    ['はどう', '波動', 'wave motion'], ['しゅうは', '周波', 'frequency'], ['きょうめい', '共鳴', 'resonance'],
    ['かんしょう', '干渉', 'interference'], ['くっせつ', '屈折', 'refraction'], ['はんしゃ', '反射', 'reflection'],
    ['せんかん', '戦艦', 'battleship'], ['きょかん', '巨艦', 'huge ship'], ['じゅんよう', '巡洋', 'cruiser'],
    ['くちくかん', '駆逐艦', 'destroyer'], ['きかん', '機関', 'engine'], ['すいしん', '推進', 'propulsion'],
    ['ふんしゃ', '噴射', 'thrust'], ['そうこう', '装甲', 'armor'], ['ぼうぎょ', '防御', 'defense'],
    ['こうげき', '攻撃', 'attack'], ['げいげき', '迎撃', 'intercept'], ['ほうげき', '砲撃', 'bombard'],
    ['そげき', '狙撃', 'snipe'], ['めいちゅう', '命中', 'hit'], ['かいひ', '回避', 'evade'],
    ['とっぱ', '突破', 'breakthrough'], ['しゅつげき', '出撃', 'sortie'], ['きかん', '帰還', 'return'],
    ['ぶそう', '武装', 'armament'], ['そうび', '装備', 'equipment'], ['ぶひん', '部品', 'parts'],
    ['きたい', '機体', 'airframe'], ['そうじゅう', '操縦', 'piloting'], ['けいそく', '計測', 'measure'],
    ['たんさ', '探査', 'probe'], ['かんそく', '観測', 'observation'], ['つうしん', '通信', 'comms'],
    ['じょうほう', '情報', 'information'], ['かいせき', '解析', 'analysis'], ['えんざん', '演算', 'computation'],
    ['きおく', '記憶', 'memory'], ['ろんり', '論理', 'logic'], ['かいろ', '回路', 'circuit'],
    ['そうち', '装置', 'device'], ['きかい', '機械', 'machine'], ['じんこう', '人工', 'artificial'],
    ['ちのう', '知能', 'intelligence'], ['しれい', '指令', 'command'], ['にんむ', '任務', 'mission'],
    ['さくせん', '作戦', 'operation'], ['せんりゃく', '戦略', 'strategy'], ['せんじゅつ', '戦術', 'tactics'],
    ['はんげき', '反撃', 'counter'], ['てったい', '撤退', 'retreat'], ['しんぐん', '進軍', 'advance'],
    ['ほうかい', '崩壊', 'collapse'], ['さいせい', '再生', 'regenerate'], ['しゅうふく', '修復', 'repair'],
    ['きょうか', '強化', 'enhance'], ['かいぞう', '改造', 'remodel'], ['しんか', '進化', 'evolution'],
    ['へんい', '変異', 'mutation'], ['ふくせい', '複製', 'replicate'], ['ぞうしょく', '増殖', 'proliferate'],
    ['きせい', '寄生', 'parasite'], ['しんしょく', '侵食', 'erosion'], ['おせん', '汚染', 'contamination'],
    ['ぼうそう', '暴走', 'runaway'], ['ぼうがい', '妨害', 'jamming'], ['きょうしゅう', '強襲', 'assault'],
    ['ようさい', '要塞', 'fortress'], ['きち', '基地', 'base'], ['こうこく', '航国', 'colony'],
    ['しょくみん', '植民', 'colonize'], ['ぶんめい', '文明', 'civilization'], ['ていこく', '帝国', 'empire'],
    ['はんらん', '反乱', 'rebellion'], ['どうめい', '同盟', 'alliance'], ['じょうやく', '条約', 'treaty'],
    ['ゆうしゅう', '優秀', 'excellent'], ['えいえん', '永遠', 'eternity'], ['きせき', '奇跡', 'miracle'],
    ['うんめい', '運命', 'destiny'], ['けっしょう', '決勝', 'final'], ['しょうり', '勝利', 'victory'],
    ['はいぼく', '敗北', 'defeat'], ['きょうふ', '恐怖', 'fear'], ['ゆうき', '勇気', 'courage'],
    ['けっしん', '決心', 'resolve'], ['そうぜつ', '壮絶', 'fierce'], ['しゅんかん', '瞬間', 'instant'],
    ['えいきゅう', '永久', 'permanent'], ['むげん', '無限', 'infinity'], ['きょくげん', '極限', 'limit'],
    ['ぜっけい', '絶景', 'vista'], ['しんぴ', '神秘', 'mystery'], ['きょだい', '巨大', 'gigantic'],
    ['あんこく', '暗黒', 'darkness'], ['こうりん', '降臨', 'advent'], ['きょうい', '驚異', 'wonder'],
    ['ちょうおんぱ', '超音波', 'ultrasound'], ['ぷらずま', 'プラズマ', 'plasma'],
    ['ろけっと', 'ロケット', 'rocket'], ['えんじん', 'エンジン', 'engine'],
    ['れーざー', 'レーザー', 'laser'], ['みさいる', 'ミサイル', 'missile'],
    ['ばりあ', 'バリア', 'barrier'], ['しーるど', 'シールド', 'shield'],
    ['りあくたー', 'リアクター', 'reactor'], ['せんさー', 'センサー', 'sensor'],
    ['なびげーしょん', 'ナビゲーション', 'navigation'], ['ぶらっくほーる', 'ブラックホール', 'black hole'],
    ['わーぷこうかい', 'ワープ航海', 'warp voyage'], ['あんどろめだ', 'アンドロメダ', 'andromeda'],
    ['じんこうちのう', '人工知能', 'artificial intelligence'],
    ['りょうしりきがく', '量子力学', 'quantum mechanics'],
    ['そうたいせいりろん', '相対性理論', 'relativity'],
    ['じゅうりょくは', '重力波', 'gravitational wave'],
    ['たいようけいがい', '太陽系外', 'extrasolar'],
    ['ちょうしんせい', '超新星', 'supernova'],
    ['じくうだんそう', '時空断層', 'spacetime fault'],
    ['さいしゅうへいき', '最終兵器', 'final weapon'],
    ['ぜんめつさくせん', '殲滅作戦', 'annihilation op'],
    ['きょうせいちゃくりく', '強制着陸', 'forced landing'],
    ['じりつせんとうきたい', '自律戦闘機体', 'autonomous fighter'],
    ['むげんえねるぎーろ', '無限エネルギー炉', 'infinite reactor'],
    ['あんこくぶっしつ', '暗黒物質', 'dark matter'],
    ['はんぶっしつばくだん', '反物質爆弾', 'antimatter bomb'],
    ['ちょうこうそくこうかい', '超光速航海', 'ftl voyage'],

    /* --- 中位 (tier 2) --- */
    ['しんりゃく', '侵略', 'invasion'], ['ばくげきき', '爆撃機', 'bomber'],
    ['れーざーほう', 'レーザー砲', 'laser cannon'], ['ちょうでんどう', '超伝導', 'superconductor'],
    ['こうねんきょり', '光年距離', 'light-year'], ['はんぶっしつ', '反物質', 'antimatter'],
    ['じゅうりょくけん', '重力圏', 'gravity sphere'], ['でんじほうしゃ', '電磁放射', 'em radiation'],
    ['きどうけいさん', '軌道計算', 'orbit calc'], ['じんこうえいせい', '人工衛星', 'satellite'],
    ['かくゆうごう', '核融合', 'nuclear fusion'], ['そうこうへき', '装甲壁', 'armor wall'],
    ['きょうめいろ', '共鳴炉', 'resonance core'], ['しゅうそくほう', '収束砲', 'focus cannon'],
    ['たいきけん', '大気圏', 'atmosphere'], ['むじゅうりょく', '無重力', 'zero gravity'],
    ['こうがくへいき', '光学兵器', 'optical weapon'], ['りったいそうさ', '立体走査', '3d scan'],
    ['じそくほうかい', '磁束崩壊', 'flux collapse'], ['あんごうかいどく', '暗号解読', 'decryption'],
    ['えいきゅうきかん', '永久機関', 'perpetual engine'], ['ついしょうめつ', '対消滅', 'annihilation'],
    ['しんくうほうでん', '真空放電', 'vacuum discharge'], ['こうしんりょく', '向心力', 'centripetal'],
    ['ねつぼうそう', '熱暴走', 'thermal runaway'], ['じばんちんか', '地盤沈下', 'subsidence'],
    ['きあつはいち', '気圧配置', 'pressure map'], ['そうさはんい', '走査範囲', 'scan range'],

    /* --- 上位 (tier 3) --- */
    ['たんさろぼっと', '探査ロボット', 'probe robot'], ['せんとうたいせい', '戦闘態勢', 'battle stance'],
    ['ようさいほうかい', '要塞崩壊', 'fortress collapse'], ['きょくちょうおんぱ', '極超音波', 'hypersonic'],
    ['ちょうこうそくだん', '超光速弾', 'ftl round'], ['あんこくせいうん', '暗黒星雲', 'dark nebula'],
    ['はかいへいきぐん', '破壊兵器群', 'weapon array'], ['りょうしつうしん', '量子通信', 'quantum comms'],
    ['じりつせんとうき', '自律戦闘機', 'autonomous fighter'], ['こうどぼうえいせん', '高度防衛線', 'defense line'],
    ['せいうんかんそく', '星雲観測', 'nebula survey'], ['きょうめいはどう', '共鳴波動', 'resonance wave'],
    ['ぎんがていこく', '銀河帝国', 'galactic empire'], ['ぶんめいほうかい', '文明崩壊', 'collapse of civilization'],
    ['じくうてんいそうち', '時空転移装置', 'warp device'], ['こうそくえんしんりょく', '高速遠心力', 'centrifugal'],
    ['たいねつしょうへき', '耐熱障壁', 'heat barrier'], ['きどうしゅうせい', '軌道修正', 'course correction'],
    ['ぜんほういそうさ', '全方位走査', 'omni scan'], ['じゅうりょくいど', '重力井戸', 'gravity well'],

    /* --- 最上位 (tier 4) --- */
    ['ちょうしんせいばくはつ', '超新星爆発', 'supernova'],
    ['じゅうりょくせいぎょ', '重力制御', 'gravity control'],
    ['はんぶっしつえんじん', '反物質エンジン', 'antimatter engine'],
    ['ぎんがちゅうしんかく', '銀河中心核', 'galactic center'],
    ['じくうこうぞうかいせき', '時空構造解析', 'spacetime analysis'],
    ['ぜんぎんがつうしんもう', '全銀河通信網', 'galactic network'],
    ['さいしゅうぼうえいせん', '最終防衛線', 'last defense line'],
    ['りょうしもつれつうしん', '量子もつれ通信', 'entanglement comms'],
    ['ちょうじげんこうかい', '超次元航海', 'hyperdimensional voyage'],
    ['せいめいたんさそうち', '生命探査装置', 'life scanner'],
    ['ばんぶつそうせいろん', '万物創世論', 'theory of everything'],
    ['じゅうりょくとくいてん', '重力特異点', 'gravitational singularity'],
    ['こうじげんきかがく', '高次元幾何学', 'hyperdim geometry'],
    ['そうたいろんてきこうか', '相対論的効果', 'relativistic effect'],
    ['ちょうだいしつりょうたい', '超大質量体', 'supermassive body']
  ];

  var EN = [
    'ion', 'arc', 'orb', 'ray', 'jet', 'hex', 'nova', 'void', 'flux', 'core',
    'warp', 'beam', 'hull', 'helm', 'drift', 'pulse', 'quark', 'comet', 'orbit',
    'laser', 'plasma', 'photon', 'proton', 'vector', 'thrust', 'shield', 'engine',
    'nebula', 'quasar', 'cosmos', 'meteor', 'lunar', 'solar', 'astro', 'crater',
    'reactor', 'gravity', 'stellar', 'orbital', 'quantum', 'plasmic', 'cluster',
    'starship', 'asteroid', 'velocity', 'momentum', 'particle', 'radiation',
    'satellite', 'telescope', 'astronaut', 'gyroscope', 'wormhole', 'supernova',
    'singularity', 'constellation', 'gravitation', 'antimatter', 'hyperdrive',
    'interstellar', 'terraforming', 'astrophysics', 'thermodynamic', 'electromagnet',
    'array', 'buffer', 'cipher', 'daemon', 'kernel', 'lambda', 'matrix', 'neural',
    'octree', 'packet', 'raster', 'socket', 'thread', 'vertex', 'binary', 'syntax',
    'compile', 'runtime', 'pointer', 'boolean', 'integer', 'iterate', 'reverse',
    'protocol', 'firewall', 'checksum', 'debugger', 'renderer', 'allocator',
    'algorithm', 'framework', 'recursion', 'container', 'processor', 'bandwidth',
    'asynchronous', 'polymorphism', 'cryptography', 'virtualization',
    'blaze', 'crush', 'drift', 'flare', 'glide', 'howl', 'lunge', 'shard',
    'spire', 'storm', 'surge', 'tempest', 'thunder', 'vortex', 'zenith', 'zephyr',
    'eclipse', 'horizon', 'phantom', 'requiem', 'sentinel', 'harbinger',
    'obliterate', 'annihilate', 'devastation', 'cataclysm', 'apocalypse',
    'transcendence', 'omniscience', 'inexorable', 'unfathomable', 'incandescent',

    /* --- 中位 (tier 2) --- */
    'gravitons', 'starcharts', 'luminosity', 'trajectory', 'propulsion', 'navigation',
    'spacecraft', 'wavelength', 'magnitude', 'ionosphere', 'planetoid', 'asteroids',
    'cosmonaut', 'stargazing', 'lightspeed', 'antigravity', 'starfield', 'moonlight',
    'metaclass', 'coroutines', 'dependency', 'immutable', 'middleware', 'serializer',
    'concurrent', 'idempotent', 'stacktrace', 'refactored', 'polymorphic', 'deserialize',

    /* --- 上位 (tier 3) --- */
    'astronomical', 'gravitational', 'thermonuclear', 'circumstellar', 'extragalactic',
    'interplanetary', 'astrobiology', 'magnetosphere', 'accelerometer', 'photosynthesis',
    'crystallizing', 'obliterating', 'transcendental', 'reverberation', 'astrophysicist',
    'orchestration', 'multithreaded', 'normalization', 'instantiation', 'encapsulation',
    'authentication', 'infrastructure', 'gravitationally', 'parallelization',

    /* --- 最上位 (tier 4) --- */
    'incomprehensible', 'interdimensional', 'electromagnetism', 'extraterrestrial',
    'indistinguishable', 'characteristically', 'uncharacteristic', 'crystallographic',
    'thermodynamically', 'incompatibilities', 'microarchitecture', 'superconductivity',
    'photoluminescence', 'interchangeability', 'counterintelligence', 'disproportionately'
  ];

  /* --- 構築: tier ごとにバケット化 --- */
  var buckets = { ja: [[], [], [], [], []], en: [[], [], [], [], []] };
  var allJa = [], allEn = [];

  function tierOf(len) {
    if (len <= 5) return 0;
    if (len <= 8) return 1;
    if (len <= 11) return 2;
    if (len <= 15) return 3;
    return 4;
  }

  function build() {
    var i;
    for (i = 0; i < JA.length; i++) {
      var w = { kana: JA[i][0], text: JA[i][1], en: JA[i][2] };
      w.len = ST.Romaji.defaultRomaji(w.kana).length;
      w.romaji = ST.Romaji.defaultRomaji(w.kana);
      allJa.push(w);
      buckets.ja[tierOf(w.len)].push(w);
    }
    for (i = 0; i < EN.length; i++) {
      var e = { text: EN[i], len: EN[i].length, romaji: EN[i] };
      allEn.push(e);
      buckets.en[tierOf(e.len)].push(e);
    }
    /* 空バケットは隣から補填 */
    ['ja', 'en'].forEach(function (k) {
      for (var t = 0; t < 5; t++) {
        if (!buckets[k][t].length) {
          for (var d = 1; d < 5; d++) {
            if (buckets[k][t - d] && buckets[k][t - d].length) { buckets[k][t] = buckets[k][t - d]; break; }
            if (buckets[k][t + d] && buckets[k][t + d].length) { buckets[k][t] = buckets[k][t + d]; break; }
          }
        }
      }
    });
  }

  var recent = [];
  function remember(w) {
    recent.push(w.kana || w.text);
    if (recent.length > 18) recent.shift();
  }
  function isRecent(w) { return recent.indexOf(w.kana || w.text) >= 0; }

  /* tier: 0..4 / lang: 'ja'|'en'|'mix' */
  function pick(tier, lang) {
    tier = ST.U.clamp(tier | 0, 0, 4);
    var key = lang === 'mix' ? (Math.random() < 0.5 ? 'ja' : 'en') : (lang === 'en' ? 'en' : 'ja');
    var pool = buckets[key][tier];
    if (!pool || !pool.length) pool = buckets[key][0];
    var w = null;
    for (var k = 0; k < 8; k++) {
      w = ST.U.choice(pool);
      if (!isRecent(w)) break;
    }
    remember(w);
    return w;
  }

  function resetRecent() { recent.length = 0; }

  return {
    build: build, pick: pick, tierOf: tierOf, resetRecent: resetRecent,
    get ja() { return allJa; }, get en() { return allEn; },
    get buckets() { return buckets; }
  };
})();
