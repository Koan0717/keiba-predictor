// 共通ヘルパー

// ==================================================================================
// util.js — どの画面からも使う小さな道具の集まり
// ==================================================================================
// ES モジュール (export / import) なので、ビルド (バンドル) なしでブラウザがそのまま読み込める。
//
// $("#id")  … 要素を 1 つ探す (jQuery 風の短い名前)
// $$(".cls") … 要素をすべて探して「配列」で返す (forEach / map をそのまま使えるように)
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** 外部 (Wikipedia 等) 由来の文字列を HTML に入れる前に必ず通す */
// 【安全のために重要】HTML エスケープ。
// Wikipedia などの外から来た文字列をそのまま innerHTML に入れると、
// もし文字列に <script> や onerror="..." が含まれていた場合、それが実行されてしまう (XSS)。
// & < > " ' の 5 文字を &amp; などに置き換えて「ただの文字」として表示させる。
// null / undefined は空文字にする (?? "")。
export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Lucide アイコンを 1 つ表示する HTML を作る。アイコンは static/icons/sprite.svg に
// <symbol id="i-名前"> としてまとめてあり、<use href="...#i-名前"> で参照する (1 ファイルで全アイコン)。
// aria-hidden="true": 飾りなので、スクリーンリーダーには読ませない。
export const icon = (name, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="/static/icons/sprite.svg#i-${name}"/></svg>`;

// サーバーの API を呼んで JSON を返す。HTTP エラー (404 など) は例外にして、呼び出し側の catch で扱う。
// (fetch そのものは 404 でも成功扱いになるので、res.ok を自分で確認する必要がある)
// サインイン中なら Firebase の ID トークンを返す関数 (main.js の initAuth が設定する)
let tokenProvider = null;
export const setTokenProvider = fn => { tokenProvider = fn; };

export async function api(url, opts = {}) {
  const token = tokenProvider ? await tokenProvider() : null;
  const headers = { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...opts.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

// 画面下に短いメッセージを 2.4 秒だけ出す (「追加しました」など)。
// 続けて呼ばれたら前のタイマーを取り消し、最後のメッセージを 2.4 秒表示する。
let toastTimer = 0;
export function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 2400);
}

// debounce: 連続で呼ばれても、最後の呼び出しから ms ミリ秒何も来なかったときに 1 回だけ実行する。
// 検索欄で 1 文字打つたびにサーバーへ問い合わせないようにするため。
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/** Wikipedia / Commons の画像。日本語版の FilePath は Commons の画像も解決する。幅は Wikimedia の標準サイズを使う */
// Wikipedia の Special:FilePath は、ファイル名から実際の画像 URL へ転送してくれる。
// 日本語版の FilePath を使うと、日本語版にある画像と Commons にある画像のどちらでも表示できる。
// width は Wikimedia が用意している標準のサムネイル幅 (250 / 330 / 500 / 960 / 1280 / 1920 など) を使う。
// 標準外の幅は生成が遅かったり拒否されたりすることがある。
export const photo = (file, width = 500) =>
  `https://ja.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
export const wikiUrl = title => `https://ja.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

// 枠番 (1〜8) → CSS 変数名 [背景色, 文字色]。実際の色は css/app.css の :root に定義してある
// (1枠 白 / 2枠 黒 / 3枠 赤 / 4枠 青 / 5枠 黄 / 6枠 緑 / 7枠 橙 / 8枠 桃)。
// 0 番目は使わないので null。
const WAKU = [null, ["--w1", "--w1t"], ["--w2", "--w2t"], ["--w3", "--w3t"], ["--w4", "--w4t"], ["--w5", "--w5t"], ["--w6", "--w6t"], ["--w7", "--w7t"], ["--w8", "--w8t"]];
/** 馬番 → 枠。外枠から順に頭数が増える JRA の枠割り (例: 18頭なら 7・8 枠が3頭) */
// 例: 18 頭立て → base = 2, rem = 2 → 1〜6 枠は 2 頭ずつ、7・8 枠は 3 頭ずつ。
//      12 頭立て → base = 1, rem = 4 → 1〜4 枠は 1 頭、5〜8 枠は 2 頭。
// 1 枠から順に「その枠までの頭数の合計 n」を数え、馬番 num が n 以下になった枠を返す。
export function wakuOf(num, count) {
  const base = Math.floor(count / 8), rem = count % 8;
  let n = 0;
  for (let w = 1; w <= 8; w++) {
    n += base + (w > 8 - rem ? 1 : 0);
    if (num <= n) return w;
  }
  return 8;
}
export function wakuBadge(num, waku) {
  const [c, t] = WAKU[waku] || WAKU[1];
  return `<span class="waku num" style="--c:var(${c});--t:var(${t})">${num}</span>`;
}
// CSS 変数の実際の色 (#d6312b など) を取り出す。3D の勝負服の色に使う (WebGL は CSS 変数を読めないため)。
export const wakuCss = waku => {
  const [c] = WAKU[waku] || WAKU[1];
  return getComputedStyle(document.documentElement).getPropertyValue(c).trim();
};

// 格付けのバッジ。GI は青、GII は赤、GIII は緑 (JRA の表記に合わせた配色)。それ以外は灰色。
export function gradeBadge(g) {
  if (!g) return "";
  const cls = /^(G|Jpn)I$/.test(g) ? "g1" : /^(G|Jpn)II$/.test(g) ? "g2" : /^(G|Jpn)III$/.test(g) ? "g3" : "other";
  return `<span class="badge ${cls}">${esc(g)}</span>`;
}

/** 毛色 → [胴, 濃, 淡, たてがみ・尾] */
// 毛色ごとの色。3D の馬のマテリアル (Main / Main_Dark / Main_Light / Hair) と、
// 写真がない馬のシルエットの両方に使う。
export const COATS = {
  "鹿毛": ["#5a3220", "#3b2015", "#7a4a2c", "#141010"],
  "栗毛": ["#8c4a1e", "#6b3714", "#a8642d", "#9b5a2a"],
  "栃栗毛": ["#5c2c12", "#40200c", "#72381a", "#6e3a1c"],
  "黒鹿毛": ["#3a2318", "#24150e", "#4e3020", "#0d0b0a"],
  "青鹿毛": ["#22160f", "#150d09", "#2e2016", "#080808"],
  "青毛": ["#141414", "#0b0b0b", "#1e1e1e", "#050505"],
  "芦毛": ["#9c9a96", "#7a7874", "#bdbbb6", "#6b6966"],
  "白毛": ["#eae7e1", "#d6d2ca", "#f6f4ef", "#f0eee8"],
};
// Wikipedia の毛色は "栗毛（尾花栗毛）" や "黒鹿毛/Dark Bay" のように注釈付きのことがあるので、
// 前方一致で探す。長い名前から先に試すのは、"栃栗毛" を "栗毛" と誤判定しないため。
export function coatOf(color) {
  if (!color) return COATS["鹿毛"];
  const key = Object.keys(COATS).sort((a, b) => b.length - a.length).find(k => color.startsWith(k));
  return COATS[key] || COATS["鹿毛"];
}

/** 横向きの馬のシルエット (写真がないときと図鑑の図に使う) */
// build = 体格の太さ (1 = サラブレッド、1.45 = ばんえい馬)。脚の太さと胴の高さに掛ける。
// viewBox は 120×92 の座標系。胴 (楕円)・首 (多角形)・頭 (回転した楕円)・耳・たてがみ・尾・脚で構成。
// 前脚と後脚の 2 本目 (i % 3 != 0) は少し短くして、奥行き感を出している。
export function horseSvg(body, mane, build = 1, cls = "sil") {
  const legW = 5.5 * build, ry = 14 * build;
  const legs = [30, 40, 67, 77].map((x, i) => {
    const xx = x - (legW - 5.5) / 2, y = 50 + (i % 3 ? 2 : 0), h = 36 - (i % 3 ? 2 : 0);
    return `<rect x="${xx}" y="${y}" width="${legW}" height="${h}" rx="2.5" fill="${body}"/><rect x="${xx}" y="83" width="${legW}" height="4" rx="1.5" fill="#1b1b1b" opacity=".7"/>`;
  }).join("");
  return `<svg class="${cls}" viewBox="0 0 120 92" aria-hidden="true" style="width:100%;height:100%;stroke:none">
    <ellipse cx="58" cy="89" rx="40" ry="2.5" class="sil-shadow"/>
    <path d="M24 38 C10 42 8 62 13 76 C17 64 19 52 27 45 Z" fill="${mane}"/>${legs}
    <ellipse cx="55" cy="46" rx="33" ry="${ry}" fill="${body}"/>
    <polygon points="72,40 84,16 96,20 90,48" fill="${body}"/>
    <ellipse cx="97" cy="25" rx="12" ry="6" transform="rotate(32 97 25)" fill="${body}"/>
    <polygon points="85,15 87,6 91,14" fill="${body}"/>
    <path d="M84 15 L72 40 L78 41 L89 19 Z" fill="${mane}"/>
    <circle cx="94" cy="21" r="1.4" fill="#111"/></svg>`;
}

// 万円 → 表示用 (10000 万円以上は「◯億円」)。
export const fmtYen = man => man == null ? "" : man >= 10000 ? `${(man / 10000).toFixed(man >= 100000 ? 1 : 2)}億円` : `${man.toLocaleString()}万円`;

/** 着差 (秒差と速度から馬身に換算。1 馬身 ≒ 2.4m) */
// JRA の着差表記に近づける: ハナ (鼻差) < アタマ < クビ < 1/4 馬身刻み < 大差 (10 馬身以上)。
// ハナ・アタマ・クビの境目 (0.08 / 0.18 / 0.35 馬身) は目安の値。
// 1 馬身以上は 1/4 単位に丸めて "1 1/4" のように表す。
export function margin(gapMeters) {
  const l = gapMeters / 2.4;
  if (l < 0.08) return "ハナ";
  if (l < 0.18) return "アタマ";
  if (l < 0.35) return "クビ";
  if (l >= 10) return "大差";
  const q = Math.round(l * 4) / 4;
  const whole = Math.floor(q), frac = { 0: "", 0.25: "1/4", 0.5: "1/2", 0.75: "3/4" }[q - whole];
  return whole ? `${whole}${frac ? " " + frac : ""}` : frac;
}

/** シード付き乱数 (mulberry32) */
// 同じ seed からは毎回同じ乱数の並びが出る乱数生成器。
// Math.random() は seed を指定できないため、「同じ条件で再現したい」場面で使う。
// mulberry32 は短くて速く、ゲームやシミュレーションには十分な品質 (暗号には使わない)。
export const seeded = seed => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
