package com.example.keiba.logic

import com.example.keiba.model.Horse
import com.example.keiba.service.PredictorEngine

// 旧版の名残で、現在どこからも使われていない (予想は service/PredictorEngine.kt が担当)。
class Predictor {
    private val engine = PredictorEngine()

    fun calculateScore(horse: Horse): Double {
        return horse.speedIndex + (100.0 / horse.odds)
    }

    fun predictRanking(horses: List<Horse>): List<Horse> {
        return horses.sortedByDescending { calculateScore(it) }
    }
}
