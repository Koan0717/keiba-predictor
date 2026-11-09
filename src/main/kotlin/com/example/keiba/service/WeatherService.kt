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

    private val singleCache = java.util.concurrent.ConcurrentHashMap<String, Pair<Long, WeatherInfo>>()

    /** 10 分キャッシュ付き */
    suspend fun getWeatherForRacecourse(racecourseName: String): WeatherInfo {
        singleCache[racecourseName]?.let { (at, w) -> if (System.currentTimeMillis() - at < 10 * 60_000) return w }
        return fetchWeather(racecourseName).also { if (it.isLive) singleCache[racecourseName] = System.currentTimeMillis() to it }
    }

    private suspend fun fetchWeather(racecourseName: String): WeatherInfo = withContext(Dispatchers.IO) {
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
            weatherIcon = "sun",
            windSpeedKmh = 11.2,
            precipitationMm = 0.0,
            trackConditionEstimate = TrackCondition.FIRM,
            isLive = false
        )
    }


    /** 複数地点の現在の天気を 1 回のリクエストで (Open-Meteo は座標をカンマ区切りで複数指定できる) */
    @kotlinx.serialization.Serializable
    data class Current(val id: String, val temperatureC: Double, val description: String, val icon: String,
                       val windKmh: Double, val precipitationMm: Double, val trackCondition: TrackCondition)

    @Volatile private var multiCache: Pair<Long, List<Current>>? = null

    suspend fun currentFor(points: List<Triple<String, Double, Double>>): List<Current> = withContext(Dispatchers.IO) {
        multiCache?.let { (at, v) -> if (System.currentTimeMillis() - at < 10 * 60_000) return@withContext v }
        if (points.isEmpty()) return@withContext emptyList()
        try {
            val url = "https://api.open-meteo.com/v1/forecast?latitude=${points.joinToString(",") { "%.4f".format(java.util.Locale.ROOT, it.second) }}" +
                "&longitude=${points.joinToString(",") { "%.4f".format(java.util.Locale.ROOT, it.third) }}" +
                "&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=Asia%2FTokyo"
            val root = json.parseToJsonElement(client.get(url) { timeout { requestTimeoutMillis = 8000 } }.bodyAsText())
            val arr = if (root is kotlinx.serialization.json.JsonArray) root else kotlinx.serialization.json.JsonArray(listOf(root))
            val result = arr.mapIndexed { i, el ->
                val c = el.jsonObject["current"]!!.jsonObject
                val precip = c["precipitation"]?.jsonPrimitive?.doubleOrNull ?: 0.0
                val (desc, icon, cond) = interpretWeatherCode(c["weather_code"]?.jsonPrimitive?.doubleOrNull?.toInt() ?: 0, precip)
                Current(points[i].first, c["temperature_2m"]?.jsonPrimitive?.doubleOrNull ?: 0.0, desc, icon,
                    c["wind_speed_10m"]?.jsonPrimitive?.doubleOrNull ?: 0.0, precip, cond)
            }
            multiCache = System.currentTimeMillis() to result
            result
        } catch (e: Exception) {
            logger.warn("Open-Meteo (複数地点) の取得に失敗: ${e.message}")
            multiCache?.second ?: emptyList()
        }
    }

    private fun interpretWeatherCode(code: Int, precip: Double): Triple<String, String, TrackCondition> {
        return when (code) {
            0 -> Triple("快晴", "sun", TrackCondition.FIRM)
            1, 2 -> Triple("晴れ", "cloud-sun", TrackCondition.FIRM)
            3 -> Triple("曇り", "cloud", TrackCondition.FIRM)
            45, 48 -> Triple("霧", "cloud-fog", TrackCondition.GOOD)
            51, 53, 55 -> Triple("小雨", "cloud-drizzle", if (precip > 1.5) TrackCondition.YIELDING else TrackCondition.GOOD)
            71, 73, 75, 77, 85, 86 -> Triple("雪", "cloud-snow", TrackCondition.YIELDING)
            61, 63, 65 -> Triple("雨", "cloud-rain", TrackCondition.YIELDING)
            80, 81, 82 -> Triple("強い雨", "cloud-lightning", TrackCondition.SOFT)
            else -> Triple("曇り", "cloud", TrackCondition.FIRM)
        }
    }
}
