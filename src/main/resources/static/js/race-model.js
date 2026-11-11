// ==================================================================================
// 実際の出馬表 (JRA) から、モンテカルロ (Zig) に渡す値を作る予想モデル
// ==================================================================================
// 各馬の「平均的な出来」μ を、過去 4 走から次の式で作る (どれも説明できる単純な形):
//   1 走ごとの点   q = 着順の相対位置 (1 着 = 1、最下位 = 0) + 格の加点 − 0.04 × 勝ち馬とのタイム差 (秒)
//   近走の評価     form = Σ wₖ qₖ / Σ wₖ   (w = 0.4, 0.3, 0.2, 0.1。新しいレースほど重い)
//   距離・馬場     同じ馬場の過去走の平均距離から 400m 離れるごとに −0.02 (最大 −0.05)、
//                 同じ馬場を走ったことがなければ −0.03
//   μ = 1 + 0.25 × (form − 0.5) + 距離 + 馬場
// 脚質は過去走の 1 コーナー通過順位 ÷ 頭数 から推定する。
// 係数はすべて手で決めた値で、過去のレースで検証したものではない (ドキュメント「本物の予想へ」参照)。

export const STYLE_NAMES = ["逃げ", "先行", "差し", "追込"];
const W = [0.4, 0.3, 0.2, 0.1];
const CLASS_BONUS = { "GI": 0.12, "GII": 0.08, "GIII": 0.05, "L": 0.03, "J・GI": 0.05, "J・GII": 0.04, "J・GIII": 0.03 };

/** 1 頭分の特徴量 */
export function features(runner, race) {
  const runs = (runner.past || []).filter(p => p.place && p.field && p.field > 1).slice(0, 4);
  let sw = 0, s = 0;
  runs.forEach((p, k) => {
    const rel = 1 - (p.place - 1) / (p.field - 1);
    const behind = Math.max(0, p.diff ?? 0); // 勝ったレースは 2 着との差 (負) が入るので 0 とみなす
    s += W[k] * (rel + (CLASS_BONUS[p.grade] ?? 0) - 0.04 * Math.min(behind, 3));
    sw += W[k];
  });
  const form = sw ? s / sw : 0.4; // 過去走がない (新馬など) は平均より少し下と仮定
  const same = runs.filter(p => p.surface === race.surface && p.distance);
  let distFit = 0, surfFit = 0;
  if (same.length && race.distance) {
    const avg = same.reduce((a, p) => a + p.distance, 0) / same.length;
    distFit = -Math.min(0.05, (0.02 * Math.abs(race.distance - avg)) / 400);
  } else if (runs.length) surfFit = -0.03;
  const corners = runs.filter(p => p.corners?.length).map(p => p.corners[0] / p.field);
  const ratio = corners.length ? corners.reduce((a, b) => a + b, 0) / corners.length : null;
  const style = ratio == null ? 2 : ratio < 0.15 ? 0 : ratio < 0.4 ? 1 : ratio < 0.7 ? 2 : 3;
  return { form, distFit, surfFit, style, mu: 1 + 0.25 * (form - 0.5) + distFit + surfFit, runs: runs.length };
}

/** 逃げ・先行の頭数からペースを予想 (予想エンジン PredictorEngine.kt と同じ規則) */
export function paceOf(styles) {
  const nige = styles.filter(s => s === 0).length, senko = styles.filter(s => s === 1).length;
  if (nige >= 2 || (nige === 1 && senko >= 5)) return { value: 1.2, name: "ハイペース" };
  if (nige === 0 || (nige === 1 && senko <= 2)) return { value: 0.8, name: "スローペース" };
  return { value: 1.0, name: "ミドルペース" };
}

/** 単勝オッズ → 市場の予想確率 (逆数を合計で割って正規化。合計 1 にする) */
export function marketProbs(odds) {
  const inv = odds.map(o => (o > 0 ? 1 / o : 0));
  const sum = inv.reduce((a, b) => a + b, 0);
  return { probs: inv.map(v => (sum ? v / sum : 0)), takeout: sum ? 1 - 1 / sum : null };
}

/** ケリー基準で賭ける割合。期待値 pO ≤ 1 なら 0 (賭けない)。fraction は安全のための割引 */
export const kelly = (p, odds, fraction = 0.25) => (odds > 1 && p * odds > 1 ? fraction * (p * odds - 1) / (odds - 1) : 0);

/** 毛色の略称 (出馬表の「鹿」など) → アプリの毛色名 */
export function coatName(c) {
  return { "鹿": "鹿毛", "栗": "栗毛", "栃栗": "栃栗毛", "黒鹿": "黒鹿毛", "青鹿": "青鹿毛", "青": "青毛", "芦": "芦毛", "白": "白毛" }[c] || "鹿毛";
}
