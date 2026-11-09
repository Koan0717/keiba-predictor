package com.example.keiba.data

import com.example.keiba.model.Horse
import com.example.keiba.model.RunningStyle

class DataLoader {
    fun loadHorsesFromCsv(): List<Horse> {
        val stream = javaClass.getResourceAsStream("/horses.csv") ?: return emptyList()

        return stream.bufferedReader().useLines { lines ->
            lines.drop(1)
                .filter { it.isNotBlank() }
                .mapIndexed { index, line ->
                    val parts = line.split(",")
                    val horseNum = index + 1
                    val postPos = ((horseNum - 1) % 8) + 1
                    Horse(
                        horseNumber = horseNum,
                        postPosition = postPos,
                        name = parts[0],
                        sexAge = "牡4",
                        weightCarry = 58.0,
                        jockey = parts.getOrNull(2) ?: "騎手",
                        trainer = "厩舎",
                        odds = parts.getOrNull(1)?.toDoubleOrNull() ?: 5.0,
                        popularity = index + 1,
                        recentRank = parts.getOrNull(3)?.toIntOrNull() ?: 2,
                        speedIndex = 110.0 - (index * 2),
                        runningStyle = if (index % 2 == 0) RunningStyle.SENKO else RunningStyle.SASHI,
                        sire = "ディープインパクト",
                        damSire = "キングカメハメハ",
                        horseWeight = 490,
                        weightDiff = 0,
                        jockeyWinRate = 0.18,
                        trainingScore = "A"
                    )
                }
                .toList()
        }
    }
}
