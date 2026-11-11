// JRA 自動取得の自己チェック: 解析 (lib/jra.ts)・取得計画 (sync/plan.ts)・取得処理 (sync/index.ts の tick)・
// 画面用 API (/api/live/*) を、JRA に接続せずに通しで確かめる。
// JRA のページはここに保存しない (著作物のため)。下の HTML は、解析に必要な形だけをまねて手で書いたもの。
// 使い方: node test-live.mjs
import assert from "node:assert";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { parseTop, parseRaceList, parseCard, parseScheduleMonth, gradeOf } from "./lib/jra.ts";
import { plan, cardInterval, MIN, HOUR } from "./sync/src/plan.ts";
import { tick } from "./sync/src/index.ts";
import { onRequest } from "./functions/api/[[path]].ts";
import { features, paceOf, marketProbs, kelly } from "../src/main/resources/static/js/race-model.js";

// ---------- 手書きの JRA 風 HTML ----------
const TOP = `<a href="#" onclick="doAction('/JRADB/accessD.html', 'pw01drl10052026050520261115/AB');">5回東京5日<span>土曜</span></a>
  <a href="#" onclick="doAction('/JRADB/accessD.html', 'pw01drl10052026050520261115/AB');">もう一度</a>
  <a href="#" onclick="doAction('/JRADB/accessD.html', 'pw01drl10082026050520261115/C1');">5回京都5日</a>`;
const LIST = [10, 11].map(n => `<tr><th><a href="/JRADB/accessD.html?CNAME=pw01dde100520260505${n}20261115/E${n - 10}">${n}R</a></th>
  <td class="time">${n + 4}時40分</td>
  <td class="race_name">${n === 11 ? `<div class="stakes">テスト記念<span class="grade_icon"><img src="/x/icon_grade_s_g2.png"></span></div><div>3歳以上オープン</div>` : `<div>3歳以上2勝クラス</div>`}</td>
  <td class="dist"><span class="course">芝</span><span class="dist">2,000</span>m <span class="num">${n === 11 ? 3 : 12}</span>頭</td></tr>`).join("");
const past = (place, field, corner, dist, diff) => `<td class="past p1"><div class="date">2026年10月12日</div><div class="rc">東京</div>
  <div class="name">毎日王冠</div><div class="r_class"><img src="icon_grade_s_g2.png"></div><div class="place">${place}</div><div class="max">${field}</div>
  <div class="dist">${dist}芝</div><div class="time">1:45.3</div><div class="condition">良</div><div class="f3">3F 33.5</div>
  <ul class="corner_list"><li>${corner}</li><li>${corner}</li></ul><div class="fin"><span class="time">(${diff})</span></div></td>`;
const runner = (n, name, odds, pastHtml, extra = "") => `<td class="waku"><img src="/img/waku/${n}.png"></td><td class="num">${n}<span class="icon">B</span></td>
  <td class="horse"><div class="name"><a href="#">${name}</a></div>${extra}
  <div class="odds_line"><span class="num"><strong${n === 1 ? ' class="red"' : ""}>${odds}</strong></span><span class="pop_rank">(${n}番人気)</span></div>
  <p class="trainer"><a>調教師${n}</a></p><p class="division">(美浦)</p><p class="sire"><span>父：</span>父${n}</p><p class="mare"><span>母：</span>母${n}</p><p>(母の父：母父${n})</p>
  <div class="cell weight">480kg<span class="transition">(+4)</span></div></td>
  <td class="jockey"><p class="age">牡4/黒鹿</p><p class="weight">57.0<span>kg</span></p><p class="jockey"><a>騎手${n}</a></p></td>${pastHtml}`;
const CARD = `<h2><span class="race_name">テスト記念<span class="grade_icon"><img src="icon_grade_g2.png"></span></span><span class="num">第64回</span></h2>
  <div class="cell category">3歳以上</div><div class="cell class">オープン</div>
  <div class="cell course"><span class="cap">コース：</span>2,000<span class="unit">メートル</span><span class="detail">（芝・左）</span></div>
  <div>発走時刻：<strong>15時40分</strong></div><table><tbody><tr>` +
  runner(1, "テストホースア", "2.1", past(1, 12, 1, 1800, -0.2)) +
  runner(2, "テストホースイ", "4.5", past(6, 12, 6, 2400, 0.8)) +
  runner(3, "テストホースウ", "9.0", "");
const SCHEDULE = [{ month: "11", data: [
  { date: "15", day: "土", info: [{ race: [{ name: "5回東京5日" }, { name: "5回京都5日" }], gradeRace: [{ name: "テスト記念", grade: "G2", pos: "1" }, { name: "テスト障害", grade: "J・G1", pos: "2" }] }] },
  { date: "16", day: "日", info: [{ race: [{ name: "5回東京6日" }], gradeRace: [] }] },
  { date: "17", day: "月", info: [{ race: [], gradeRace: [] }] },
] }];

// ---------- 解析 ----------
assert.equal(gradeOf('<img src="icon_grade_lg_g1.png">'), "GI");
const top = parseTop(TOP);
assert.equal(top.length, 2, "同じ開催は 1 回だけ");
assert.deepEqual(top[0], { cname: "pw01drl10052026050520261115/AB", venue: "05", date: "2026-11-15", label: "5回東京5日" });
const list = parseRaceList(LIST);
assert.equal(list.length, 2);
assert.deepEqual(
  { id: list[1].id, raceNo: list[1].raceNo, postTime: list[1].postTime, name: list[1].name, grade: list[1].grade, cond: list[1].cond, surface: list[1].surface, distance: list[1].distance, field: list[1].field },
  { id: "20261115-05-11", raceNo: 11, postTime: "15:40", name: "テスト記念", grade: "GII", cond: "3歳以上オープン", surface: "芝", distance: 2000, field: 3 },
);
const card = parseCard(CARD);
assert.deepEqual(card.header, { name: "テスト記念", edition: "第64回", grade: "GII", cond: "3歳以上 オープン", distance: 2000, surface: "芝", turn: "左", postTime: "15:40" });
assert.equal(card.runners.length, 3);
const [a1, a2, a3] = card.runners;
assert.deepEqual([a1.num, a1.waku, a1.odds, a1.pop, a1.carry, a1.bodyWeight, a1.weightDiff, a1.color, a1.jockey, a1.damSire], [1, 1, 2.1, 1, 57, 480, 4, "黒鹿", "騎手1", "母父1"]);
assert.equal(a2.odds, 4.5, "人気が赤字でない馬のオッズ");
assert.deepEqual([a1.past[0].place, a1.past[0].field, a1.past[0].distance, a1.past[0].surface, a1.past[0].grade, a1.past[0].diff], [1, 12, 1800, "芝", "GII", -0.2]);
assert.equal(a3.past.length, 0, "過去走なし");
const days = parseScheduleMonth(SCHEDULE, 2026);
assert.equal(days[0].date, "2026-11-15");
assert.deepEqual(days[0].graded, [{ name: "テスト記念", grade: "GII", venue: "東京5日" }, { name: "テスト障害", grade: "J・GI", venue: "京都5日" }]);

// ---------- 予想モデル ----------
const race = { surface: "芝", distance: 2000 };
const f = card.runners.map(r => features(r, race));
assert(f[0].mu > f[1].mu && f[1].mu > 0.9, "前走 1 着の馬が上");
assert.equal(f[2].form, 0.4, "過去走なしは 0.4");
assert.deepEqual(f.map(v => v.style), [0, 2, 2], "1 コーナー 1/12 = 逃げ、6/12 = 差し、不明 = 差し");
assert.equal(paceOf([0, 2, 2]).name, "スローペース");
assert.equal(paceOf([0, 0, 1]).name, "ハイペース");
const m = marketProbs([2, 4, 4]);
assert(Math.abs(m.probs.reduce((s, v) => s + v, 0) - 1) < 1e-9 && Math.abs(m.takeout) < 1e-9);
assert.equal(kelly(0.3, 3), 0, "期待値 0.9 は賭けない");
assert(Math.abs(kelly(0.5, 3) - 0.25 * 0.25) < 1e-12, "f = (pO−1)/(O−1) の 1/4");

// ---------- 取得計画 ----------
const at = (iso) => Date.parse(iso); // JST で書く
const sat = at("2026-11-15T10:00:00+09:00");
const fresh = { "sched:202611": sat, "sched:202612": sat, "sched:202701": sat, top: sat };
assert.deepEqual(plan(sat, {}, [], []), { kind: "schedule", month: "202611" });
assert.deepEqual(plan(sat, { ...fresh, top: sat - 21 * MIN }, [], []), { kind: "top" }, "土曜は 20 分ごと");
assert.deepEqual(plan(at("2026-11-11T10:00:00+09:00"), { ...fresh, "sched:202611": at("2026-11-11T09:00:00+09:00"), top: at("2026-11-11T06:00:00+09:00") }, [], []).kind, "top");
assert.equal(plan(at("2026-11-11T10:00:00+09:00"), { ...fresh, top: at("2026-11-11T08:00:00+09:00") }, [], []).kind, "idle", "水曜は 3 時間ごと");
const mt = [{ cname: "old", date: "2026-11-15", fetched_at: sat - 4 * HOUR }, { cname: "new", date: "2026-11-15", fetched_at: 0 }, { cname: "past", date: "2026-11-14", fetched_at: 0 }];
assert.deepEqual(plan(sat, fresh, mt, []), { kind: "meeting", cname: "new" }, "未取得の開催が先");
assert.equal(plan(sat, fresh, mt.slice(2), []).kind, "idle", "終わった開催は取らない (JRA 側でページが消える)");
const rd = (post, card_at, date = "2026-11-15") => ({ id: post, cname: `c${post}`, date, post_time: post, card_at });
assert.equal(cardInterval(rd("15:40", 0, "2026-11-16"), sat), 0, "翌日のレースは未取得ならすぐ");
assert.equal(cardInterval(rd("15:40", sat, "2026-11-16"), sat), 3 * HOUR);
assert.equal(cardInterval(rd("15:40", sat), sat), 20 * MIN, "当日の発走前は 20 分ごと");
assert.equal(cardInterval(rd("09:30", at("2026-11-15T09:20:00+09:00")), sat), 0, "発走後に最後の 1 回");
assert.equal(cardInterval(rd("09:30", at("2026-11-15T09:50:00+09:00")), sat), null, "確定後はもう取らない");
assert.equal(cardInterval(rd("15:40", 0, "2026-11-14"), sat), null, "終わった日は取らない");
assert.deepEqual(plan(sat, fresh, [], [rd("15:40", sat - 25 * MIN), rd("12:00", sat - 50 * MIN)]), { kind: "card", id: "12:00", cname: "c12:00" }, "遅れが大きい方");

// ---------- tick を通しで (fetch を偽物に差し替え、D1 は node:sqlite) ----------
// Shift_JIS に変換する表を TextDecoder から作る (Node には Shift_JIS の TextEncoder がないため)
const sjis = new Map();
const dec = new TextDecoder("shift_jis");
for (let hi = 0x81; hi <= 0xfc; hi++) for (let lo = 0x40; lo <= 0xfc; lo++) {
  const ch = dec.decode(new Uint8Array([hi, lo]));
  if (ch.length === 1 && ch !== "�" && !sjis.has(ch)) sjis.set(ch, [hi, lo]);
}
const toSjis = (s) => new Uint8Array([...s].flatMap(ch => (ch.charCodeAt(0) < 0x80 ? [ch.charCodeAt(0)] : sjis.get(ch) ?? [0x3f])));
const requests = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  requests.push(`${init.method ?? "GET"} ${u.replace("https://www.jra.go.jp", "")}`);
  if (u.includes("/calendar/json/")) return new Response(JSON.stringify(SCHEDULE));
  if (init.method === "POST") return new Response(toSjis(TOP));
  if (u.includes("pw01drl")) return new Response(toSjis(LIST));
  if (u.includes("pw01dde")) return new Response(toSjis(CARD));
  return new Response("", { status: 404 });
};
const db = new DatabaseSync(":memory:");
for (const f of ["0001_init.sql", "0002_jra.sql"]) db.exec(await readFile(new URL(`./migrations/${f}`, import.meta.url), "utf8"));
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  first: async () => db.prepare(sql).get(...args) ?? null,
  run: async () => db.prepare(sql).run(...args),
});
const env = { DB: { prepare: sql => stmt(sql), batch: async (list) => { for (const s of list) await s.run(); } } };
let t = at("2026-11-14T10:00:00+09:00"); // 前日の土曜 → 翌日分を取る
const kinds = [];
for (let i = 0; i < 12; i++, t += MIN) kinds.push((await tick(env, t)).kind);
assert.deepEqual(kinds, ["schedule", "schedule", "schedule", "top", "meeting", "meeting", "card", "card", "idle", "idle", "idle", "idle"]);
assert(requests.length === 8 && requests.every(r => r.startsWith("GET /") || r === "POST /JRADB/accessD.html"), "1 分に 1 件まで");
const row = db.prepare("SELECT * FROM jra_races WHERE id = '20261115-05-11'").get();
assert.equal(JSON.parse(row.card).runners.length, 3);

// 失敗しても止まらず、記録して次へ進む
globalThis.fetch = async () => new Response("", { status: 503 });
t += 3 * HOUR;
assert.equal((await tick(env, t)).kind, "top");
assert.match(db.prepare("SELECT value FROM jra_state WHERE key = 'last_error'").get().value, /HTTP 503/);
assert.notEqual((await tick(env, t + MIN)).kind, "top", "失敗したものを毎分取り直さない (後ろの取得が止まらない)");
assert.equal(JSON.parse(db.prepare("SELECT card FROM jra_races WHERE id = '20261115-05-11'").get().card).runners.length, 3, "保存済みの出馬表は消えない");

// ---------- 画面用 API ----------
const call = async (pq) => {
  const url = new URL(pq, "https://example.pages.dev");
  const res = await onRequest({ request: new Request(url), env, params: { path: url.pathname.replace(/^\/api\//, "").split("/") } });
  return { status: res.status, body: await res.json() };
};
const realNow = Date.now;
Date.now = () => at("2026-11-14T12:00:00+09:00");
try {
  let r = await call("/api/live/races");
  assert.deepEqual(r.body.dates, ["2026-11-15"]);
  assert.equal(r.body.races.length, 2);
  assert.equal(r.body.races[1].venueName, "東京");
  assert.equal(r.body.races[1].hasCard, true);
  r = await call("/api/live/race?id=20261115-05-11");
  assert.equal(r.body.card.header.name, "テスト記念");
  assert.equal((await call("/api/live/race?id=../../x")).status, 400);
  assert.equal((await call("/api/live/race?id=20991231-05-11")).status, 404);
  r = await call("/api/live/schedule");
  assert.deepEqual(r.body.map(d => [d.date, d.hasRaces]), [["2026-11-15", true], ["2026-11-16", false]], "開催のない日は出さない");
  assert((await call("/api/live/status")).body.last_tick);
} finally {
  Date.now = realNow;
}
console.log("JRA 自動取得: すべて OK");
