package com.example.keiba.service

import com.example.keiba.model.*
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// ==================================================================================
// PredictorEngine — サンプル出馬表から「印」と「買い目」を作る予想ロジック
// ==================================================================================
// 流れ: ペース予想 → 各馬の総合スコア → スコア順に印 (◎◯▲△☆) → 印から買い目
// 各要素の重み (0.35 など) は経験則で決めた値で、統計的に最適化したものではない。
class PredictorEngine {

    // 1 レース分の予想をまとめて作る。RaceService.getRaceAnalysis() から呼ばれる。
    fun analyzeRace(race: Race): RaceAnalysis {
        val paceForecast = analyzePace(race.horses)
        val paceComment = when (paceForecast) {
            "ハイペース" -> "逃げ馬が多く前が激化する展開。直線での差し・追込馬の台頭に警戒が必要です。"
            "スローペース" -> "逃げ馬が単騎で楽に行けそうな流れ。前残りの展開が濃厚で先行勢が有利です。"
            else -> "平均的な淀みのない流れ。各馬の実力とコース適性が素直に反映されやすい展開です。"
        }

        // 各馬のスコアリング
        val rawScores = race.horses.map { horse ->
            calculateHorseScore(horse, race, paceForecast)
        }

        // スコア順にソート
        val sortedScores = rawScores.sortedByDescending { it.totalScore }

        // 印 (◎, ◯, ▲, △, ☆) の割り当て
        // ☆ (大穴) はオッズ8倍以上で期待値スコアが高い馬から選出
        var assignedAna = false
        val predictions = sortedScores.mapIndexed { index, score ->
            val mark = when {
                index == 0 -> "◎"
                index == 1 -> "◯"
                index == 2 -> "▲"
                index in 3..4 -> "△"
                !assignedAna && score.expectedValueScore >= 75.0 && race.horses.first { it.horseNumber == score.horseNumber }.odds >= 8.0 -> {
                    assignedAna = true
                    "☆"
                }
                index == 5 && !assignedAna -> {
                    assignedAna = true
                    "☆"
                }
                else -> ""
            }
            score.copy(mark = mark)
        }

        // 推奨買い目の生成
        val recommendations = generateBetRecommendations(race, predictions)

        return RaceAnalysis(
            race = race,
            predictions = predictions,
            betRecommendations = recommendations,
            paceForecast = paceForecast,
            paceComment = paceComment
        )
    }

    // 逃げ・先行の頭数からペースを予想する。
    // 逃げ馬が 2 頭以上いると先頭争いで速くなる (ハイ)、逃げ馬がいない/少ないと遅くなる (スロー)。
    private fun analyzePace(horses: List<Horse>): String {
        val nigeCount = horses.count { it.runningStyle == RunningStyle.NIGE }
        val senkoCount = horses.count { it.runningStyle == RunningStyle.SENKO }

        return when {
            nigeCount >= 2 || (nigeCount == 1 && senkoCount >= 5) -> "ハイペース"
            nigeCount == 0 || (nigeCount == 1 && senkoCount <= 2) -> "スローペース"
            else -> "ミドルペース"
        }
    }

    // 1 頭の総合スコア (15〜99.5) と、勝率・複勝率・期待値の目安を計算する。
    // すべての要素を 0〜100 の点数に揃えてから、重みを掛けて足し合わせる (加重平均)。
    private fun calculateHorseScore(horse: Horse, race: Race, paceForecast: String): PredictionScore {
        // 1. スピードスコア (60-120 -> 0-100に正規化)
        val speedScore = ((horse.speedIndex - 60.0) / 60.0 * 100.0).coerceIn(10.0, 98.0)

        // 2. 展開適合度 (Pace Advantage)
        val paceAdvantage = when (paceForecast) {
            "ハイペース" -> when (horse.runningStyle) {
                RunningStyle.SASHI -> 92.0
                RunningStyle.OIKOMI -> 88.0
                RunningStyle.SENKO -> 65.0
                RunningStyle.NIGE -> 48.0
            }
            "スローペース" -> when (horse.runningStyle) {
                RunningStyle.NIGE -> 95.0
                RunningStyle.SENKO -> 88.0
                RunningStyle.SASHI -> 62.0
                RunningStyle.OIKOMI -> 45.0
            }
            else -> when (horse.runningStyle) { // ミドルペース
                RunningStyle.SENKO -> 88.0
                RunningStyle.SASHI -> 86.0
                RunningStyle.NIGE -> 75.0
                RunningStyle.OIKOMI -> 70.0
            }
        }

        // 3. 血統・距離適性 (コース距離・馬場と血統の相性)
        var pedigreeScore = 75.0
        val sireLower = horse.sire.lowercase()
        if (sireLower.contains("キタサンブラック") || sireLower.contains("ディープインパクト") || sireLower.contains("ハーツクライ")) {
            pedigreeScore += 15.0
        } else if (sireLower.contains("エピファネイア") || sireLower.contains("ドゥラメンテ") || sireLower.contains("ロードカナロア")) {
            pedigreeScore += 12.0
        } else if (sireLower.contains("ゴールドシップ") || sireLower.contains("オルフェーヴル")) {
            if (race.condition != TrackCondition.FIRM) pedigreeScore += 18.0 else pedigreeScore += 8.0
        }

        // 4. 騎手相性スコア
        val jockeyScore = (horse.jockeyWinRate * 400.0).coerceIn(40.0, 98.0)

        // 5. 馬場状態適性 (Track Condition)
        var conditionScore = 80.0
        when (race.condition) {
            TrackCondition.FIRM -> conditionScore = 85.0
            TrackCondition.GOOD -> conditionScore = 82.0
            TrackCondition.YIELDING, TrackCondition.SOFT -> {
                // 重馬場時はパワー系・大型馬有利
                if (horse.horseWeight >= 490) conditionScore += 10.0
                else conditionScore -= 8.0
            }
        }

        // 枠順補正 (中山などの内枠有利コース)
        var postBias = 0.0
        if (race.distanceMeters >= 2000) {
            if (horse.postPosition in 1..3) postBias += 4.0
            if (horse.postPosition in 7..8) postBias -= 3.0
        }

        // 調教スコア
        val trainingBonus = when (horse.trainingScore) {
            "S" -> 10.0
            "A+" -> 7.0
            "A" -> 5.0
            "B" -> 0.0
            else -> -5.0
        }

        // 複合加重平均 (Total Score)
        val weightedTotal = (
            speedScore * 0.35 +
            paceAdvantage * 0.20 +
            pedigreeScore * 0.15 +
            jockeyScore * 0.15 +
            conditionScore * 0.10 +
            postBias +
            trainingBonus
        ).coerceIn(15.0, 99.5)

        // 勝率・複勝率シミュレーション
        val winProbability = (weightedTotal / 100.0 * (1.0 / horse.odds * 2.8) * 100.0).coerceIn(2.0, 68.0)
        val placeProbability = (winProbability * 2.4).coerceIn(8.0, 92.0)

        // オッズ妙味度 (Expected Value Index) = (AI勝率 * オッズ) を基準とした指標
        val evRatio = (winProbability / 100.0) * horse.odds
        val expectedValueScore = (evRatio * 75.0).coerceIn(30.0, 99.0)

        // AI寸評
        val comment = generateComment(horse, paceAdvantage, pedigreeScore, horse.trainingScore)

        return PredictionScore(
            horseNumber = horse.horseNumber,
            horseName = horse.name,
            mark = "",
            totalScore = (weightedTotal * 10).roundToInt() / 10.0,
            speedScore = (speedScore * 10).roundToInt() / 10.0,
            paceAdvantage = (paceAdvantage * 10).roundToInt() / 10.0,
            pedigreeScore = (pedigreeScore * 10).roundToInt() / 10.0,
            jockeyScore = (jockeyScore * 10).roundToInt() / 10.0,
            conditionScore = (conditionScore * 10).roundToInt() / 10.0,
            winProbability = (winProbability * 10).roundToInt() / 10.0,
            placeProbability = (placeProbability * 10).roundToInt() / 10.0,
            expectedValueScore = (expectedValueScore * 10).roundToInt() / 10.0,
            comments = comment
        )
    }

    // 条件に当てはまる短評を並べて 1 文にする。
    private fun generateComment(horse: Horse, paceScore: Double, pedigreeScore: Double, training: String): String {
        val parts = mutableListOf<String>()
        if (training == "S" || training == "A+") {
            parts.add("調教の動きは絶好調")
        }
        if (paceScore >= 85.0) {
            parts.add("今回のペース展開にベストマッチ")
        }
        if (pedigreeScore >= 88.0) {
            parts.add("血統的コース適性は最上位")
        }
        if (horse.recentRank == 1) {
            parts.add("前走快勝の勢い持続")
        } else if (horse.recentRank <= 3) {
            parts.add("近走安定した末脚を発揮")
        }

        return if (parts.isEmpty()) {
            "展開ひとつで上位進出のチャンス十分。"
        } else {
            parts.joinToString("、") + "。"
        }
    }

    // 印の付いた馬から 4 種類の買い目を作る。allocationPercent は予算の配分 (合計 100%)。
    // 想定オッズは単勝オッズからの大まかな見積もりで、実際の配当とは異なる。
    private fun generateBetRecommendations(race: Race, predictions: List<PredictionScore>): List<BetRecommendation> {
        val honmei = predictions.firstOrNull { it.mark == "◎" } ?: predictions[0]
        val taiko = predictions.firstOrNull { it.mark == "◯" } ?: predictions.getOrNull(1)
        val tanana = predictions.firstOrNull { it.mark == "▲" } ?: predictions.getOrNull(2)
        val ana = predictions.firstOrNull { it.mark == "☆" }

        val list = mutableListOf<BetRecommendation>()

        // 1. 単勝
        val honmeiHorse = race.horses.first { it.horseNumber == honmei.horseNumber }
        list.add(
            BetRecommendation(
                betType = "単勝",
                combination = "${honmei.horseNumber} (${honmei.horseName})",
                oddsEstimate = honmeiHorse.odds,
                confidence = if (honmei.totalScore >= 88.0) "S" else "A",
                allocationPercent = 35,
                reason = "総合スコア1位。指数・展開ともに抜けており最も信頼度が高い本命馬。"
            )
        )

        // 2. 馬連 (◎ - ◯, ▲)
        if (taiko != null) {
            val taikoHorse = race.horses.first { it.horseNumber == taiko.horseNumber }
            val estimatedUmarenOdds = ((honmeiHorse.odds * taikoHorse.odds) / 2.2).coerceAtLeast(4.0)
            list.add(
                BetRecommendation(
                    betType = "馬連",
                    combination = "${honmei.horseNumber} - ${taiko.horseNumber}",
                    oddsEstimate = (estimatedUmarenOdds * 10).roundToInt() / 10.0,
                    confidence = "A",
                    allocationPercent = 30,
                    reason = "本命と対抗の実力上位2頭による堅実かつ期待値の高い組み合わせ。"
                )
            )
        }

        // 3. ワイド or 3連複
        if (taiko != null && tanana != null) {
            list.add(
                BetRecommendation(
                    betType = "3連複",
                    combination = "${honmei.horseNumber} = ${taiko.horseNumber} = ${tanana.horseNumber}" + (if (ana != null) ", ${ana.horseNumber}" else ""),
                    oddsEstimate = 24.5,
                    confidence = "B",
                    allocationPercent = 25,
                    reason = "上位印を中心にフォーメーション。3着穴馬の台頭まで手広くカバー。"
                )
            )
        }

        // 4. 穴狙い (ワイド ◎ - ☆)
        if (ana != null) {
            val anaHorse = race.horses.first { it.horseNumber == ana.horseNumber }
            list.add(
                BetRecommendation(
                    betType = "ワイド",
                    combination = "${honmei.horseNumber} - ${ana.horseNumber}",
                    oddsEstimate = (anaHorse.odds * 1.8).coerceAtLeast(6.5),
                    confidence = "B+",
                    allocationPercent = 10,
                    reason = "オッズに対して評価が高い☆の馬を相手に。"
                )
            )
        }

        return list
    }
}
