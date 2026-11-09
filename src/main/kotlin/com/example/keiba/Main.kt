package com.example.keiba

import com.example.keiba.service.AuthService
import com.example.keiba.service.RaceService
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

fun main() {
    val raceService = RaceService()
    val authService = AuthService()
    val encyclopediaService = com.example.keiba.service.EncyclopediaService()

    val port = System.getenv("PORT")?.toIntOrNull() ?: 8080
    val host = "0.0.0.0"

    println("==================================================")
    println("🚀 Keiba Vision AI (Apple Liquid Glass Edition)")
    println("環境: Chimera Linux (musl) / Arch Linux / Windows")
    println("サーバー起動中: http://localhost:$port")
    println("==================================================")

    val server = embeddedServer(Netty, port = port, host = host) {
        install(ContentNegotiation) {
            json(Json {
                prettyPrint = true
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

            // ルートアクセスで Liquid Glass UI を配信
            get("/") {
                val indexStream = javaClass.getResourceAsStream("/static/index.html")
                if (indexStream != null) {
                    call.respondBytes(indexStream.readBytes(), ContentType.Text.Html)
                } else {
                    call.respondText("index.html not found", status = HttpStatusCode.NotFound)
                }
            }

            // ヘルスチェック
            get("/api/health") {
                call.respond(mapOf(
                    "status" to "ok",
                    "system" to "Chimera musl / Linux / Windows Compatible",
                    "version" to "3.9.0"
                ))
            }

            // 名鑑 & 血統 & コース図 API
            route("/api/encyclopedia") {
                get("horses") {
                    call.respond(encyclopediaService.getLegendaryHorses())
                }
                get("pedigree") {
                    call.respond(encyclopediaService.getPedigreeLineages())
                }
                get("courses") {
                    call.respond(encyclopediaService.getRacecourseGuides())
                }
                get("breeds") {
                    call.respond(encyclopediaService.getBreeds())
                }
                get("coats") {
                    call.respond(encyclopediaService.getCoatColors())
                }
            }

            // Native / Wasm / Zig / Odin ステータス API
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

    println("✅ Keiba Vision AI サーバーが起動しました！")
    println("👉 ブラウザで http://localhost:$port を開いてください。")
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
