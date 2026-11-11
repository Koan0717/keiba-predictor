// ==================================================================================
// JRA 公式サイトの出馬表・開催日程を読み取る (keiba-vision-sync Worker が使う)
// ==================================================================================
// JRA のサイトは Shift_JIS の HTML で、画面は「cname」という画面コードで指定する。
//   出馬表トップ      pw01dli00/F3                         → 今週の開催 (pw01drl...) の一覧
//   開催のレース一覧  pw01drl10 VV YYYY KK DD YYYYMMDD /XX  → 各レースの出馬表 (pw01dde...)
//   出馬表            pw01dde10 VV YYYY KK DD RR YYYYMMDD /XX
//   (VV 競馬場, KK 回, DD 日目, RR レース番号, 最後の /XX は JRA 側のチェック用の値)
// 開催日程は JSON (/keiba/common/calendar/json/YYYYMM.json) で配信されている。
// ここでは HTML から「事実のデータ」(馬名・オッズ・過去の着順など) だけを取り出し、ページそのものは保存しない。

export const VENUES: Record<string, string> = {
  "01": "札幌", "02": "函館", "03": "福島", "04": "新潟", "05": "東京",
  "06": "中山", "07": "中京", "08": "京都", "09": "阪神", "10": "小倉",
};
// アプリの競馬場 ID (data/CourseCatalog.kt) との対応
export const VENUE_IDS: Record<string, string> = {
  "01": "sapporo", "02": "hakodate", "03": "fukushima", "04": "niigata", "05": "tokyo",
  "06": "nakayama", "07": "chukyo", "08": "kyoto", "09": "hanshin", "10": "kokura",
};

export const decodeSjis = (buf: ArrayBuffer) => new TextDecoder("shift_jis").decode(buf);

const text = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const num = (s: string | undefined) => {
  const n = parseFloat((s ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
const isoDate = (y: string, m: string, d: string) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;

/** 格付けの画像 (icon_grade_s_g2.png など) → GI / GII / GIII / J・GI / L */
export function gradeOf(html: string): string {
  const g = /icon_grade(?:_s|_lg)?_([a-z0-9]+)\.png/.exec(html)?.[1] ?? "";
  return ({ g1: "GI", g2: "GII", g3: "GIII", jg1: "J・GI", jg2: "J・GII", jg3: "J・GIII", listed: "L" } as Record<string, string>)[g] ?? "";
}

/** 出馬表のコード → レースの ID などに分解。ID は「日付-競馬場-レース番号」(例 20261108-05-11) */
export function parseRaceCname(cname: string) {
  const m = /^pw01dde10(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})(\d{8})\//.exec(cname);
  if (!m) return null;
  const [, venue, year, kai, day, race, date] = m;
  return { id: `${date}-${venue}-${race}`, venue, year, kai: +kai, day: +day, raceNo: +race, date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}` };
}

/** 出馬表トップ → 今週の開催 [{cname, date, venue, label}] */
export function parseTop(html: string) {
  const out: { cname: string; date: string; venue: string; label: string }[] = [];
  const re = /doAction\('\/JRADB\/accessD\.html',\s*'(pw01drl10(\d{2})\d{8}(\d{8})\/[0-9A-F]{2})'\);?"?[^>]*>([\s\S]*?)<\/a>/g;
  for (const m of html.matchAll(re)) {
    const [, cname, venue, d, inner] = m;
    if (out.some(o => o.cname === cname)) continue;
    out.push({ cname, venue, date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`, label: text(inner.replace(/<span[^>]*>[\s\S]*?<\/span>/g, "")) });
  }
  return out;
}

export type RaceRow = {
  id: string; date: string; venue: string; raceNo: number; cname: string; resultCname: string | null;
  postTime: string; name: string; grade: string; cond: string; surface: string; distance: number | null; field: number | null;
};

/** 開催のレース一覧 → 各レースの基本情報 */
export function parseRaceList(html: string): RaceRow[] {
  const rows: RaceRow[] = [];
  for (const tr of html.split(/<tr[\s>]/).slice(1)) {
    const cname = /CNAME=(pw01dde\d+\/[0-9A-F]{2})/.exec(tr)?.[1];
    const ids = cname && parseRaceCname(cname);
    if (!ids || rows.some(r => r.id === ids.id)) continue;
    const time = /class="time">\s*(\d{1,2})時(\d{2})分/.exec(tr);
    const nameCell = /class="race_name">([\s\S]*?)<\/td>/.exec(tr)?.[1] ?? "";
    const stakes = /class="stakes">([\s\S]*?)<\/div>/.exec(nameCell)?.[1];
    const lines = [...nameCell.matchAll(/<div>([^<]+)<\/div>/g)].map(m => text(m[1]));
    const dist = /class="dist">([\s\S]*?)<\/td>/.exec(tr)?.[1] ?? "";
    rows.push({
      ...ids, cname,
      resultCname: /CNAME=(pw01sde\d+\/[0-9A-F]{2})/.exec(tr)?.[1] ?? null,
      postTime: time ? `${time[1].padStart(2, "0")}:${time[2]}` : "",
      name: stakes ? text(stakes) : lines[0] ?? text(nameCell),
      grade: gradeOf(nameCell),
      cond: stakes ? lines.find(l => l && l !== text(stakes)) ?? "" : "",
      surface: text(/class="course">([^<]*)</.exec(dist)?.[1] ?? ""),
      distance: num(/class="dist">([\d,]+)/.exec(dist)?.[1]),
      field: num(/class="num">(\d+)/.exec(dist)?.[1]),
    });
  }
  return rows;
}

export type PastRun = {
  date: string; course: string; race: string; grade: string; place: number | null; field: number | null; gate: number | null;
  pop: number | null; distance: number | null; surface: string; time: string; cond: string; f3: number | null;
  corners: number[]; diff: number | null;
};
export type Runner = {
  waku: number | null; num: number | null; name: string; odds: number | null; pop: number | null; scratched: boolean;
  sexAge: string; color: string; carry: number | null; bodyWeight: number | null; weightDiff: number | null;
  jockey: string; trainer: string; division: string; sire: string; dam: string; damSire: string; past: PastRun[];
};

function parsePast(cell: string): PastRun | null {
  const date = /class="date">(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(cell);
  if (!date) return null; // 過去走がない欄 (新馬など)
  const dist = /class="dist">(\d+)(芝|ダ|障)/.exec(cell);
  const diff = /class="fin">[\s\S]*?class="time">\(([-−]?[\d.]+)\)/.exec(cell)?.[1];
  return {
    date: isoDate(date[1], date[2], date[3]),
    course: text(/class="rc">([^<]*)</.exec(cell)?.[1] ?? ""),
    race: text(/class="name">([\s\S]*?)<\/div>/.exec(cell)?.[1] ?? ""),
    grade: gradeOf(/class="r_class">([\s\S]*?)<\/div>/.exec(cell)?.[1] ?? ""),
    place: num(/class="place">(\d+)/.exec(cell)?.[1]),
    field: num(/class="max">(\d+)/.exec(cell)?.[1]),
    gate: num(/class="gate">(\d+)/.exec(cell)?.[1]),
    pop: num(/class="pop">(\d+)/.exec(cell)?.[1]),
    distance: dist ? +dist[1] : null,
    surface: dist ? ({ 芝: "芝", ダ: "ダート", 障: "障害" } as Record<string, string>)[dist[2]] : "",
    time: /class="time">(\d+:\d{2}\.\d)</.exec(cell)?.[1] ?? "",
    cond: text(/class="condition">([^<]*)</.exec(cell)?.[1] ?? ""),
    f3: num(/class="f3">3F\s*([\d.]+)/.exec(cell)?.[1]),
    corners: [...(/class="corner_list">([\s\S]*?)<\/ul>/.exec(cell)?.[1] ?? "").matchAll(/<li[^>]*>(\d+)<\/li>/g)].map(m => +m[1]),
    diff: diff == null ? null : num(diff.replace("−", "-")),
  };
}

/** 出馬表 → レースの見出しと出走馬 */
export function parseCard(html: string) {
  const head = html.slice(0, Math.max(0, html.indexOf("<tbody")));
  const course = /class="cell course">([\s\S]*?)<\/div>/.exec(head)?.[1] ?? "";
  const detail = /class="detail">（([^・）]+)・?([^）]*)）/.exec(course);
  const time = /発走時刻：\s*<strong>(\d{1,2})時(\d{2})分/.exec(head);
  const header = {
    name: text(/class="race_name">([\s\S]*?)<span class="grade_icon|class="race_name">([\s\S]*?)<\/span>/.exec(head)?.slice(1).find(Boolean) ?? ""),
    edition: text(/<span class="num">(第\d+回)<\/span>/.exec(head)?.[1] ?? ""),
    grade: gradeOf(/class="race_name">([\s\S]*?)<\/h2>/.exec(head)?.[1] ?? ""),
    cond: ["category", "class", "rule", "weight"].map(c => text(new RegExp(`class="cell ${c}">([^<]*)<`).exec(head)?.[1] ?? "")).filter(Boolean).join(" "),
    distance: num(/<\/span>([\d,]+)<span class="unit">メートル/.exec(course)?.[1]),
    surface: detail ? ({ 芝: "芝", ダート: "ダート", 障害: "障害" } as Record<string, string>)[detail[1]] ?? detail[1] : "",
    turn: detail?.[2] ?? "",
    postTime: time ? `${time[1].padStart(2, "0")}:${time[2]}` : "",
  };
  const runners: Runner[] = [];
  const body = html.slice(html.indexOf("<tbody"));
  for (const row of body.split(/<td class="waku">/).slice(1)) {
    const horse = /<td class="horse">([\s\S]*?)<td class="jockey">/.exec(row)?.[1] ?? "";
    const jockeyCell = /<td class="jockey">([\s\S]*?)<\/td>/.exec(row)?.[1] ?? "";
    const age = text(/class="age">([^<]*)</.exec(jockeyCell)?.[1] ?? "").split("/");
    const weight = /class="cell weight">(\d+)kg(?:<span class="transition">\(([-+]?\d+)\))?/.exec(horse);
    const name = text(/class="name"><a[^>]*>([^<]+)<\/a>/.exec(horse)?.[1] ?? /class="name">([^<]+)</.exec(horse)?.[1] ?? "");
    if (!name) continue;
    runners.push({
      waku: num(/waku\/(\d)\.png/.exec(row)?.[1]),
      num: num(/<td class="num">\s*(\d+)/.exec(row)?.[1]), // ブリンカー等のアイコンが続くことがある
      name,
      odds: num(/class="odds_line"><span class="num"><strong[^>]*>([\d.]+)<\/strong>/.exec(horse)?.[1]), // 1・2 番人気は class="red"
      pop: num(/class="pop_rank">\((\d+)/.exec(horse)?.[1]),
      scratched: /(取消|除外|競走中止)/.test(text(horse).slice(0, 80)),
      sexAge: age[0] ?? "", color: age[1] ?? "",
      carry: num(/class="weight">\s*([\d.]+)\s*<span>kg/.exec(jockeyCell)?.[1]),
      bodyWeight: weight ? +weight[1] : null,
      weightDiff: weight?.[2] != null ? +weight[2] : null,
      jockey: text(/class="jockey"><a[^>]*>([^<]+)</.exec(jockeyCell)?.[1] ?? /class="jockey">([^<]+)</.exec(jockeyCell)?.[1] ?? ""),
      trainer: text(/class="trainer"><a[^>]*>([^<]+)</.exec(horse)?.[1] ?? ""),
      division: text(/class="division">\(([^)]*)\)/.exec(horse)?.[1] ?? ""),
      sire: text(/class="sire"><span>父：<\/span>([^<]*)</.exec(horse)?.[1] ?? ""),
      dam: text(/class="mare"><span>母：<\/span>([^<]*)</.exec(horse)?.[1] ?? ""),
      damSire: text(/母の父：([^)）<]*)/.exec(horse)?.[1] ?? ""),
      past: row.split(/<td class="past p\d/).slice(1).map(parsePast).filter((p): p is PastRun => !!p),
    });
  }
  return { header, runners };
}

export type ScheduleDay = { date: string; day: string; meetings: string[]; graded: { name: string; grade: string; venue: string }[] };

/** 開催日程の JSON (1 か月分) → 日ごとの開催と重賞 */
export function parseScheduleMonth(json: any, year: number): ScheduleDay[] {
  const out: ScheduleDay[] = [];
  for (const month of Array.isArray(json) ? json : []) {
    for (const d of month.data ?? []) {
      for (const info of d.info ?? []) {
        const meetings: string[] = (info.race ?? []).map((r: any) => String(r.name));
        out.push({
          date: isoDate(String(year), String(month.month), String(d.date)),
          day: String(d.day ?? ""),
          meetings,
          // pos は meetings の何番目 (1 始まり) の開催で行われるか
          graded: (info.gradeRace ?? []).map((g: any) => ({
            name: String(g.detail || g.name),
            // G1 → GI、JG1 / J・G1 (障害) → J・GI
            grade: String(g.grade ?? "").replace(/^JG/, "J・G").replace(/G([123])$/, (_, n) => "G" + "I".repeat(+n)),
            venue: (meetings[Number(g.pos) - 1] ?? "").replace(/^\d+回/, ""),
          })),
        });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
