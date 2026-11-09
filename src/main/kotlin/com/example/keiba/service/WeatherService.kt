package com.example.keiba.service

import com.example.keiba.model.TrackCondition
import com.example.keiba.model.WeatherInfo
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import org.slf4j.LoggerFactory

class WeatherService {
    private val logger = LoggerFactory.getLogger(WeatherService::class.java)
    private val client = HttpClient(CIO) {
        install(HttpTimeout) {
            requestTimeoutMillis = 4000
            connectTimeoutMillis = 3000
        }
    }

    private val json = Json { ignoreUnknownKeys = true }

    // 主要競馬場の座標 (緯度, 経度)
    private val racecourseCoordinates = mapOf(
        "中山" to Pair(35.7264, 139.9603),
        "東京" to Pair(35.6628, 139.4839),
        "京都" to Pair(34.9078, 135.7236),
        "阪神" to Pair(34.7801, 135.3601),
        "中京" to Pair(35.0664, 136.9897),
        "新潟" to Pair(37.9547, 139.1764),
        "札幌" to Pair(43.0722, 141.3253),
        "函館" to Pair(41.7778, 140.7672),
        "福島" to Pair(37.7656, 140.4853),
        "小倉" to Pair(33.8436, 130.8753)
    )

    suspend fun getWeatherForRacecourse(racecourseName: String): WeatherInfo = withContext(Dispatchers.IO) {
        val coords = racecourseCoordinates[racecourseName] ?: Pair(35.7264, 139.9603)
        try {
            val url = "https://api.open-meteo.com/v1/forecast?latitude=${coords.first}&longitude=${coords.second}&current=temperature_2m,precipitation,weather_code,wind_speed_10m"
            val response: HttpResponse = client.get(url)
            val body = response.bodyAsText()
            val parsed = json.parseToJsonElement(body).jsonObject
            val current = parsed["current"]?.jsonObject

            if (current != null) {
                val temp = current["temperature_2m"]?.jsonPrimitive?.doubleOrNull ?: 18.5
                val precip = current["precipitation"]?.jsonPrimitive?.doubleOrNull ?: 0.0
                val weatherCode = current["weather_code"]?.jsonPrimitive?.doubleOrNull?.toInt() ?: 0
                val windSpeed = current["wind_speed_10m"]?.jsonPrimitive?.doubleOrNull ?: 10.0

                val (desc, icon, cond) = interpretWeatherCode(weatherCode, precip)

                return@withContext WeatherInfo(
                    location = "${racecourseName}競馬場",
                    temperatureC = temp,
                    weatherDescription = desc,
                    weatherIcon = icon,
                    windSpeedKmh = windSpeed,
                    precipitationMm = precip,
                    trackConditionEstimate = cond,
                    isLive = true
                )
            }
        } catch (e: Exception) {
            logger.warn("Open-Meteo気象APIの取得に失敗 (ローカル推計を使用します): ${e.message}")
        }

        // フォールバック（標準気象データ）
        return@withContext WeatherInfo(
            location = "${racecourseName}競馬場 (推定)",
            temperatureC = 17.5,
            weatherDescription = "晴れ時々曇り",
            weatherIcon = "☀️",
            windSpeedKmh = 11.2,
            precipitationMm = 0.0,
            trackConditionEstimate = TrackCondition.FIRM,
            isLive = false
        )
    }

    private fun interpretWeatherCode(code: Int, precip: Double): Triple<String, String, TrackCondition> {
        return when (code) {
            0 -> Triple("快晴", "☀️", TrackCondition.FIRM)
            1, 2 -> Triple("晴れ・薄曇り", "⛅", TrackCondition.FIRM)
            3 -> Triple("曇り", "☁️", TrackCondition.FIRM)
            45, 48 -> Triple("霧", "🌫️", TrackCondition.GOOD)
            51, 53, 55 -> Triple("小雨", "🌦️", if (precip > 1.5) TrackCondition.YIELDING else TrackCondition.GOOD)
            61, 63, 65 -> Triple("雨", "🌧️", TrackCondition.YIELDING)
            80, 81, 82 -> Triple("強い雨", "⛈️", TrackCondition.SOFT)
            else -> Triple("曇り", "⛅", TrackCondition.FIRM)
        }
    }
}
