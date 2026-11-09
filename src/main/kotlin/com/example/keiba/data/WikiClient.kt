package com.example.keiba.data

import com.example.keiba.model.CourseMedia
import com.example.keiba.model.HorseEntry
import com.example.keiba.model.MediaCredit
import com.example.keiba.model.RaceEntry
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.coroutines.delay
import kotlinx.serialization.json.*
import org.slf4j.LoggerFactory

/**
 * Wikipedia / Wikidata / Wikimedia Commons (すべて無料・API キー不要) からデータを取る。
 * Wikimedia の利用規約に従い、連絡先付きの User-Agent を送り、リクエストは直列で行う。
 */
class WikiClient {
    private val log = LoggerFactory.getLogger(WikiClient::class.java)
    private val ua = "KeibaVision/2.0 (https://github.com/TatsuyaM2667/keiba-predictor)"
    private val api = "https://ja.wikipedia.org/w/api.php"
    private val http = HttpClient(CIO) {
        install(HttpTimeout) { requestTimeoutMillis = 60_000; connectTimeoutMillis = 10_000 }
        defaultRequest { header(HttpHeaders.UserAgent, ua) }
    }

    private suspend fun getJson(url: String, params: Map<String, String> = emptyMap()): JsonObject {
        var lastError: Exception? = null
        repeat(3) { attempt ->
            try {
                val res = http.get(url) { params.forEach { (k, v) -> parameter(k, v) } }
                if (res.status == HttpStatusCode.TooManyRequests || res.status.value >= 500) error("HTTP ${res.status}")
                return Json.parseToJsonElement(res.bodyAsText()).jsonObject
            } catch (e: Exception) {
                lastError = e
                delay(1500L * (attempt + 1))
            }
        }
        throw lastError!!
    }

    private suspend fun embeddedIn(template: String): List<String> {
        val titles = mutableListOf<String>()
        var cont: String? = null
        do {
            val p = mutableMapOf(
                "action" to "query", "list" to "embeddedin", "eititle" to "Template:$template",
                "einamespace" to "0", "eilimit" to "500", "format" to "json", "formatversion" to "2"
            )
            cont?.let { p["eicontinue"] = it }
            val j = getJson(api, p)
            j["query"]!!.jsonObject["embeddedin"]!!.jsonArray.forEach { titles += it.jsonObject["title"]!!.jsonPrimitive.content }
            cont = j["continue"]?.jsonObject?.get("eicontinue")?.jsonPrimitive?.content
        } while (cont != null)
        return titles
    }

    /** 記事の冒頭セクション (インフォボックスを含む) を 50 件ずつ取得 */
    private suspend fun leads(titles: List<String>, onProgress: (Int) -> Unit): Map<String, String> {
        val out = LinkedHashMap<String, String>()
        titles.chunked(50).forEach { batch ->
            val j = getJson(api, mapOf(
                "action" to "query", "prop" to "revisions", "rvprop" to "content", "rvslots" to "main",
                "rvsection" to "0", "titles" to batch.joinToString("|"), "format" to "json", "formatversion" to "2"
            ))
            j["query"]?.jsonObject?.get("pages")?.jsonArray?.forEach { page ->
                val o = page.jsonObject
                val content = o["revisions"]?.jsonArray?.firstOrNull()?.jsonObject
                    ?.get("slots")?.jsonObject?.get("main")?.jsonObject?.get("content")?.jsonPrimitive?.content
                if (content != null) out[o["title"]!!.jsonPrimitive.content] = content
            }
            onProgress(out.size)
            delay(150)
        }
        return out
    }

    suspend fun fetchHorses(onProgress: (String) -> Unit = {}): List<HorseEntry> {
        val titles = embeddedIn("競走馬")
        onProgress("競走馬 ${titles.size} 件の記事を取得中")
        val texts = leads(titles) { onProgress("競走馬 $it / ${titles.size}") }
        return texts.mapNotNull { (t, w) -> runCatching { Wikitext.parseHorse(t, w) }.getOrNull() }
    }

    suspend fun fetchRaces(onProgress: (String) -> Unit = {}): List<RaceEntry> {
        val titles = embeddedIn("競馬の競走")
        val texts = leads(titles) { onProgress("競走 $it / ${titles.size}") }
        return texts.mapNotNull { (t, w) -> runCatching { Wikitext.parseRace(t, w) }.getOrNull() }
    }

    /** Wikidata から競馬場の座標と写真 */
    suspend fun fetchCourseMedia(qids: List<String>): Map<String, CourseMedia> {
        val j = getJson("https://www.wikidata.org/w/api.php", mapOf(
            "action" to "wbgetentities", "ids" to qids.joinToString("|"), "props" to "claims", "format" to "json"
        ))
        return j["entities"]!!.jsonObject.mapValues { (_, e) ->
            val claims = e.jsonObject["claims"]?.jsonObject
            fun value(p: String) = claims?.get(p)?.jsonArray?.firstOrNull()?.jsonObject
                ?.get("mainsnak")?.jsonObject?.get("datavalue")?.jsonObject?.get("value")
            val coord = value("P625")?.jsonObject
            CourseMedia(
                lat = coord?.get("latitude")?.jsonPrimitive?.doubleOrNull,
                lon = coord?.get("longitude")?.jsonPrimitive?.doubleOrNull,
                image = value("P18")?.jsonPrimitive?.contentOrNull?.replace(' ', '_')
            )
        }
    }

    /** 記事の要約文 (REST API) */
    suspend fun summary(title: String): String? = runCatching {
        val j = getJson("https://ja.wikipedia.org/api/rest_v1/page/summary/" + title.replace(' ', '_').encodeURLPathPart())
        j["extract"]?.jsonPrimitive?.contentOrNull
    }.getOrNull()

    /** 写真の作者とライセンス (CC BY-SA などの表示義務を守るため) */
    suspend fun credits(files: List<String>): List<MediaCredit> {
        if (files.isEmpty()) return emptyList()
        val j = getJson(api, mapOf(
            "action" to "query", "prop" to "imageinfo", "iiprop" to "url|extmetadata", "iiurlwidth" to "800",
            "titles" to files.joinToString("|") { "File:$it" }, "format" to "json", "formatversion" to "2"
        ))
        val pages = j["query"]?.jsonObject?.get("pages")?.jsonArray ?: return emptyList()
        return pages.mapNotNull { page ->
            val o = page.jsonObject
            val info = o["imageinfo"]?.jsonArray?.firstOrNull()?.jsonObject ?: return@mapNotNull null
            val meta = info["extmetadata"]?.jsonObject
            fun m(k: String) = meta?.get(k)?.jsonObject?.get("value")?.jsonPrimitive?.contentOrNull ?: ""
            MediaCredit(
                file = o["title"]!!.jsonPrimitive.content.substringAfter(':').replace(' ', '_'),
                thumbUrl = info["thumburl"]?.jsonPrimitive?.contentOrNull,
                pageUrl = info["descriptionurl"]?.jsonPrimitive?.contentOrNull,
                artist = Wikitext.clean(m("Artist")).take(120),
                license = m("LicenseShortName")
            )
        }
    }
}
