package com.example.keiba.logic

import com.example.keiba.model.Horse
import com.example.keiba.service.PredictorEngine

class Predictor {
    private val engine = PredictorEngine()

    fun calculateScore(horse: Horse): Double {
        return horse.speedIndex + (100.0 / horse.odds)
    }

    fun predictRanking(horses: List<Horse>): List<Horse> {
        return horses.sortedByDescending { calculateScore(it) }
    }
}
