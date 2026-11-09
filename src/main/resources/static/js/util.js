// 共通ヘルパー

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** 外部 (Wikipedia 等) 由来の文字列を HTML に入れる前に必ず通す */
export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export const icon = (name, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="/static/icons/sprite.svg#i-${name}"/></svg>`;

export async function api(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

let toastTimer = 0;
export function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 2400);
}

export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/** Wikipedia / Commons の画像。日本語版の FilePath は Commons の画像も解決する。幅は Wikimedia の標準サイズを使う */
export const photo = (file, width = 500) =>
  `https://ja.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
export const wikiUrl = title => `https://ja.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

const WAKU = [null, ["--w1", "--w1t"], ["--w2", "--w2t"], ["--w3", "--w3t"], ["--w4", "--w4t"], ["--w5", "--w5t"], ["--w6", "--w6t"], ["--w7", "--w7t"], ["--w8", "--w8t"]];
/** 馬番 → 枠。外枠から順に頭数が増える JRA の枠割り (例: 18頭なら 7・8 枠が3頭) */
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
export const wakuCss = waku => {
  const [c] = WAKU[waku] || WAKU[1];
  return getComputedStyle(document.documentElement).getPropertyValue(c).trim();
};

export function gradeBadge(g) {
  if (!g) return "";
  const cls = /^(G|Jpn)I$/.test(g) ? "g1" : /^(G|Jpn)II$/.test(g) ? "g2" : /^(G|Jpn)III$/.test(g) ? "g3" : "other";
  return `<span class="badge ${cls}">${esc(g)}</span>`;
}

/** 毛色 → [胴, 濃, 淡, たてがみ・尾] */
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
export function coatOf(color) {
  if (!color) return COATS["鹿毛"];
  const key = Object.keys(COATS).sort((a, b) => b.length - a.length).find(k => color.startsWith(k));
  return COATS[key] || COATS["鹿毛"];
}

/** 横向きの馬のシルエット (写真がないときと図鑑の図に使う) */
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

export const fmtYen = man => man == null ? "" : man >= 10000 ? `${(man / 10000).toFixed(man >= 100000 ? 1 : 2)}億円` : `${man.toLocaleString()}万円`;

/** 着差 (秒差と速度から馬身に換算。1 馬身 ≒ 2.4m) */
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
export const seeded = seed => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
