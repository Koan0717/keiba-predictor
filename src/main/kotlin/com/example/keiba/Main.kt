package com.example.keiba

import com.example.keiba.service.AuthService
import com.example.keiba.service.RaceService
import com.example.keiba.service.HorseView
import com.example.keiba.service.LibraryService
import com.example.keiba.service.WeatherService
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.http.content.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.awt.Desktop
import java.net.URI

@Serializable
data class FavoriteRequest(val horseName: String)

@Serializable
data class NoteRequest(val raceId: String, val note: String)

@Serializable
data class HorseDetail(val view: HorseView, val summary: String?)

fun main(args: Array<String>) {
    // `--sync <dir>`: Wikipedia から最新データを取り、<dir>/library.json.gz に書いて終了 (同梱データの作成用)
    if (args.firstOrNull() == "--sync") {
        val dir = java.io.File(args.getOrNull(1) ?: "src/main/resources/data")
        val lib = LibraryService()
        runBlocking {
            val job = lib.refresh(java.io.File(dir, "library.json.gz"))!!
            while (job.isActive) { println(lib.progress); delay(3000) }
        }
        println(lib.status())
        return
    }

    val weatherService = WeatherService()
    val library = LibraryService().also { it.refreshIfStale() }
    val raceService = RaceService(weatherService)
    val authService = AuthService()
    val encyclopediaService = com.example.keiba.service.EncyclopediaService()

    val port = System.getenv("PORT")?.toIntOrNull() ?: 8080
    val host = "0.0.0.0"

    println("==================================================")
    println("Keiba Vision")
    println("環境: Chimera Linux (musl) / Arch Linux / Windows")
    println("サーバー起動中: http://localhost:$port")
    println("==================================================")

    val server = embeddedServer(Netty, port = port, host = host) {
        install(ContentNegotiation) {
            json(Json {
                prettyPrint = false
                encodeDefaults = true // 空文字や空配列も省略せず返す (フロントで undefined にしない)
                isLenient = true
                ignoreUnknownKeys = true
            })
        }

        install(CORS) {
            anyHost()
            allowHeader(HttpHeaders.ContentType)
            allowHeader(HttpHeaders.Authorization)
            allowMethod(HttpMethod.Options)
            allowMethod(HttpMethod.Put)
            allowMethod(HttpMethod.Patch)
            allowMethod(HttpMethod.Delete)
        }

        routing {
            // Wasm モジュールの明示的配信 (Content-Type: application/wasm) - staticResources より先に評価
            get("/static/wasm/{fileName}") {
                val fileName = call.parameters["fileName"] ?: return@get call.respond(HttpStatusCode.BadRequest)
                val stream = Thread.currentThread().contextClassLoader.getResourceAsStream("static/wasm/$fileName")
                    ?: javaClass.getResourceAsStream("/static/wasm/$fileName")
                if (stream != null) {
                    call.respondBytes(stream.readBytes(), ContentType("application", "wasm"))
                } else {
                    call.respond(HttpStatusCode.NotFound)
                }
            }

            // 静的アセットの提供
            staticResources("/static", "static")

            // トップページ
            get("/") {
                val indexStream = javaClass.getResourceAsStream("/static/index.html")
                if (indexStream != null) {
                    call.respondBytes(indexStream.readBytes(), ContentType.Text.Html)
                } else {
                    call.respondText("index.html not found", status = HttpStatusCode.NotFound)
                }
            }

            get("/api/health") { call.respond(mapOf("status" to "ok", "version" to "2.0.0")) }

            // ライブラリ (Wikipedia / Wikidata 由来): 競走馬・競走・競馬場
            get("/api/library/status") { call.respond(library.status()) }
            post("/api/library/refresh") {
                library.refresh()
                call.respond(library.status())
            }
            get("/api/horses") {
                val q = call.request.queryParameters
                call.respond(library.searchHorses(
                    q["q"] ?: "", q["sort"] ?: "rating", q["photo"] == "1", q["sex"] ?: "", q["surface"] ?: "",
                    q["offset"]?.toIntOrNull() ?: 0, q["limit"]?.toIntOrNull() ?: 48
                ))
            }
            get("/api/horses/detail") {
                val title = call.request.queryParameters["title"] ?: return@get call.respond(HttpStatusCode.BadRequest)
                val view = library.horse(title) ?: return@get call.respond(HttpStatusCode.NotFound)
                call.respond(HorseDetail(view, library.summary(title)))
            }
            get("/api/catalog/races") {
                val q = call.request.queryParameters
                call.respond(library.searchRaces(
                    q["q"] ?: "", q["course"] ?: "", q["grade"] ?: "", q["surface"] ?: "",
                    q["offset"]?.toIntOrNull() ?: 0, q["limit"]?.toIntOrNull() ?: 100
                ))
            }
            get("/api/courses") { call.respond(library.courses()) }
            get("/api/weather") {
                val points = library.courses().mapNotNull { c -> if (c.lat != null && c.lon != null) Triple(c.id, c.lat, c.lon) else null }
                call.respond(weatherService.currentFor(points))
            }
            get("/api/media") {
                val files = call.request.queryParameters["files"]?.split("|")?.filter { it.isNotBlank() }?.take(100) ?: emptyList()
                call.respond(library.credits(files))
            }

            // 血統・品種・毛色 (アプリ内蔵の解説データ)
            route("/api/encyclopedia") {
                get("pedigree") { call.respond(encyclopediaService.getPedigreeLineages()) }
                get("breeds") { call.respond(encyclopediaService.getBreeds()) }
                get("coats") { call.respond(encyclopediaService.getCoatColors()) }
            }

            get("/api/native/info") {
                // 実際に同梱されている wasm のサイズを返す (無ければ 0)
                call.respond(listOf("keiba_physics", "montecarlo", "pedigree").associateWith { name ->
                    javaClass.getResource("/static/wasm/$name.wasm")?.openStream()?.use { it.readBytes().size } ?: 0
                })
            }

            // 競馬データ API
            route("/api/races") {
                get {
                    val list = raceService.getAllRacesSummary()
                    call.respond(list)
                }

                get("{raceId}") {
                    val id = call.parameters["raceId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
                    val race = raceService.getRaceById(id)
                    if (race != null) {
                        call.respond(race)
                    } else {
                        call.respond(HttpStatusCode.NotFound)
                    }
                }

                get("{raceId}/analysis") {
                    val id = call.parameters["raceId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
                    val analysis = raceService.getRaceAnalysis(id)
                    if (analysis != null) {
                        call.respond(analysis)
                    } else {
                        call.respond(HttpStatusCode.NotFound)
                    }
                }
            }

            // 認証 & ユーザーセッション API
            route("/api/auth") {
                get("me") {
                    val token = call.request.cookies["keiba_session"]
                    val user = authService.getSession(token)
                    if (user != null) {
                        call.respond(user)
                    } else {
                        call.respond(HttpStatusCode.Unauthorized)
                    }
                }

                post("login") {
                    val provider = call.request.queryParameters["provider"] ?: "demo"
                    val (token, profile) = authService.createDemoSession(provider)
                    call.response.cookies.append(
                        Cookie(
                            name = "keiba_session",
                            value = token,
                            path = "/",
                            httpOnly = true,
                            maxAge = 86400 * 30
                        )
                    )
                    call.respond(profile)
                }

                post("logout") {
                    val token = call.request.cookies["keiba_session"]
                    if (token != null) {
                        authService.logout(token)
                    }
                    call.response.cookies.append(
                        Cookie(
                            name = "keiba_session",
                            value = "",
                            path = "/",
                            maxAge = 0
                        )
                    )
                    call.respond(mapOf("status" to "logged_out"))
                }
            }

            // お気に入り馬 API
            post("/api/favorites") {
                val token = call.request.cookies["keiba_session"]
                if (token == null) {
                    call.respond(HttpStatusCode.Unauthorized)
                    return@post
                }
                val req = call.receive<FavoriteRequest>()
                val updated = authService.addFavorite(token, req.horseName)
                if (updated != null) {
                    call.respond(updated)
                } else {
                    call.respond(HttpStatusCode.Unauthorized)
                }
            }

            // 予想メモ API
            post("/api/notes") {
                val token = call.request.cookies["keiba_session"]
                if (token == null) {
                    call.respond(HttpStatusCode.Unauthorized)
                    return@post
                }
                val req = call.receive<NoteRequest>()
                val updated = authService.saveNote(token, req.raceId, req.note)
                if (updated != null) {
                    call.respond(updated)
                } else {
                    call.respond(HttpStatusCode.Unauthorized)
                }
            }
        }
    }

    server.start(wait = false)

    println("Keiba Vision を起動しました")
    println("ブラウザで http://localhost:$port を開いてください")
    println("--------------------------------------------------")

    // クロスプラットフォーム (Chimera Linux musl, Arch Linux, Windows) 対応ブラウザオープン
    if (System.getenv("NO_BROWSER") == null) openBrowserAcrossPlatforms("http://localhost:$port")

    // メインスレッド維持
    Thread.currentThread().join()
}

/**
 * Chimera Linux (musl libc), Arch Linux, Windows のすべてで確実にブラウザを起動するマルチフォールバック関数
 */
fun openBrowserAcrossPlatforms(url: String) {
    try {
        Thread.sleep(1200) // サーバー起動待機
        val os = System.getProperty("os.name").lowercase()

        when {
            // Windows
            os.contains("win") -> {
                try {
                    Runtime.getRuntime().exec(arrayOf("rundll32", "url.dll,FileProtocolHandler", url))
                    return
                } catch (e: Exception) {
                    Runtime.getRuntime().exec(arrayOf("cmd.exe", "/c", "start", url))
                    return
                }
            }
            // Linux (Chimera Linux musl, Arch Linux, etc.)
            os.contains("linux") || os.contains("nix") -> {
                val openCommands = listOf(
                    arrayOf("xdg-open", url),
                    arrayOf("gio", "open", url),
                    arrayOf("x-www-browser", url),
                    arrayOf("firefox", url),
                    arrayOf("chromium", url)
                )

                for (cmd in openCommands) {
                    try {
                        val process = ProcessBuilder(*cmd).redirectErrorStream(true).start()
                        val exit = process.waitFor()
                        if (exit == 0) return
                    } catch (_: Exception) {
                        // 次のコマンドを試行
                    }
                }
            }
            // macOS / その他
            os.contains("mac") -> {
                Runtime.getRuntime().exec(arrayOf("open", url))
                return
            }
        }

        // AWT Desktop フォールバック (GUI環境サポート時)
        if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
            Desktop.getDesktop().browse(URI(url))
        } else {
            println("ブラウザ自動オープン: http://localhost:8080 をブラウザで開いてください。")
        }
    } catch (e: Exception) {
        println("ブラウザの自動オープンをスキップしました (手動で開いてください: $url): ${e.message}")
    }
}
