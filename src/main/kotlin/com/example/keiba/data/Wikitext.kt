package com.example.keiba.data

import com.example.keiba.model.BigWin
import com.example.keiba.model.HorseEntry
import com.example.keiba.model.RaceEntry

/** Wikipedia のウィキテキストからインフォボックスを取り出す最小限のパーサ */
object Wikitext {
    private val refPair = Regex("<ref[^>/]*>.*?</ref>", RegexOption.DOT_MATCHES_ALL)
    private val refSelf = Regex("<ref[^>]*/>")
    private val comment = Regex("<!--.*?-->", RegexOption.DOT_MATCHES_ALL)
    private val fileLink = Regex("\\[\\[(?:ファイル|File|画像|Image):([^|\\]]+)", RegexOption.IGNORE_CASE)
    private val link = Regex("\\[\\[(?:[^|\\]]*\\|)?([^\\]]+)\\]\\]")
    private val lang = Regex("\\{\\{\\s*lang\\s*\\|[^|}]+\\|([^}]+)\\}\\}", RegexOption.IGNORE_CASE)
    private val gradeTpl = Regex("\\{\\{\\s*((?:G|Jpn)(?:I{1,3}|[1-3])|L|OP)\\s*\\}\\}")
    private val oneArgTpl = Regex("\\{\\{\\s*(?:Nowrap|nowrap|small|Small|lang-en|Lang-en)\\s*\\|([^{}]*)\\}\\}")
    private val anyTpl = Regex("\\{\\{[^{}]*\\}\\}")
    private val html = Regex("<[^>]+>")
    private val br = Regex("<br\\s*/?>", RegexOption.IGNORE_CASE)

    fun stripRefs(s: String) = s.replace(comment, "").replace(refPair, "").replace(refSelf, "")

    /** `{{name ...}}` の中身 (外側の括弧なし)。入れ子の {{ }} を数えて終端を探す */
    fun template(text: String, vararg names: String): String? {
        for (name in names) {
            val m = Regex("\\{\\{\\s*" + Regex.escape(name) + "\\s*(?=\\||\\n|\\}\\})").find(text) ?: continue
            var depth = 0
            var i = m.range.first
            while (i < text.length - 1) {
                when {
                    text.startsWith("{{", i) -> { depth++; i += 2 }
                    text.startsWith("}}", i) -> {
                        depth--; i += 2
                        if (depth == 0) return text.substring(m.range.first + 2, i - 2)
                    }
                    else -> i++
                }
            }
        }
        return null
    }

    /** 最上位の `|` で区切って key=value に */
    fun params(body: String): Map<String, String> {
        val parts = mutableListOf<String>()
        val sb = StringBuilder()
        var t = 0
        var l = 0
        var i = 0
        while (i < body.length) {
            when {
                body.startsWith("{{", i) -> { t++; sb.append("{{"); i += 2; continue }
                body.startsWith("}}", i) -> { t--; sb.append("}}"); i += 2; continue }
                body.startsWith("[[", i) -> { l++; sb.append("[["); i += 2; continue }
                body.startsWith("]]", i) -> { l--; sb.append("]]"); i += 2; continue }
                body[i] == '|' && t <= 0 && l <= 0 -> { parts += sb.toString(); sb.clear(); i++; continue }
            }
            sb.append(body[i]); i++
        }
        parts += sb.toString()
        return parts.drop(1).mapNotNull { p ->
            val k = p.indexOf('=')
            if (k <= 0) null else p.substring(0, k).trim() to p.substring(k + 1).trim()
        }.toMap()
    }

    /** 表示用のプレーンテキストに */
    fun clean(v: String?): String {
        if (v.isNullOrBlank()) return ""
        var s = stripRefs(v).replace(br, " / ")
        s = s.replace(Regex("\\{\\{\\s*JPN\\s*\\}\\}"), "日本")
        s = s.replace(lang, "$1").replace(gradeTpl, "$1")
        repeat(3) { s = s.replace(oneArgTpl, "$1") }
        repeat(4) { s = s.replace(anyTpl, "") }
        s = s.replace(Regex("\\[\\[(?:ファイル|File|画像|Image):[^\\]]*\\]\\]", RegexOption.IGNORE_CASE), "")
        s = s.replace(link, "$1").replace("'''", "").replace("''", "").replace(html, "")
        s = s.replace("&nbsp;", " ").replace(Regex("[ \\t]+"), " ").replace(Regex("(\\s*/\\s*)+$"), "")
        return s.trim().trim('/').trim()
    }

    fun imageName(v: String?): String? {
        if (v.isNullOrBlank()) return null
        fileLink.find(v)?.let { return it.groupValues[1].trim().replace(' ', '_') }
        val plain = clean(v)
        return if (Regex("\\.(jpe?g|png|gif|svg|webp|tiff?)$", RegexOption.IGNORE_CASE).containsMatchIn(plain)) plain.replace(' ', '_') else null
    }

    private fun year(s: String) = Regex("(\\d{4})年").find(s)?.groupValues?.get(1)?.toIntOrNull()

    /** "[[1985年]]" のほか "{{生年月日と馬齢|2019|3|23}}" のようなテンプレートにも対応 */
    private fun yearRaw(raw: String?): Int? = raw?.let {
        year(clean(it)) ?: Regex("\\|\\s*(1[6-9]\\d{2}|20\\d{2})\\s*\\|").find(it)?.groupValues?.get(1)?.toIntOrNull()
    }

    /** G1 / Jpn1 → GI / JpnI に揃える */
    fun normalizeGrade(g: String): String = g.replace(Regex("^(G|Jpn)([1-3])$")) { m -> m.groupValues[1] + "I".repeat(m.groupValues[2].toInt()) }

    /** 国内の競馬場 (現役 + 主な廃止場) */
    private val domesticCourses = Regex("^(札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉|帯広|門別|盛岡|水沢|浦和|船橋|大井|川崎|金沢|笠松|名古屋|園田|姫路|高知|佐賀|旭川|岩見沢|北見|上山|足利|宇都宮|高崎|三条|紀三井寺|益田|福山|荒尾|中津|ホッカイドウ|宇都宮|春木|東京競馬場)")

    /** "9億1251万2000円" → 91251 (万円)。円以外の通貨は null */
    fun manYen(s: String): Long? {
        val m = Regex("(?:(\\d+)億)?(?:(\\d+)万)?(?:\\d+)?円").find(s.replace(",", "")) ?: return null
        if (m.value == "円") return null
        val oku = m.groupValues[1].toLongOrNull() ?: 0
        val man = m.groupValues[2].toLongOrNull() ?: 0
        return oku * 10000 + man
    }

    private val medal = Regex("\\{\\{\\s*Medal\\s*((?:G|Jpn)I{1,3})\\s*\\|\\s*((?:\\[\\[[^\\]]*\\]\\]|[^|}\\[])*)")

    fun parseHorse(title: String, wikitext: String): HorseEntry? {
        val body = template(stripRefs(wikitext), "競走馬") ?: return null
        val p = params(body)
        fun g(vararg k: String) = k.firstNotNullOfOrNull { p[it]?.takeIf(String::isNotBlank) }
        val record = clean(g("績", "生涯成績", "競走成績"))
        val rm = Regex("(\\d+)戦(\\d+)勝").find(record)
        val earnings = clean(g("金", "獲得賞金"))
        val wins = medal.findAll(p["medaltemplates"] ?: body).map {
            BigWin(it.groupValues[1], clean(it.groupValues[2]))
        }.filter { it.race.isNotBlank() }.distinct().toList()
        val name = clean(g("名", "馬名")).ifBlank { title.substringBefore(" (") }
        return HorseEntry(
            title = title,
            name = name,
            nameEn = clean(g("英", "欧字表記")),
            image = imageName(g("画", "画像")),
            imageCaption = clean(g("説", "画像説明")),
            sex = clean(g("性", "性別")),
            color = clean(g("色", "毛色")),
            breed = clean(g("種", "品種")),
            birthYear = yearRaw(g("生", "生誕")),
            deathYear = yearRaw(g("死", "死没")),
            sire = clean(g("父")),
            dam = clean(g("母")),
            damSire = clean(g("母父")),
            breeder = clean(g("産", "生産")),
            country = clean(g("国", "生国")),
            owner = clean(g("主", "馬主")).substringBefore(" / ").substringBefore("→").trim(),
            trainer = clean(g("調", "調教師")).substringBefore(" / ").substringBefore("→").trim(),
            starts = rm?.groupValues?.get(1)?.toIntOrNull(),
            wins = rm?.groupValues?.get(2)?.toIntOrNull(),
            recordText = record,
            earningsText = earnings,
            earningsManYen = manYen(earnings.substringBefore(" / ")),
            honors = clean(g("冠", "受賞")),
            bigWins = wins
        )
    }

    fun parseRace(title: String, wikitext: String): RaceEntry? {
        val body = template(stripRefs(wikitext), "競馬の競走") ?: return null
        val p = params(body)
        fun g(vararg k: String) = k.firstNotNullOfOrNull { p[it]?.takeIf(String::isNotBlank) }
        val country = clean(g("開催国"))
        val course = clean(g("競馬場")).substringBefore(" / ")
        val domestic = country.contains("日本") || (country.isBlank() && domesticCourses.containsMatchIn(course))
        if (!domestic) return null
        val nameRaw = clean(g("競走名")).split(" / ")
        return RaceEntry(
            title = title,
            name = nameRaw.firstOrNull()?.ifBlank { null } ?: title.substringBefore(" ("),
            nameEn = nameRaw.getOrNull(1) ?: "",
            course = course,
            surface = clean(g("馬場")),
            distance = Regex("(\\d{3,5})").find(clean(g("距離")).replace(",", ""))?.value?.toIntOrNull(),
            grade = normalizeGrade(clean(g("格付け")).substringBefore(" / ").trim()),
            prize = clean(g("1着賞金")).substringBefore(" / "),
            founded = clean(g("創設")),
            season = clean(g("施行時期", "開催時期")),
            organizer = clean(g("主催者")),
            condition = clean(g("条件")),
            image = imageName(g("画像"))
        )
    }
}
