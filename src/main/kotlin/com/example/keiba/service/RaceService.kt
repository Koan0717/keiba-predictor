package com.example.keiba.service

import com.example.keiba.model.*
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import org.slf4j.LoggerFactory

class RaceService(
    private val weatherService: WeatherService = WeatherService(),
    private val predictorEngine: PredictorEngine = PredictorEngine()
) {
    private val logger = LoggerFactory.getLogger(RaceService::class.java)

    // レースマスターデータ
    private val races = mutableMapOf<String, Race>()

    init {
        initSampleRaces()
    }

    private fun initSampleRaces() {
        // 1. 有馬記念 (G1) - 中山芝2500m
        val arimaHorses = listOf(
            Horse(1, 1, "ドウデュース", "牡5", 58.0, "武豊", "友道康夫", 2.3, 1, 1, 118.5, RunningStyle.SASHI, "ハーツクライ", "Vindication", 508, 2, 0.178, "S"),
            Horse(2, 1, "スターズオンアース", "牝5", 56.0, "川田将雅", "高柳瑞樹", 5.4, 2, 2, 114.2, RunningStyle.SENKO, "ドゥラメンテ", "Smart Strike", 496, 0, 0.264, "A+"),
            Horse(3, 2, "ソールオリエンス", "牡4", 58.0, "横山武史", "手塚貴久", 8.9, 4, 3, 110.8, RunningStyle.OIKOMI, "キタサンブラック", "Motivator", 472, -2, 0.145, "A"),
            Horse(4, 2, "タスティエーラ", "牡4", 58.0, "松山弘平", "堀宣行", 12.3, 6, 2, 109.5, RunningStyle.SENKO, "サトノクラウン", "マンハッタンカフェ", 502, 4, 0.138, "A"),
            Horse(5, 3, "レガレイラ", "牝3", 54.0, "ルメール", "木村哲也", 4.1, 3, 1, 116.0, RunningStyle.SASHI, "スワーヴリチャード", "ハービンジャー", 468, 2, 0.285, "S"),
            Horse(6, 3, "ブローザホーン", "牡5", 58.0, "菅原明良", "吉岡辰弥", 9.8, 5, 1, 113.4, RunningStyle.SASHI, "エピファネイア", "デュランダル", 432, 0, 0.112, "A"),
            Horse(7, 4, "ジャスティンパレス", "牡5", 58.0, "坂井瑠星", "杉山晴紀", 14.2, 7, 4, 108.9, RunningStyle.SASHI, "ディープインパクト", "Royal Anthem", 474, -4, 0.162, "A"),
            Horse(8, 4, "シンエンペラー", "牡3", 56.0, "坂井瑠星", "矢作芳人", 15.6, 8, 3, 107.5, RunningStyle.SENKO, "Siyouni", "Galileo", 488, 2, 0.162, "B"),
            Horse(9, 5, "ベラジオオペラ", "牡4", 58.0, "横山和生", "上村洋行", 16.8, 9, 1, 108.0, RunningStyle.SENKO, "ロードカナロア", "ハービンジャー", 512, 6, 0.125, "B"),
            Horse(10, 5, "プラダリア", "牡5", 58.0, "池添謙一", "池添学", 34.5, 11, 4, 103.2, RunningStyle.SENKO, "ディープインパクト", "クロフネ", 476, 2, 0.105, "B"),
            Horse(11, 6, "シャフリヤール", "牡6", 58.0, "C.デムーロ", "藤原英昭", 22.4, 10, 3, 105.8, RunningStyle.SASHI, "ディープインパクト", "Essence of Dubai", 460, -2, 0.210, "A"),
            Horse(12, 6, "ディープボンド", "牡7", 58.0, "幸英明", "大久保龍", 48.0, 13, 6, 101.5, RunningStyle.SENKO, "キズナ", "キングヘイロー", 516, 4, 0.088, "B"),
            Horse(13, 7, "スタニングローズ", "牝5", 56.0, "C.デムーロ", "高野友和", 38.2, 12, 1, 104.2, RunningStyle.SENKO, "キングカメハメハ", "クロフネ", 492, 0, 0.210, "A"),
            Horse(14, 7, "ダノンデサイル", "牡3", 56.0, "横山典弘", "安田翔伍", 18.2, 8, 1, 109.8, RunningStyle.SENKO, "エピファネイア", "Congrats", 510, 2, 0.130, "A+"),
            Horse(15, 8, "タイトルホルダー", "牡6", 58.0, "横山和生", "栗田徹", 19.5, 9, 3, 107.0, RunningStyle.NIGE, "ドゥラメンテ", "サドラーズウェルズ", 478, -2, 0.125, "A"),
            Horse(16, 8, "アーバンシック", "牡3", 56.0, "ルメール", "武井亮", 7.5, 4, 1, 115.2, RunningStyle.OIKOMI, "スワーヴリチャード", "ハービンジャー", 518, 4, 0.285, "S")
        )

        races["arima-2026"] = Race(
            id = "arima-2026",
            name = "有馬記念 (グランプリ)",
            subtitle = "第69回 暮れの大一番・ドリームレース",
            raceNumber = 11,
            racecourse = "中山",
            courseType = CourseType.TURF,
            distanceMeters = 2500,
            turnDirection = "右回り・内コース",
            condition = TrackCondition.FIRM,
            grade = "G1",
            postTime = "15:25",
            prizeFirstYen = 500000000L,
            horses = arimaHorses
        )

        // 2. 日本ダービー (G1) - 東京芝2400m
        val derbyHorses = listOf(
            Horse(1, 1, "ダノンデサイル", "牡3", 57.0, "横山典弘", "安田翔伍", 4.2, 2, 1, 115.8, RunningStyle.SENKO, "エピファネイア", "Congrats", 508, 2, 0.130, "S"),
            Horse(2, 1, "ジャスティンミラノ", "牡3", 57.0, "戸崎圭太", "友道康夫", 2.1, 1, 2, 117.5, RunningStyle.SENKO, "キズナ", "Exceed And Excel", 512, 0, 0.195, "S"),
            Horse(3, 2, "シンエンペラー", "牡3", 57.0, "坂井瑠星", "矢作芳人", 8.4, 4, 3, 112.4, RunningStyle.SENKO, "Siyouni", "Galileo", 488, 0, 0.162, "A"),
            Horse(4, 2, "アーバンシック", "牡3", 57.0, "横山武史", "武井亮", 9.6, 5, 4, 111.0, RunningStyle.OIKOMI, "スワーヴリチャード", "ハービンジャー", 514, 2, 0.145, "A"),
            Horse(5, 3, "レガレイラ", "牝3", 55.0, "ルメール", "木村哲也", 3.8, 3, 5, 114.6, RunningStyle.SASHI, "スワーヴリチャード", "ハービンジャー", 466, -2, 0.285, "A+"),
            Horse(6, 3, "コスモキュランダ", "牡3", 57.0, "M.デムーロ", "加藤士津八", 14.5, 6, 6, 108.9, RunningStyle.SENKO, "アルアイン", "Southern Halo", 500, 4, 0.140, "B"),
            Horse(7, 4, "シックスペンス", "牡3", 57.0, "国分恭介", "国枝栄", 18.0, 7, 9, 106.5, RunningStyle.SENKO, "キズナ", "Twirling Candy", 492, -4, 0.082, "B"),
            Horse(8, 4, "シュガークン", "牡3", 57.0, "武豊", "清水久詞", 24.0, 8, 7, 105.0, RunningStyle.NIGE, "ドゥラメンテ", "サクラバクシンオー", 504, 2, 0.178, "B")
        )

        races["derby-2026"] = Race(
            id = "derby-2026",
            name = "東京優駿 (日本ダービー)",
            subtitle = "第92回 競馬の祭典・世代頂点決定戦",
            raceNumber = 11,
            racecourse = "東京",
            courseType = CourseType.TURF,
            distanceMeters = 2400,
            turnDirection = "左回り",
            condition = TrackCondition.FIRM,
            grade = "G1",
            postTime = "15:40",
            prizeFirstYen = 300000000L,
            horses = derbyHorses
        )

        // 3. ジャパンカップ (G1) - 東京芝2400m
        val jcHorses = listOf(
            Horse(1, 1, "ドウデュース", "牡5", 58.0, "武豊", "友道康夫", 2.1, 1, 1, 119.2, RunningStyle.SASHI, "ハーツクライ", "Vindication", 506, 0, 0.178, "S"),
            Horse(2, 1, "オーギュストロダン", "牡4", 58.0, "R.ムーア", "A.オブライエン", 4.5, 2, 2, 117.0, RunningStyle.SENKO, "ディープインパクト", "Rhododendron", 470, -2, 0.290, "S"),
            Horse(3, 2, "チェルヴィニア", "牝3", 54.0, "ルメール", "木村哲也", 5.2, 3, 1, 116.5, RunningStyle.SASHI, "ハービンジャー", "キングカメハメハ", 482, 2, 0.285, "A+"),
            Horse(4, 2, "スターズオンアース", "牝5", 56.0, "川田将雅", "高柳瑞樹", 7.8, 4, 3, 113.8, RunningStyle.SENKO, "ドゥラメンテ", "Smart Strike", 498, 4, 0.264, "A"),
            Horse(5, 3, "シンエンペラー", "牡3", 56.0, "坂井瑠星", "矢作芳人", 12.0, 5, 3, 110.2, RunningStyle.SENKO, "Siyouni", "Galileo", 490, 2, 0.162, "B"),
            Horse(6, 3, "ソールオリエンス", "牡4", 58.0, "横山武史", "手塚貴久", 15.4, 6, 7, 109.0, RunningStyle.OIKOMI, "キタサンブラック", "Motivator", 474, 0, 0.145, "A"),
            Horse(7, 4, "ジャスティンパレス", "牡5", 58.0, "C.デムーロ", "杉山晴紀", 18.2, 7, 4, 108.5, RunningStyle.SASHI, "ディープインパクト", "Royal Anthem", 472, -2, 0.210, "B"),
            Horse(8, 4, "ゴリアット", "セン4", 58.0, "C.スミヨン", "F.グラファール", 11.5, 5, 1, 112.0, RunningStyle.SENKO, "Adlerflug", "Shamardal", 494, 0, 0.220, "A")
        )

        races["jc-2026"] = Race(
            id = "jc-2026",
            name = "ジャパンカップ (国際G1)",
            subtitle = "第45回 世界の頂点を競う最高峰バトル",
            raceNumber = 12,
            racecourse = "東京",
            courseType = CourseType.TURF,
            distanceMeters = 2400,
            turnDirection = "左回り",
            condition = TrackCondition.FIRM,
            grade = "G1",
            postTime = "15:40",
            prizeFirstYen = 500000000L,
            horses = jcHorses
        )
    }

    suspend fun getAllRacesSummary(): List<Race> = coroutineScope {
        races.values.map { race ->
            val weatherDeferred = async { weatherService.getWeatherForRacecourse(race.racecourse) }
            race.copy(weather = weatherDeferred.await())
        }
    }

    suspend fun getRaceAnalysis(raceId: String): RaceAnalysis? = coroutineScope {
        val baseRace = races[raceId] ?: return@coroutineScope null
        val weather = weatherService.getWeatherForRacecourse(baseRace.racecourse)
        val raceWithWeather = baseRace.copy(
            weather = weather,
            condition = weather.trackConditionEstimate
        )
        predictorEngine.analyzeRace(raceWithWeather)
    }

    fun getRaceById(raceId: String): Race? = races[raceId]
}
