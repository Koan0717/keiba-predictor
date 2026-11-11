// ==================================================================================
// keiba-vision-sync — JRA 公式サイトから開催日程・出馬表・オッズを自動で取り込む Worker
// ==================================================================================
// Cloudflare の Cron Trigger で 1 分ごとに起動し、plan() が選んだ 1 件だけを取得して D1 に保存する。
// 人の操作は一切いらない。画面 (Pages) は D1 を読むだけで、予想の計算はブラウザ (Zig の Wasm) が行う。
//   GET / … 取得の状態 (最終取得時刻・最後のエラー・件数) を JSON で返す (動作確認用)

import { decodeSjis, parseTop, parseRaceList, parseCard } from "../../lib/jra.ts";
import { plan, jst, type Meeting, type RaceDue } from "./plan.ts";

interface D1Stmt { bind(...v: unknown[]): D1Stmt; all<T = any>(): Promise<{ results: T[] }>; first<T = any>(): Promise<T | null>; run(): Promise<unknown> }
interface Env { DB: { prepare(sql: string): D1Stmt; batch(s: D1Stmt[]): Promise<unknown> } }

const BASE = "https://www.jra.go.jp";
const UA = "KeibaVision/2.0 (+https://github.com/TatsuyaM2667/keiba-predictor)";

async function get(path: string): Promise<Response> {
  const res = await fetch(BASE + path, { headers: { "user-agent": UA, "accept-language": "ja" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res;
}
const page = async (cname: string) => decodeSjis(await (await get(`/JRADB/accessD.html?CNAME=${encodeURIComponent(cname)}`)).arrayBuffer());

const setState = (env: Env, key: string, value: string | number) =>
  env.DB.prepare("INSERT INTO jra_state (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2").bind(key, String(value)).run();

export async function tick(env: Env, now = Date.now()) {
  const db = env.DB;
  const today = jst(now).date;
  const [state, meetings, races] = await Promise.all([
    db.prepare("SELECT key, value FROM jra_state").all<{ key: string; value: string }>(),
    db.prepare("SELECT cname, date, fetched_at FROM jra_meetings WHERE date >= ?").bind(today).all<Meeting>(),
    db.prepare("SELECT id, cname, date, post_time, card_at FROM jra_races WHERE date >= ?").bind(today).all<RaceDue>(),
  ]);
  const task = plan(now, Object.fromEntries(state.results.map(r => [r.key, r.value])), meetings.results, races.results);
  await setState(env, "last_tick", now);
  if (task.kind === "idle") return task;
  await setState(env, "last_task", JSON.stringify(task));

  try {
    if (task.kind === "schedule") {
      const json = await (await get(`/keiba/common/calendar/json/${task.month}.json`)).text();
      JSON.parse(json); // 壊れた応答を保存しない
      await db.prepare("INSERT INTO jra_schedule (month, json, fetched_at) VALUES (?1, ?2, ?3) ON CONFLICT(month) DO UPDATE SET json = ?2, fetched_at = ?3")
        .bind(task.month, json, now).run();
      await setState(env, `sched:${task.month}`, now);
    } else if (task.kind === "top") {
      // 出馬表トップは POST で開く画面
      const res = await fetch(`${BASE}/JRADB/accessD.html`, {
        method: "POST", body: "cname=pw01dli00/F3", signal: AbortSignal.timeout(20_000),
        headers: { "user-agent": UA, "content-type": "application/x-www-form-urlencoded" },
      });
      if (!res.ok) throw new Error(`top: HTTP ${res.status}`);
      const list = parseTop(decodeSjis(await res.arrayBuffer()));
      await db.batch([
        ...list.map(m => db.prepare("INSERT INTO jra_meetings (cname, date, venue, label) VALUES (?, ?, ?, ?) ON CONFLICT(cname) DO NOTHING").bind(m.cname, m.date, m.venue, m.label)),
        // 10 日より前のデータは消す (容量を増やし続けないため)
        db.prepare("DELETE FROM jra_meetings WHERE date < date(?, '-10 days')").bind(today),
        db.prepare("DELETE FROM jra_races WHERE date < date(?, '-10 days')").bind(today),
      ]);
      await setState(env, "top", now);
    } else if (task.kind === "meeting") {
      const rows = parseRaceList(await page(task.cname));
      if (!rows.length) throw new Error(`${task.cname}: レースが見つかりません (ページの形式が変わった可能性)`);
      await db.batch([
        ...rows.map(r => db.prepare(
          `INSERT INTO jra_races (id, date, venue, race_no, post_time, name, grade, cond, surface, distance, field, cname)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
           ON CONFLICT(id) DO UPDATE SET post_time = ?5, name = ?6, grade = ?7, cond = ?8, surface = ?9, distance = ?10, field = ?11, cname = ?12`
        ).bind(r.id, r.date, r.venue, r.raceNo, r.postTime, r.name, r.grade, r.cond, r.surface, r.distance, r.field, r.cname)),
        db.prepare("UPDATE jra_meetings SET fetched_at = ? WHERE cname = ?").bind(now, task.cname),
      ]);
    } else {
      const card = parseCard(await page(task.cname));
      if (!card.runners.length) throw new Error(`${task.cname}: 出走馬が見つかりません (ページの形式が変わった可能性)`);
      await db.prepare("UPDATE jra_races SET card = ?, card_at = ? WHERE id = ?").bind(JSON.stringify(card), now, task.id).run();
    }
    await setState(env, "last_ok", now);
  } catch (e) {
    // 失敗しても止まらない。次の起動 (1 分後) に同じものをもう一度試す
    await setState(env, "last_error", JSON.stringify({ at: now, task, message: String(e) }));
    // ただし同じ所で失敗し続けて後ろの取得が止まらないよう「今取得した」ことにして、通常の更新間隔のあとで再挑戦する
    // (保存済みのデータはそのまま残る。まだ公開されていない先の月の日程は 403 が返るので、12 時間後にまた試す)
    if (task.kind === "schedule") await setState(env, `sched:${task.month}`, now);
    if (task.kind === "top") await setState(env, "top", now);
    if (task.kind === "meeting") await db.prepare("UPDATE jra_meetings SET fetched_at = ? WHERE cname = ?").bind(now, task.cname).run();
    if (task.kind === "card") await db.prepare("UPDATE jra_races SET card_at = ? WHERE id = ?").bind(now, task.id).run();
  }
  return task;
}

export default {
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(tick(env));
  },
  async fetch(_req: Request, env: Env) {
    const state = await env.DB.prepare("SELECT key, value FROM jra_state").all<{ key: string; value: string }>();
    const counts = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM jra_meetings) AS meetings, (SELECT COUNT(*) FROM jra_races) AS races, (SELECT COUNT(*) FROM jra_races WHERE card IS NOT NULL) AS cards").first();
    return Response.json({ state: Object.fromEntries(state.results.map(r => [r.key, r.value])), counts });
  },
};
