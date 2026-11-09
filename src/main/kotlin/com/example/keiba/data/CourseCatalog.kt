package com.example.keiba.data

import com.example.keiba.model.Racecourse

/**
 * 現役の全国 25 競馬場。直線距離・回りは各場の公表値をもとにした参考値
 * (コースが複数ある場は代表的なものを記載)。座標と写真は起動後に Wikidata から補完。
 * YouTube チャンネルは各競馬場の公式サイトからリンクされている公式チャンネル。
 */
object CourseCatalog {
    private const val JRA_YT = "UCj6AKkCWS6FJqf0o5wP45eQ"
    private fun jra(id: String, short: String, qid: String, region: String, turn: String, straight: Double, note: String, profile: List<Double> = emptyList()) =
        Racecourse(id, "${short}競馬場", short, qid, "日本中央競馬会 (JRA)", "中央", region, turn, "芝・ダート", straight, note,
            "https://www.jra.go.jp/facilities/race/$id/", JRA_YT, "JRA公式チャンネル", elevationProfile = profile)

    private fun nar(id: String, short: String, qid: String, organizer: String, region: String, turn: String, straight: Double, note: String,
                    web: String, yt: String?, ytLabel: String, surfaces: String = "ダート", category: String = "地方") =
        Racecourse(id, "${short}競馬場", short, qid, organizer, category, region, turn, surfaces, straight, note, web, yt, ytLabel)

    val all: List<Racecourse> = listOf(
        jra("sapporo", "札幌", "Q7421104", "北海道", "右", 266.1, "全周が洋芝。平坦で小回り、夏の北海道開催の舞台。"),
        jra("hakodate", "函館", "Q5640576", "北海道", "右", 262.1, "JRA最古の競馬場。洋芝で直線が短く、先行力が問われる。"),
        jra("fukushima", "福島", "Q5507737", "東北", "右", 292.0, "小回りで直線が短い。開催後半は内側の芝が荒れやすい。"),
        jra("niigata", "新潟", "Q11503575", "北陸", "左", 658.7, "外回りの直線はJRA最長。芝1000mの直線競走が行われる唯一の場。"),
        jra("tokyo", "東京", "Q1055592", "関東", "左", 525.9, "広く直線が長い王道コース。日本ダービー・ジャパンカップの舞台。",
            listOf(0.5, 1.2, 1.8, 1.5, 0.6, 0.0, 0.3, 1.2, 2.0, 2.0, 2.0)),
        jra("nakayama", "中山", "Q1055536", "関東", "右", 310.0, "ゴール前に急坂。高低差はJRA最大級で、有馬記念の舞台。",
            listOf(3.5, 4.5, 5.3, 4.8, 3.5, 2.0, 1.0, 0.3, 0.0, 1.2, 2.2)),
        jra("chukyo", "中京", "Q5116071", "東海", "左", 412.5, "直線に急坂があり、差しも届く。高松宮記念・チャンピオンズCの舞台。"),
        jra("kyoto", "京都", "Q6452200", "関西", "右", 403.7, "3コーナーの「淀の坂」を下って加速する。菊花賞・天皇賞(春)の舞台。",
            listOf(0.0, 1.5, 3.0, 4.3, 3.0, 1.2, 0.3, 0.2, 0.2, 0.2, 0.2)),
        jra("hanshin", "阪神", "Q5651125", "関西", "右", 473.6, "外回りは直線が長く、ゴール前に急坂。宝塚記念・桜花賞の舞台。",
            listOf(1.5, 1.8, 2.0, 1.6, 1.0, 0.6, 0.3, 0.0, 0.0, 1.0, 1.8)),
        jra("kokura", "小倉", "Q6426899", "九州", "右", 293.0, "平坦な小回り。スピードの持続力が問われる夏の開催地。"),

        nar("obihiro", "帯広", "Q11481183", "帯広市", "北海道", "直線", 200.0, "世界で唯一のばんえい競馬。重いソリを引いて2つの障害を越える。",
            "https://www.banei-keiba.or.jp/", "UCyjlxPcoYAbpwlr5wjUA_5g", "ばんえい十勝【公式】", "砂 (直線)", "ばんえい"),
        nar("mombetsu", "門別", "Q11654953", "北海道軽種馬振興公社", "北海道", "右", 330.0, "ホッカイドウ競馬の本拠地。全レースがナイター。",
            "https://www.hokkaidokeiba.net/", "UC6tQosgNJOmZUGmtkSvI6zA", "ホッカイドウ競馬チャンネル"),
        nar("morioka", "盛岡", "Q6912290", "岩手県競馬組合", "東北", "左", 300.0, "地方で唯一の芝コースを持つ。起伏の大きいコース。",
            "https://www.iwatekeiba.or.jp/", "UCVMhQ20_Y0vseUV7doOotwg", "岩手競馬", "芝・ダート"),
        nar("mizusawa", "水沢", "Q11548866", "岩手県競馬組合", "東北", "右", 247.0, "平坦で小回り。冬場も開催される岩手のもう一つの舞台。",
            "https://www.iwatekeiba.or.jp/", "UCVMhQ20_Y0vseUV7doOotwg", "岩手競馬"),
        nar("urawa", "浦和", "Q11558172", "埼玉県浦和競馬組合", "関東", "左", 220.0, "南関東で最も小回り。内枠・先行が有利とされる。",
            "https://www.urawa-keiba.jp/", "UCdtB0m4BIjadiqV3C0Vi9SQ", "浦和競馬【公式】"),
        nar("funabashi", "船橋", "Q5508707", "千葉県競馬組合", "関東", "左", 308.0, "スパイラルカーブを採用。かしわ記念の舞台。",
            "https://www.f-keiba.com/", "UCfnIcvhLkVVCTd86yemmGnQ", "船橋競馬場"),
        nar("ohi", "大井", "Q7080668", "特別区競馬組合", "関東", "右", 386.0, "トゥインクルレースのナイター。東京大賞典・帝王賞の舞台 (左回りコースもあり)。",
            "https://www.tokyocitykeiba.com/", "UCPSZn8iMXln9o89SpmeJ6wg", "TCK 東京シティ競馬【公式】"),
        nar("kawasaki", "川崎", "Q6379820", "神奈川県川崎競馬組合", "関東", "左", 300.0, "コーナーがきつい小回り。川崎記念の舞台。",
            "https://www.kawasaki-keiba.jp/", "UCF7v-dGy_jQ_7bOi7oab2PA", "【公式】川崎競馬"),
        nar("kanazawa", "金沢", "Q11647518", "石川県", "北陸", "右", 236.0, "北陸唯一の競馬場。白山大賞典の舞台。",
            "https://www.kanazawakeiba.com/", "UCMRX5ABMJWPR6aWlyZYeKog", "金沢競馬【公式チャンネル】"),
        nar("kasamatsu", "笠松", "Q11599930", "岐阜県地方競馬組合", "東海", "右", 201.0, "オグリキャップを生んだ競馬場。直線が非常に短い。",
            "https://www.kasamatsu-keiba.com/", "UCmPuLUWCwfAW99ezdCj6ayQ", "笠松けいばレース映像配信チャンネル"),
        nar("nagoya", "名古屋", "Q6958986", "愛知県競馬組合", "東海", "右", 240.0, "2022年に弥富市へ移転した新しい競馬場。",
            "https://www.nagoyakeiba.com/", "UCY8Ej3wLRVqZ5KDDdhyzF6g", "名古屋競馬パドックチャンネル"),
        nar("sonoda", "園田", "Q11422855", "兵庫県競馬組合", "関西", "右", 213.0, "小回りで先行有利。ナイター「そのだ金曜ナイター」も開催。",
            "https://www.sonodahimeji.jp/", null, "公式サイトでライブ配信"),
        nar("himeji", "姫路", "Q11447566", "兵庫県競馬組合", "関西", "右", 230.0, "園田と同じ兵庫県競馬組合が主催。冬〜春に開催。",
            "https://www.sonodahimeji.jp/", null, "公式サイトでライブ配信"),
        nar("kochi", "高知", "Q11672545", "高知県競馬組合", "四国", "右", 200.0, "「夜さ来い競馬」のナイター。ハルウララで知られる。",
            "https://www.kochi-keiba.com/", null, "公式サイトでライブ配信"),
        nar("saga", "佐賀", "Q11384877", "佐賀県競馬組合", "九州", "右", 200.0, "九州唯一の競馬場。サマーチャンピオンの舞台。",
            "https://www.sagakeiba.net/", "UCzsYglP_Q86IKATJ0cU-XDw", "sagakeiba official")
    )
}
