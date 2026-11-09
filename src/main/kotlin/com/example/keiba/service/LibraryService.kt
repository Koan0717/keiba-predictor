package com.example.keiba.service

import com.example.keiba.data.CourseCatalog
import com.example.keiba.data.WikiClient
import com.example.keiba.model.*
import kotlinx.coroutines.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.io.File
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream
import kotlin.math.log10
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/** 名鑑で返す 1 頭分 (元データ + 戦績から計算した参考値) */
@Serializable
data class HorseView(
    val horse: HorseEntry,
    val rating: Int,          // 戦績から算出した参考能力値 (40〜99)
    val surface: String,      // 芝 / ダート / 芝・ダート / 不明 (勝った重賞の馬場から推定)
    val bestDistance: Int?,   // 勝った重賞の平均距離
    val gradedWins: Int
)

@Serializable
data class HorsePage(val total: Int, val items: List<HorseView>)

@Serializable
data class RacePage(val total: Int, val items: List<RaceEntry>)

@Serializable
data class LibraryStatus(
    val generatedAt: String,
    val horses: Int,
    val horsesWithPhoto: Int,
    val races: Int,
    val courses: Int,
    val syncing: Boolean,
    val progress: String
)

class LibraryService(private val wiki: WikiClient = WikiClient()) {
    private val log = LoggerFactory.getLogger(LibraryService::class.java)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = false }
    private val cacheFile = File(System.getProperty("user.home"), ".cache/keiba-vision/library.json.gz")
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Volatile private var snapshot: LibrarySnapshot = load()
    @Volatile private var views: List<HorseView> = buildViews(snapshot)
    @Volatile private var byTitle: Map<String, HorseView> = views.associateBy { it.horse.title }
    @Volatile var syncing = false; private set
    @Volatile var progress = ""; private set
    private val summaries = ConcurrentHashMap<String, String>()
    private val credits = ConcurrentHashMap<String, MediaCredit>()

    private fun load(): LibrarySnapshot {
        val sources = listOfNotNull(
            cacheFile.takeIf { it.isFile }?.let { { it.inputStream() } },
            javaClass.getResource("/data/library.json.gz")?.let { url -> { url.openStream() } }
        )
        for (open in sources) {
            runCatching { GZIPInputStream(open()).bufferedReader().use { json.decodeFromString<LibrarySnapshot>(it.readText()) } }
                .onSuccess { return it }
                .onFailure { log.warn("ライブラリの読み込みに失敗: ${it.message}") }
        }
        return LibrarySnapshot(generatedAt = "", horses = emptyList(), races = emptyList())
    }

    /** 1 週間より古ければバックグラウンドで最新化 */
    fun refreshIfStale() {
        val age = runCatching { Duration.between(Instant.parse(snapshot.generatedAt), Instant.now()) }.getOrNull()
        if (age == null || age > Duration.ofDays(7)) refresh()
    }

    fun refresh(writeTo: File = cacheFile): Job? {
        if (syncing) return null
        syncing = true
        return scope.launch {
            try {
                val next = sync()
                writeTo.parentFile?.mkdirs()
                GZIPOutputStream(writeTo.outputStream()).bufferedWriter().use { it.write(json.encodeToString(LibrarySnapshot.serializer(), next)) }
                install(next)
                log.info("ライブラリ更新: 競走馬 ${next.horses.size} / 競走 ${next.races.size}")
            } catch (e: Exception) {
                log.warn("ライブラリ更新に失敗 (手元のデータを使い続けます): ${e.message}")
                progress = "更新に失敗しました: ${e.message}"
            } finally {
                syncing = false
            }
        }
    }

    private suspend fun sync(): LibrarySnapshot {
        progress = "競馬場の情報を取得中"
        val media = wiki.fetchCourseMedia(CourseCatalog.all.map { it.qid })
        val races = wiki.fetchRaces { progress = it }
        val horses = wiki.fetchHorses { progress = it }
        progress = "完了"
        return LibrarySnapshot(Instant.now().toString(), horses.sortedBy { it.title }, races.sortedBy { it.title }, media)
    }

    private fun install(s: LibrarySnapshot) {
        snapshot = s
        views = buildViews(s)
        byTitle = views.associateBy { it.horse.title }
    }

    private fun buildViews(s: LibrarySnapshot): List<HorseView> {
        val raceByName = HashMap<String, RaceEntry>()
        s.races.forEach { r -> raceByName.putIfAbsent(r.name, r); raceByName.putIfAbsent(r.title, r) }
        return s.horses.map { h ->
            val won = h.bigWins.mapNotNull { raceByName[it.race] ?: raceByName[it.race.substringBefore(" (")] }
            val turf = won.count { it.surface.contains("芝") }
            val dirt = won.count { it.surface.contains("ダート") }
            val surface = when {
                turf > 0 && dirt > 0 -> "芝・ダート"
                turf > 0 -> "芝"
                dirt > 0 -> "ダート"
                else -> "不明"
            }
            val dists = won.mapNotNull { it.distance }
            HorseView(h, 0, surface, dists.takeIf { it.isNotEmpty() }?.average()?.roundToInt(), h.bigWins.size)
        }.let(::withPercentileRating)
    }

    /** 素点の順位 (パーセンタイル) で 45〜99 に配る。上位ほど間隔が詰まり 99 はごく一部になる */
    private fun withPercentileRating(list: List<HorseView>): List<HorseView> {
        if (list.isEmpty()) return list
        val raw = list.map { rawScore(it.horse) }
        val order = raw.indices.sortedBy { raw[it] }
        val rating = IntArray(list.size)
        order.forEachIndexed { rank, i ->
            val p = if (list.size == 1) 1.0 else rank.toDouble() / (list.size - 1)
            rating[i] = (45 + 54 * p * p).roundToInt()
        }
        return list.mapIndexed { i, v -> v.copy(rating = rating[i]) }
    }

    /** 戦績 (勝率・G1 勝ち数・獲得賞金) から作る素点。実力を正確に表すものではない */
    private fun rawScore(h: HorseEntry): Double {
        val starts = h.starts ?: 0
        val winRate = if (starts > 0) (h.wins ?: 0).toDouble() / starts else 0.25
        val top = h.bigWins.count { it.grade.endsWith("I") && !it.grade.endsWith("II") }
        val graded = h.bigWins.size
        val money = h.earningsManYen?.let { min(log10(1.0 + it) * 3.0, 15.0) } ?: 6.0
        return 18 * sqrt(winRate) + min(top, 9) * 3.0 + min(graded, 15) * 0.6 + money
    }

    fun status() = LibraryStatus(
        snapshot.generatedAt, snapshot.horses.size, snapshot.horses.count { it.image != null },
        snapshot.races.size, CourseCatalog.all.size, syncing, progress
    )

    fun searchHorses(q: String, sort: String, photoOnly: Boolean, sex: String, surface: String, offset: Int, limit: Int): HorsePage {
        val needle = q.trim().lowercase()
        var list = views.asSequence()
        if (needle.isNotEmpty()) list = list.filter { v ->
            val h = v.horse
            h.name.lowercase().contains(needle) || h.nameEn.lowercase().contains(needle) ||
                h.sire.contains(needle) || h.dam.contains(needle) || h.bigWins.any { it.race.contains(needle) }
        }
        if (photoOnly) list = list.filter { it.horse.image != null }
        if (sex.isNotBlank()) list = list.filter { it.horse.sex.startsWith(sex) }
        if (surface.isNotBlank()) list = list.filter { it.surface.contains(surface) }
        val sorted = when (sort) {
            "name" -> list.sortedBy { it.horse.name }
            "new" -> list.sortedByDescending { it.horse.birthYear ?: 0 }
            "old" -> list.sortedBy { it.horse.birthYear ?: 9999 }
            "wins" -> list.sortedByDescending { it.gradedWins }
            else -> list.sortedWith(compareByDescending<HorseView> { it.rating }.thenByDescending { it.gradedWins })
        }.toList()
        return HorsePage(sorted.size, sorted.drop(offset).take(limit.coerceIn(1, 200)))
    }

    fun horse(title: String) = byTitle[title]

    suspend fun summary(title: String): String? =
        summaries[title] ?: wiki.summary(title)?.also { summaries[title] = it }

    fun searchRaces(q: String, course: String, grade: String, surface: String, offset: Int, limit: Int): RacePage {
        val needle = q.trim()
        val list = snapshot.races.filter { r ->
            (needle.isEmpty() || r.name.contains(needle) || r.title.contains(needle)) &&
                (course.isEmpty() || r.course.contains(course)) &&
                (grade.isEmpty() || r.grade == grade) &&
                (surface.isEmpty() || r.surface.contains(surface))
        }.sortedWith(compareBy<RaceEntry>({ gradeOrder(it.grade) }, { it.name }))
        return RacePage(list.size, list.drop(offset).take(limit.coerceIn(1, 500)))
    }

    private fun gradeOrder(g: String) = when {
        g.matches(Regex("(G|Jpn)I")) -> 0
        g.matches(Regex("(G|Jpn)II")) -> 1
        g.matches(Regex("(G|Jpn)III")) -> 2
        g.isNotBlank() -> 3
        else -> 4
    }

    fun courses(): List<Racecourse> = CourseCatalog.all.map { c ->
        val m = snapshot.courseMedia[c.qid]
        c.copy(lat = m?.lat, lon = m?.lon, image = m?.image)
    }

    suspend fun credits(files: List<String>): List<MediaCredit> {
        val missing = files.filter { !credits.containsKey(it) }.distinct()
        missing.chunked(50).forEach { batch -> runCatching { wiki.credits(batch) }.getOrNull()?.forEach { credits[it.file] = it } }
        return files.mapNotNull { credits[it] }
    }
}
