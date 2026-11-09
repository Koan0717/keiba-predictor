package com.example.keiba.service

import com.example.keiba.model.UserProfile
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.slf4j.LoggerFactory
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class AuthService {
    private val logger = LoggerFactory.getLogger(AuthService::class.java)

    // セッショントークン -> ユーザープロファイル
    private val sessions = ConcurrentHashMap<String, UserProfile>()

    // 環境変数または設定からOAuthクレデンシャルを取得 (未設定時はモック/デモフォールバック)
    val githubClientId: String = System.getenv("GITHUB_CLIENT_ID") ?: ""
    val githubClientSecret: String = System.getenv("GITHUB_CLIENT_SECRET") ?: ""
    val googleClientId: String = System.getenv("GOOGLE_CLIENT_ID") ?: ""
    val googleClientSecret: String = System.getenv("GOOGLE_CLIENT_SECRET") ?: ""

    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }

    fun getSession(token: String?): UserProfile? {
        if (token.isNullOrBlank()) return null
        return sessions[token]
    }

    fun saveSession(token: String, profile: UserProfile) {
        sessions[token] = profile
    }

    fun createDemoSession(provider: String): Pair<String, UserProfile> {
        val token = "demo-" + UUID.randomUUID().toString()
        val profile = when (provider.lowercase()) {
            "github" -> UserProfile(
                id = "gh-guest-42",
                name = "GitHub Keiba Fan",
                email = "user@github.example.com",
                avatarUrl = "https://avatars.githubusercontent.com/u/9919?v=4",
                provider = "github",
                favoriteHorses = listOf("ドウデュース", "レガレイラ")
            )
            "google" -> UserProfile(
                id = "goog-guest-77",
                name = "Google Keiba Master",
                email = "keiba.master@gmail.com",
                avatarUrl = "https://lh3.googleusercontent.com/a/ACg8ocIq=s96-c",
                provider = "google",
                favoriteHorses = listOf("スターズオンアース", "シンエンペラー")
            )
            else -> UserProfile(
                id = "guest-01",
                name = "競馬ファン (Guest)",
                email = "guest@keiba.local",
                avatarUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
                provider = "demo"
            )
        }
        sessions[token] = profile
        return Pair(token, profile)
    }

    fun addFavorite(token: String, horseName: String): UserProfile? {
        val user = sessions[token] ?: return null
        val updatedList = if (user.favoriteHorses.contains(horseName)) {
            user.favoriteHorses - horseName
        } else {
            user.favoriteHorses + horseName
        }
        val updated = user.copy(favoriteHorses = updatedList)
        sessions[token] = updated
        return updated
    }

    fun saveNote(token: String, raceId: String, note: String): UserProfile? {
        val user = sessions[token] ?: return null
        val updatedNotes = user.notes.toMutableMap()
        updatedNotes[raceId] = note
        val updated = user.copy(notes = updatedNotes)
        sessions[token] = updated
        return updated
    }

    fun logout(token: String) {
        sessions.remove(token)
    }
}
