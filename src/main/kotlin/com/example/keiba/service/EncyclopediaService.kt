package com.example.keiba.service

import com.example.keiba.model.CoatColor
import com.example.keiba.model.HorseBreed
import com.example.keiba.model.LegendaryHorse
import com.example.keiba.model.PedigreeLineage
import com.example.keiba.model.RacecourseGuide

class EncyclopediaService {

    fun getLegendaryHorses(): List<LegendaryHorse> = listOf(
        LegendaryHorse(
            id = "equinox",
            name = "イクイノックス",
            kana = "Equinox",
            title = "世界レーティング年間1位・孤高の絶対王者",
            birthYear = 2019,
            color = "青鹿毛",
            record = "10戦8勝 (G1 6勝)",
            totalEarnings = "22億1,544万円",
            sire = "キタサンブラック",
            dam = "シャトーブランシュ (母父: キングヘイロー)",
            majorWins = listOf("天皇賞(秋)連覇", "有馬記念", "ドバイSC", "宝塚記念", "ジャパンカップ"),
            description = "圧倒的なストライドとスピードで2023年ロンジンワールドベストレースホースランキング単独世界1位に輝いた日本近代競馬の最高傑作。ジャパンカップではラスト直線をノーステッキのまま独走して伝説を残した。",
            iconEmoji = "👑",
            speedRadar = 99,
            staminaRadar = 95,
            powerRadar = 94,
            spiritRadar = 96,
            agilityRadar = 92
        ),
        LegendaryHorse(
            id = "do-deuce",
            name = "ドウデュース",
            kana = "Do Deuce",
            title = "不屈の闘志・武豊と共に時代を駆ける武神",
            birthYear = 2019,
            color = "鹿毛",
            record = "14戦7勝 (G1 4勝)",
            totalEarnings = "16億8,920万円",
            sire = "ハーツクライ",
            dam = "ダストアンドダイヤモンズ (母父: Vindication)",
            majorWins = listOf("日本ダービー", "朝日杯FS", "有馬記念", "天皇賞(秋)"),
            description = "鋼の肉体と爆発的な末脚を併せ持つグランプリホース。日本ダービーでのレコード激走、そして天皇賞(秋)で上がり3F 32.5秒という異次元の直線一気を見せつけ、競馬ファンの魂を揺さぶり続けている。",
            iconEmoji = "🔥",
            speedRadar = 97,
            staminaRadar = 93,
            powerRadar = 98,
            spiritRadar = 98,
            agilityRadar = 89
        ),
        LegendaryHorse(
            id = "almond-eye",
            name = "アーモンドアイ",
            kana = "Almond Eye",
            title = "芝G1最多9勝・歴史を塗り替えた最強の女王",
            birthYear = 2015,
            color = "鹿毛",
            record = "15戦11勝 (G1 9勝)",
            totalEarnings = "19億1,526万円",
            sire = "ロードカナロア",
            dam = "フサイチパンドラ (母父: サンデーサイレンス)",
            majorWins = listOf("牝馬3冠", "ジャパンカップ(2回)", "天皇賞(秋)連覇", "ドバイターフ", "ヴィクトリアM"),
            description = "3冠牝馬にして日本調教馬最多の芝G1・9勝を達成。2018年ジャパンカップでは2分20秒6という世界レコードを叩き出し、ルメール騎手をして『彼女は飛んでいる』と言わしめた歴史的スーパーホース。",
            iconEmoji = "💎",
            speedRadar = 99,
            staminaRadar = 92,
            powerRadar = 93,
            spiritRadar = 95,
            agilityRadar = 96
        ),
        LegendaryHorse(
            id = "deep-impact",
            name = "ディープインパクト",
            kana = "Deep Impact",
            title = "日本近代競馬の結晶・空を飛んだ無敗の3冠馬",
            birthYear = 2002,
            color = "鹿毛",
            record = "14戦12勝 (G1 7勝)",
            totalEarnings = "14億5,455万円",
            sire = "サンデーサイレンス",
            dam = "ウインドインハーヘア (母父: Alzao)",
            majorWins = listOf("無敗クラシック3冠 (皐月賞・日本ダービー・菊花賞)", "天皇賞(春)", "宝塚記念", "ジャパンカップ", "有馬記念"),
            description = "走るというより『飛んでいる』と形容された希代の名馬。後方から直線だけで全馬をごぼう抜きにする神業のような走りは日本中に社会現象を巻き起こし、種牡馬としても日本競馬の血統図を塗り替えた。",
            iconEmoji = "⚡",
            speedRadar = 99,
            staminaRadar = 96,
            powerRadar = 90,
            spiritRadar = 97,
            agilityRadar = 98
        ),
        LegendaryHorse(
            id = "orphevre",
            name = "オルフェーヴル",
            kana = "Orfevre",
            title = "黄金の暴君・世界を震わせた狂気と威厳の三冠馬",
            birthYear = 2008,
            color = "栗毛",
            record = "21戦12勝 (G1 6勝)",
            totalEarnings = "15億7,621万円",
            sire = "ステイゴールド",
            dam = "オリエンタルアート (母父: メジロマックイーン)",
            majorWins = listOf("クラシック3冠", "宝塚記念", "有馬記念(2回)", "凱旋門賞(2着2回)"),
            description = "阪神大賞典での大逸走から2着への巻き返し、凱旋門賞での先頭からの惜敗、引退レースの有馬記念で8馬身差圧勝など、ドラマチックすぎる走りで競馬界の伝説となった栗毛の怪物。",
            iconEmoji = "🦁",
            speedRadar = 96,
            staminaRadar = 99,
            powerRadar = 97,
            spiritRadar = 99,
            agilityRadar = 91
        )
    )

    fun getPedigreeLineages(): List<PedigreeLineage> = listOf(
        PedigreeLineage(
            id = "sunday-silence",
            name = "サンデーサイレンス系",
            founder = "サンデーサイレンス (Halo系)",
            keyStallions = listOf("ディープインパクト", "ハーツクライ", "キタサンブラック", "ステイゴールド"),
            turfAptitude = "★★★★★ (芝の瞬発力において世界最高水準)",
            dirtAptitude = "★★★☆☆ (ゴールドアリュール等を除き芝中心)",
            distanceRange = "1600m - 2500m (万能・中長距離の王道)",
            characteristics = "圧倒的なキレ味（トップスピードの瞬発力）と軽快なフットワーク。直線の長いコースでの瞬発力勝負に絶対的な強さを誇る日本競馬の主流血統。",
            representativeHorses = listOf("ディープインパクト", "イクイノックス", "ドウデュース", "ジェンティルドンナ")
        ),
        PedigreeLineage(
            id = "kingmambo",
            name = "キングカメハメハ系",
            founder = "キングカメハメハ (Kingmambo / Mr. Prospector系)",
            keyStallions = listOf("ロードカナロア", "ドゥラメンテ", "ルーラーシップ", "リオンディーズ"),
            turfAptitude = "★★★★★ (高速馬場からタフな芝まで対応)",
            dirtAptitude = "★★★★☆ (パワーとダート適性も高水準)",
            distanceRange = "1200m - 2400m (短距離からクラシックまで)",
            characteristics = "頑強な骨格と持続力あふれる末脚。芝・ダートを問わず活躍馬を輩出し、サンデーサイレンス系牝馬との配合（キンカメ×サンデー）で無類のニックスを発揮。",
            representativeHorses = listOf("アーモンドアイ", "タイトルホルダー", "リバティアイランド", "スターズオンアース")
        ),
        PedigreeLineage(
            id = "roberto",
            name = "ロベルト系",
            founder = "ロベルト (Hail to Reason系)",
            keyStallions = listOf("エピファネイア", "モーリス", "シンボリクリスエス", "スクリーンヒーロー"),
            turfAptitude = "★★★★☆ (坂道・冬場・タフな馬場に絶大)",
            dirtAptitude = "★★★★☆ (パワー型でダート適性高い)",
            distanceRange = "1600m - 2500m (中山など急坂コース得意)",
            characteristics = "直線の急坂や荒れた重馬場、ハイペースの我慢比べで真価を発揮する強靭な底力とパワー。大一番やタフなグランプリで激走を見せる血統。",
            representativeHorses = listOf("エフフォーリア", "デアリングタクト", "ダノンデサイル", "ブローザホーン")
        ),
        PedigreeLineage(
            id = "northern-dancer",
            name = "ノーザンダンサー系",
            founder = "ノーザンダンサー (Nearctic系)",
            keyStallions = listOf("ハービンジャー", "フランケル", "ガリレオ", "バゴ"),
            turfAptitude = "★★★★☆ (重馬場・欧州型タフネスの象徴)",
            dirtAptitude = "★★★☆☆ (ストームキャット系などはダート◎)",
            distanceRange = "2000m - 3200m (ステイヤー・長距離戦に強い)",
            characteristics = "豊かなスタミナと悪天候・重馬場への強い耐性。洋芝（札幌・函館）や時計のかかるタフな競馬場での信頼度は全血統トップクラス。",
            representativeHorses = listOf("クロノジェネシス", "チェルヴィニア", "レガレイラ", "ブラストワンピース")
        )
    )

    fun getRacecourseGuides(): List<RacecourseGuide> = listOf(
        RacecourseGuide(
            id = "tokyo",
            name = "東京競馬場 (府中)",
            location = "東京都府中市",
            straightLengthMeters = 525.9,
            elevationDiffMeters = 2.7,
            slopeCharacteristic = "第4コーナー出口から緩やかに上る高低差2mの「だらだら坂」。坂を登り切ってからも残り300mの平坦直線が続く。",
            keyFeature = "日本最長クラスの雄大な直線。紛れが極めて少なく、純粋なスピード指数と持続力が最も素直に結果へ反映されるチャンピオンコース。",
            courseDiagramAscii = """
                [ スタート ] ──── 3コーナー ──── 4コーナー
                                                    │
                 [ だらだら坂 ▲ 2m ] ─────────────┘
                     │
                 [ 最後の直線 525.9m 平坦 ] ─── [ GOAL ]
            """.trimIndent(),
            turn = "左",
            elevationProfile = listOf(0.5, 1.2, 1.8, 1.5, 0.6, 0.0, 0.3, 1.2, 2.0, 2.0, 2.0)
        ),
        RacecourseGuide(
            id = "nakayama",
            name = "中山競馬場 (船橋)",
            location = "千葉県船橋市",
            straightLengthMeters = 310.0,
            elevationDiffMeters = 5.3,
            slopeCharacteristic = "ゴール前200m地点から待ち構える高低差2.2mの「心臓破りの急坂」。コース全体でも5.3mというJRA最大級の高低差。",
            keyFeature = "小回りかつ短い直線。器用なコーナリングと内枠先行馬が有利。しかし最後の急坂で急激にスタミナを奪われるためパワー適性が必須。",
            courseDiagramAscii = """
                [ 小回りコーナー ] ────────── 4コーナー出口
                                                  │
                 [ 急坂 ▲ 2.2m (残り200m) ] ──────┘
                     │
                 [ 短い直線 310m ] ────────── [ GOAL ]
            """.trimIndent(),
            turn = "右",
            elevationProfile = listOf(3.5, 4.5, 5.3, 4.8, 3.5, 2.0, 1.0, 0.3, 0.0, 1.2, 2.2)
        ),
        RacecourseGuide(
            id = "kyoto",
            name = "京都競馬場 (淀)",
            location = "京都府京都市伏見区",
            straightLengthMeters = 404.0,
            elevationDiffMeters = 4.3,
            slopeCharacteristic = "バックストレッチから3コーナーにかけて登り、一気に駆け下りる「淀の坂 (高低差4.3m)」。直線は平坦。",
            keyFeature = "坂の登りでは息を入れ、下り坂の惰性を活かして加速する「下り坂スパート」が伝統。下りで勢いをつけすぎない騎手のペース判断が重要。",
            courseDiagramAscii = """
                [ 登り坂 ▲ 4.3m ] ── [ 頂上 ] ── [ 下り坂 ▼ ]
                                                      │
                 [ 4コーナー出口 ] ──────────────────┘
                     │
                 [ 平坦な直線 404m ] ───────── [ GOAL ]
            """.trimIndent(),
            turn = "右",
            elevationProfile = listOf(0.0, 1.5, 3.0, 4.3, 3.0, 1.2, 0.3, 0.2, 0.2, 0.2, 0.2)
        ),
        RacecourseGuide(
            id = "hanshin",
            name = "阪神競馬場 (仁川)",
            location = "兵庫県宝塚市",
            straightLengthMeters = 473.6,
            elevationDiffMeters = 2.4,
            slopeCharacteristic = "外回りは雄大な直線473.6m。ゴール前200mに高低差1.8mの急坂があり、登坂力と末脚の切れが問われる。",
            keyFeature = "外回りは桜花賞や宝塚記念など名勝負の舞台。内回りと外回りで直線の長さが大きく異なり、外回りは差し・追込が存分に届く。",
            courseDiagramAscii = """
                [ 大外回りカーブ ] ───────── 4コーナー出口
                                                  │
                 [ 雄大な直線 473.6m ] ──────────┘
                     │
                 [ ゴール前急坂 ▲ 1.8m ] ──── [ GOAL ]
            """.trimIndent(),
            turn = "右",
            elevationProfile = listOf(1.5, 1.8, 2.0, 1.6, 1.0, 0.6, 0.3, 0.0, 0.0, 1.0, 1.8)
        )
    )

    fun getBreeds(): List<HorseBreed> = listOf(
        HorseBreed("thoroughbred", "サラブレッド", "イギリス (17〜18世紀)", "160〜170cm", "450〜550kg", "平地競走 (JRA・地方の主役)",
            "3頭の始祖 (ダーレーアラビアン・ゴドルフィンアラビアン・バイアリーターク) から改良された、走るためだけに作られた品種。細い脚と大きな心肺で時速60km超を出す。", "#8b5a2b", 1.0),
        HorseBreed("arabian", "アラブ (アラブ種)", "アラビア半島", "145〜155cm", "380〜450kg", "耐久競技・品種改良の基礎",
            "最古の品種のひとつ。小柄だが持久力に優れ、サラブレッドの祖先でもある。しゃくれた顔 (ディッシュフェイス) と高く上がった尾が特徴。", "#c9c3b8", 0.85),
        HorseBreed("anglo-arab", "アングロアラブ", "フランス", "155〜165cm", "430〜500kg", "かつての地方競馬・馬術",
            "サラブレッドとアラブの交配種。日本でも1990年代まで「アラブ系競走」が行われていた。スピードとタフさを兼ね備える。", "#a0522d", 0.95),
        HorseBreed("quarter", "クォーターホース", "アメリカ", "145〜160cm", "450〜550kg", "1/4マイル (約400m) の短距離競走・ウエスタン乗馬",
            "名前の由来は 1/4マイル戦で最速なこと。筋肉質な後躯で、瞬発力は全品種でトップクラス。", "#b5651d", 1.15),
        HorseBreed("percheron", "ペルシュロン (ばん馬)", "フランス", "165〜180cm", "800〜1,200kg", "ばんえい競馬 (帯広)",
            "重いソリを引いて障害を越える「ばんえい競馬」の主役。体重1トンを超えることもある重種馬。日本では改良されて「日本輓系種」となった。", "#4a4a4a", 1.45),
        HorseBreed("dosanko", "北海道和種 (道産子)", "日本 (北海道)", "130〜135cm", "350〜400kg", "荷役・観光乗馬",
            "日本在来馬の代表。寒さに強く、粗食に耐える。小柄でがっしりしており、側対歩 (同じ側の前後脚を同時に出す歩き方) で揺れが少ない。", "#7b5b3a", 1.1),
        HorseBreed("pony", "ポニー (シェトランド)", "スコットランド", "〜107cm", "150〜200kg", "子どもの乗馬・ふれあい",
            "肩までの高さ147cm以下の小型馬の総称がポニー。シェトランドは特に小さく、力持ちで賢い。", "#3b2a1a", 1.2)
    )

    // JRA の公式毛色は8種類
    fun getCoatColors(): List<CoatColor> = listOf(
        CoatColor("栗毛", "くりげ", "#b5651d", "#d08a4a", "全身が明るい赤茶色で、たてがみと尾も同系色。", "オルフェーヴル"),
        CoatColor("栃栗毛", "とちくりげ", "#7a3e1a", "#a0603a", "栗毛のうち、色が濃く黒っぽいもの。", "ゴールドシップ (祖父の系統)"),
        CoatColor("鹿毛", "かげ", "#8b4513", "#1a1a1a", "茶色の体に、たてがみ・尾・脚先が黒。最も多い毛色。", "ドウデュース / アーモンドアイ"),
        CoatColor("黒鹿毛", "くろかげ", "#4a2a1a", "#111111", "鹿毛より黒みが強く、鼻先や腹だけ茶色が残る。", "キタサンブラック"),
        CoatColor("青鹿毛", "あおかげ", "#2a1c16", "#0a0a0a", "ほぼ黒だが、目や鼻の周りにわずかに茶色が見える。", "イクイノックス"),
        CoatColor("青毛", "あおげ", "#121212", "#000000", "全身が真っ黒。「青」は日本語で黒の古い言い方。", "ヴィクトワールピサ (青鹿毛寄り)"),
        CoatColor("芦毛", "あしげ", "#bfbfbf", "#8c8c8c", "生まれた時は黒っぽく、年をとるにつれ白くなる。", "ゴールドシップ / オグリキャップ"),
        CoatColor("白毛", "しろげ", "#f5f3ee", "#ffffff", "生まれつき白い。非常に珍しく、2021年にソダシが白毛初のG1制覇。", "ソダシ")
    )
}
