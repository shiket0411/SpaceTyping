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
    ['ちょうだいしつりょうたい', '超大質量体', 'supermassive body'],

    /* --- 増補: 艦と乗員 --- */
    ['そうじゅうせき', '操縦席', 'cockpit'], ['かんせいとう', '管制塔', 'control tower'],
    ['ほきゅうかん', '補給艦', 'supply ship'], ['きゅうめいてい', '救命艇', 'escape pod'],
    ['しれいかん', '司令官', 'commander'], ['こうかいし', '航海士', 'navigator'],
    ['そうじゅうし', '操縦士', 'pilot'], ['つうしんし', '通信士', 'comms officer'],
    ['せんじゅつかん', '戦術官', 'tactical officer'], ['せいびへい', '整備兵', 'mechanic'],
    ['かんたいしれい', '艦隊司令', 'fleet command'], ['きかんしつ', '機関室', 'engine room'],
    ['かんきょうせいぎょ', '環境制御', 'life support'], ['ふくごうそうこう', '複合装甲', 'composite armor'],
    ['たんそうほう', '単装砲', 'single turret'], ['れんそうほう', '連装砲', 'twin turret'],
    ['しゅほうもん', '主砲門', 'main battery'], ['ふくほうもん', '副砲門', 'secondary battery'],
    ['ぼうくうけん', '防空圏', 'air defense zone'], ['こうくうぼかん', '航空母艦', 'carrier'],

    /* --- 増補: 現象と観測 --- */
    ['たいくうほうか', '対空砲火', 'flak'], ['きどうばくげき', '軌道爆撃', 'orbital strike'],
    ['かんそくえいせい', '観測衛星', 'observation satellite'], ['れいきゃくざい', '冷却材', 'coolant'],
    ['かそくそうち', '加速装置', 'accelerator'], ['りょうしろ', '量子炉', 'quantum reactor'],
    ['ちょうりょくば', '張力場', 'tension field'], ['じそくかんり', '磁束管理', 'flux control'],
    ['くうかんわい', '空間歪', 'spatial distortion'], ['じゅうりょくれんず', '重力レンズ', 'gravitational lens'],
    ['こうねんたんい', '光年単位', 'light-year scale'], ['せきがいせん', '赤外線', 'infrared'],
    ['しがいせん', '紫外線', 'ultraviolet'], ['でんじゆうどう', '電磁誘導', 'induction'],
    ['ねつでんつい', '熱電対', 'thermocouple'], ['こうでんへんかん', '光電変換', 'photoelectric'],
    ['ちょうでんどうじば', '超電導磁場', 'superconducting field'],
    ['じきけんかんそく', '磁気圏観測', 'magnetosphere survey'],
    ['りゅうしかそくき', '粒子加速器', 'particle accelerator'],
    ['じゅうりょくいどこうぞう', '重力井戸構造', 'gravity well structure'],
    ['ちょうしんせいざんがい', '超新星残骸', 'supernova remnant'],
    ['あんこくえねるぎー', '暗黒エネルギー', 'dark energy'],
    ['じくうきょくりつ', '時空曲率', 'spacetime curvature'],
    ['りょうしもつれじょうたい', '量子もつれ状態', 'entangled state'],
    ['たいしょうせいはかい', '対称性破壊', 'symmetry breaking'],
    ['じげんそうしつげんしょう', '次元喪失現象', 'dimensional loss'],
    ['こうじげんくうかんこうぞう', '高次元空間構造', 'hyperdimensional structure'],
    ['ちょうたいしょうせいりろん', '超対称性理論', 'supersymmetry'],
    ['そうたいろんてきしつりょう', '相対論的質量', 'relativistic mass'],
    ['じゅうりょくはかんそくき', '重力波観測機', 'gravitational wave detector'],

    /* --- 増補: 戦闘と任務 --- */
    ['ぜんめつせん', '殲滅戦', 'annihilation'], ['ようげきせん', '要撃戦', 'interception'],
    ['はさみうち', '挟み撃ち', 'pincer'], ['ゆうどうだん', '誘導弾', 'guided missile'],
    ['しゃかいせん', '射界線', 'firing line'], ['そうこうへき', '装甲壁', 'armor wall'],
    ['ぜんしんぼうぎょ', '全身防御', 'full defense'], ['きんきゅうかいひ', '緊急回避', 'emergency evasion'],
    ['きょうせいちゃっかん', '強制着艦', 'forced landing'], ['ろうじょうせん', '籠城戦', 'siege'],
    ['きしゅうさくせん', '奇襲作戦', 'surprise attack'], ['ようさいこうりゃく', '要塞攻略', 'fortress assault'],
    ['はかいこうさく', '破壊工作', 'sabotage'], ['じんちこうちく', '陣地構築', 'fortify'],
    ['しえんほうげき', '支援砲撃', 'fire support'], ['だっしゅつけいろ', '脱出経路', 'escape route'],
    ['ぼうえいらいん', '防衛ライン', 'defense line'], ['ぜんぽうけいかい', '前方警戒', 'forward watch'],
    ['こうほうけいかい', '後方警戒', 'rear watch'], ['さくてきはんい', '索敵範囲', 'search radius'],
    ['きどうぼうえいもう', '軌道防衛網', 'orbital defense net'],
    ['たいかんみさいる', '対艦ミサイル', 'anti-ship missile'],
    ['じどうげいげきしすてむ', '自動迎撃システム', 'auto intercept system'],
    ['きんきょりせんとう', '近距離戦闘', 'close quarters'],
    ['ちょうえんきょりそげき', '超遠距離狙撃', 'long range snipe'],
    ['ぜんほういぼうえい', '全方位防衛', 'omni defense'],
    ['そうごうかんせいしすてむ', '総合管制システム', 'integrated control'],
    ['きょうりょくじばはっせい', '強力磁場発生', 'strong field generation'],

    /* --- 増補: 文明と物語 --- */
    ['こだいいせき', '古代遺跡', 'ancient ruins'], ['いぶんめい', '異文明', 'alien civilization'],
    ['きょうやく', '協約', 'accord'], ['りゅうぼう', '流亡', 'exile'],
    ['きかんふのう', '帰還不能', 'point of no return'], ['そうしつかん', '喪失感', 'sense of loss'],
    ['さいかいのひ', '再会の日', 'day of reunion'], ['やくそくのち', '約束の地', 'promised land'],
    ['ほしのはて', '星の果て', 'edge of stars'], ['よあけまえ', '夜明け前', 'before dawn'],
    ['さいごのひかり', '最後の光', 'the last light'], ['とわのしずけさ', '永遠の静けさ', 'eternal silence'],
    ['きおくのかけら', '記憶の欠片', 'shard of memory'], ['ぼうきゃくのうみ', '忘却の海', 'sea of oblivion'],
    ['きせきのきかん', '奇跡の帰還', 'miraculous return'],
    ['えいえんのほうろう', '永遠の放浪', 'eternal wandering'],
    ['なだれこむひかり', '雪崩れ込む光', 'cascading light'],
    ['しずかなるはめつ', '静かなる破滅', 'silent ruin'],
    ['うしなわれたぶんめい', '失われた文明', 'lost civilization'],
    ['かえらざるこうかいしゃ', '帰らざる航海者', 'the voyager who never returns'],

    /* --- 増補: 文章 --- */
    ['ぜんきかんしゅつりょくさいだい', '全機関出力最大', 'all engines to maximum'],
    ['たいきけんとつにゅうようい', '大気圏突入用意', 'prepare for atmospheric entry'],
    ['しゅりょくほうもんかいほう', '主力砲門開放', 'open the main batteries'],
    ['ぜんかんたいこうげきかいし', '全艦隊攻撃開始', 'all fleets commence attack'],
    ['きどうしゅうせいをかいしせよ', '軌道修正を開始せよ', 'begin course correction'],
    ['はんぶっしつろしんりんかい', '反物質炉心臨界', 'antimatter core critical'],
    ['じくうだんそうかんそくちゅう', '時空断層観測中', 'observing spacetime fault'],
    ['しんくうくうかんへだっしゅつ', '真空空間へ脱出', 'eject into vacuum'],
    ['ちょうこうそくこうかいじゅんび', '超光速航海準備', 'prepare for ftl voyage'],
    ['せんとうはいちにつけ', '戦闘配置につけ', 'battle stations'],
    ['そうこうへきをてんかいせよ', '装甲壁を展開せよ', 'deploy the armor wall'],
    ['めいちゅうりつをさいだいに', '命中率を最大に', 'maximize accuracy'],
    ['きんきゅうかいひこうどうへ', '緊急回避行動へ', 'evasive maneuvers'],
    ['ぜんぽうにきょだいはんのう', '前方に巨大反応', 'massive contact ahead'],
    ['しれいけいとうをふっきゅうせよ', '指令系統を復旧せよ', 'restore the command chain'],
    ['りょうしつうしんかいせんかいほう', '量子通信回線開放', 'open the quantum channel'],
    ['ぎんがちゅうしんへとうたつせり', '銀河中心へ到達せり', 'we have reached the core'],
    ['さいしゅうへいききどうかいし', '最終兵器起動開始', 'final weapon activating'],
    ['せいめいはんのうそうしつかくにん', '生命反応消失確認', 'life signs lost'],
    ['じりつせんとうもーどへいこう', '自律戦闘モードへ移行', 'switching to autonomous combat'],
    ['ぜんそくりょくでりだつせよ', '全速力で離脱せよ', 'withdraw at full speed'],
    ['くうかんてんいをかんりょうせり', '空間転移を完了せり', 'spatial transfer complete'],
    ['あんこくぶっしつのうどじょうしょう', '暗黒物質濃度上昇', 'dark matter density rising'],
    ['ほうかいまでのこりさんじゅうびょう', '崩壊まで残り三十秒', 'thirty seconds to collapse'],
    ['ぜんいんただちにたいひせよ', '全員直ちに退避せよ', 'all hands evacuate now'],
    ['このほしにあすはこない', 'この星に明日は来ない', 'no tomorrow for this world'],
    ['われらはほしのうみをわたる', '我らは星の海を渡る', 'we cross the sea of stars'],
    ['きかんのしんごうをまちつづける', '帰還の信号を待ち続ける', 'still waiting for the signal'],
    ['ひかりよりはやくかけぬけろ', '光より速く駆け抜けろ', 'run faster than light'],
    ['さいごのひとりになるまでたたかえ', '最後の一人になるまで戦え', 'fight to the last']
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
    'photoluminescence', 'interchangeability', 'counterintelligence', 'disproportionately',

    /* --- 増補: 宇宙 --- */
    'aerobrake', 'lightyear', 'exoplanet', 'terraform', 'meteorite', 'planetary',
    'spacetime', 'hyperjump', 'starforge', 'starquake', 'cryogenic', 'photonics',
    'radiative', 'telemetry', 'moonscape', 'deepspace', 'spacewalk', 'starcruise',
    'astronomer', 'heliosphere', 'interplanet', 'starcluster', 'lunarorbit',
    'chronometric', 'cosmological', 'electrostatic', 'gravitometer', 'heliocentric',
    'planetesimal', 'spectrometry', 'thermosphere', 'ultraviolet', 'radiotelescope',
    'weightlessness', 'nucleosynthesis', 'astrophotography', 'circumnavigation',
    'electrodynamics', 'instrumentation', 'magnetospheric', 'multidimensional',
    'observationally', 'radioastronomy', 'spectroscopically', 'thermoregulation',

    /* --- 増補: 技術 --- */
    'benchmark', 'bitstream', 'callstack', 'codepoint', 'datastore', 'hashtable',
    'iterators', 'namespace', 'nullcheck', 'overflows', 'prototype', 'recursive',
    'semaphore', 'vectorize', 'threadsafe', 'typesystem', 'memoization',
    'bidirectional', 'checkpointing', 'deterministic', 'interpolation',
    'lexicographic', 'optimization', 'partitioning', 'quantization',
    'reproducible', 'synchronizing', 'tokenization', 'asynchronously',
    'containerization', 'internationalize', 'interoperability', 'microcontroller',
    'parameterization', 'representational', 'serializability', 'synchronization',
    'transactionality', 'backwardcompatible',

    /* --- 増補: 交信文（スペースも打鍵対象。モード切替は TAB） --- */
    'warp core online', 'all systems nominal', 'initiate jump sequence',
    'target lock confirmed', 'hull breach detected', 'shields at maximum',
    'reactor overload imminent', 'evasive maneuvers engaged',
    'quantum entanglement relay', 'antimatter containment failure',
    'gravitational anomaly ahead', 'life support critical',
    'plotting hyperspace route', 'weapons free authorized',
    'emergency power rerouted', 'sensor array recalibrated',
    'self destruct armed', 'galactic core approach',
    'singularity breach alert', 'final countdown initiated',
    'navigation lock acquired', 'thermal shielding degraded',
    'all hands abandon ship', 'we cross the sea of stars',
    'brace for impact', 'the last light is fading',
    'hold the line until dawn', 'no signal from the outer fleet',
    'we are the only ones left', 'set course for the galactic core'
  ];

  /* --- 構築: tier ごとにバケット化 --- */
  var TIERS = 6;
  var buckets = { ja: [[], [], [], [], [], []], en: [[], [], [], [], [], []] };
  var allJa = [], allEn = [];

  /* tier5 は文章。打鍵数だけで自動的に振り分けるので、
     語を足すときに階層を意識する必要はない。 */
  function tierOf(len) {
    if (len <= 5) return 0;
    if (len <= 8) return 1;
    if (len <= 11) return 2;
    if (len <= 15) return 3;
    if (len <= 19) return 4;
    return 5;
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
      for (var t = 0; t < TIERS; t++) {
        if (!buckets[k][t].length) {
          for (var d = 1; d < TIERS; d++) {
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
    tier = ST.U.clamp(tier | 0, 0, TIERS - 1);
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
    build: build, pick: pick, tierOf: tierOf, resetRecent: resetRecent, TIERS: TIERS,
    get ja() { return allJa; }, get en() { return allEn; },
    get buckets() { return buckets; }
  };
})();
