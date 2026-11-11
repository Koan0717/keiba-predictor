// 1 分に 1 回の起動ごとに「次に JRA から何を 1 つ取るか」を決める (純粋な関数なのでテストしやすい)。
// 1 回の起動で JRA へのリクエストは最大 1 件 = 1 分に 1 件。JRA のサーバーに負荷をかけないための上限。

export const MIN = 60_000;
export const HOUR = 60 * MIN;

/** JST (日本時間) の日付 "YYYY-MM-DD" と曜日 (0 = 日曜)、分単位の時刻 */
export function jst(now: number) {
  const d = new Date(now + 9 * HOUR);
  return {
    date: d.toISOString().slice(0, 10),
    weekday: d.getUTCDay(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    ym: (k: number) => {
      const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1));
      return `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
    },
  };
}

export type Meeting = { cname: string; date: string; fetched_at: number };
export type RaceDue = { id: string; cname: string; date: string; post_time: string; card_at: number };
export type ResultDue = { id: string; date: string; cname: string; result_at: number; has_result: number; card_cname: string | null; card_at: number; has_card: number };
export type Task =
  | { kind: "schedule"; month: string }
  | { kind: "top" }
  | { kind: "meeting"; cname: string }
  | { kind: "card"; id: string; cname: string }
  | { kind: "results_top" }
  | { kind: "result"; id: string; cname: string }
  | { kind: "result_card"; id: string; cname: string }
  | { kind: "idle" };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/** レースの出馬表をどれくらいの間隔で取り直すか (ms)。null = もう取らない */
export function cardInterval(r: RaceDue, now: number): number | null {
  const t = jst(now);
  if (r.date < t.date) return null; // 終わった日のレース (終わった開催のページは JRA 側で見られなくなる)
  if (r.date > t.date) return r.card_at ? 3 * HOUR : 0; // 前日まで: 出走馬とオッズを 3 時間ごと
  const post = toMin(r.post_time);
  if (post == null) return 30 * MIN;
  if (t.minutes < post + 15) return 20 * MIN; // 当日の発走前: オッズを 20 分ごと
  // 発走後: 発走後に 1 度も取っていなければ最後に 1 回 (確定オッズ)
  const fetchedMin = jst(r.card_at).date === t.date ? jst(r.card_at).minutes : -1;
  return fetchedMin < post + 15 ? 0 : null;
}

export function plan(now: number, state: Record<string, string>, meetings: Meeting[], races: RaceDue[], results: ResultDue[] = []): Task {
  const t = jst(now);
  // 1. 開催日程: 今月・来月・再来月を 12 時間ごと
  for (const k of [0, 1, 2]) {
    const month = t.ym(k);
    if (now - Number(state[`sched:${month}`] ?? 0) > 12 * HOUR) return { kind: "schedule", month };
  }
  // 2. 出馬表トップ (今週の開催): 開催がありうる木〜月は 20 分ごと、それ以外は 3 時間ごと
  const raceWeek = [4, 5, 6, 0, 1].includes(t.weekday);
  if (now - Number(state.top ?? 0) > (raceWeek ? 20 * MIN : 3 * HOUR)) return { kind: "top" };
  // 3. 各開催のレース一覧: 未取得なら すぐ、取得済みなら 3 時間ごと (今日・これからの開催だけ)
  const meeting = meetings
    .filter(m => m.date >= t.date && now - m.fetched_at > (m.fetched_at ? 3 * HOUR : 0))
    .sort((a, b) => a.fetched_at - b.fetched_at)[0];
  if (meeting) return { kind: "meeting", cname: meeting.cname };
  // 4. 出馬表 (オッズ込み): 予定より遅れている度合いが最も大きいレース
  let best: { r: RaceDue; late: number } | null = null;
  for (const r of races) {
    const interval = cardInterval(r, now);
    if (interval == null) continue;
    const late = now - r.card_at - interval;
    if (late >= 0 && (!best || late > best.late)) best = { r, late };
  }
  if (best) return { kind: "card", id: best.r.id, cname: best.r.cname };
  // ここから下は、今週の出馬表の更新に空きがあるときだけ (答え合わせ用の過去の結果)
  // 5. 結果一覧 (最近の重賞): 土・日・月曜は 1 時間ごと、それ以外は 6 時間ごと
  if (now - Number(state.results_top ?? 0) > ([6, 0, 1].includes(t.weekday) ? HOUR : 6 * HOUR)) return { kind: "results_top" };
  // 6. 結果: 終わった日のレース (当日は全レースが終わる 17 時以降)。取れなかったら 3 時間後にまた試す。新しい日付から
  const ended = (r: ResultDue) => r.date < t.date || (r.date === t.date && t.minutes >= 17 * 60);
  const retry = (at: number) => now - at > (at ? 3 * HOUR : 0);
  const res = results.filter(r => !r.has_result && ended(r) && retry(r.result_at)).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (res) return { kind: "result", id: res.id, cname: res.cname };
  // 7. 答え合わせに使う出馬表 (確定オッズと、そのときの過去 4 走)
  const rc = results.filter(r => r.has_result && !r.has_card && r.card_cname && retry(r.card_at)).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (rc) return { kind: "result_card", id: rc.id, cname: rc.card_cname! };
  return { kind: "idle" };
}
