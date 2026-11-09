import { $, $$, esc, icon, api, toast, debounce, photo, wikiUrl, wakuOf, wakuBadge, wakuCss, gradeBadge, coatOf, horseSvg, fmtYen, seeded } from "./util.js";

const state = {
  courses: [],
  weather: new Map(),
  user: null,
  engines: { c: null, zig: null, odin: null },
  race: null,           // レース予想で表示中の分析
  raceSort: "num",
  mcPace: 1.0,
  horses: { offset: 0, total: 0, loading: false },
  catalog: { offset: 0, total: 0 },
  field: [],            // シミュレーションの出走馬
  sim: null,
  simReady: null,
};
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const STYLE_NAMES = ["逃げ", "先行", "差し", "追込"];

/* ============================================================
   起動: 発馬ゲートの演出
   ============================================================ */
function splash() {
  const el = $("#splash"), bar = $("#splash-bar"), status = $("#splash-status");
  const gate = $("#gate");
  gate.innerHTML = Array.from({ length: 8 }, (_, i) =>
    `<div class="stall" data-n="${i + 1}" style="--c:var(--w${i + 1});--t:var(--w${i + 1}t)"><div class="door l"></div><div class="door r"></div></div>`).join("");
  const started = performance.now();
  let total = 0, done = 0, closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    $$(".stall", gate).forEach((s, i) => $$(".door", s).forEach(d => (d.style.transitionDelay = `${i * 45}ms`)));
    el.classList.add("open");
    requestAnimationFrame(() => el.classList.add("leave"));
    document.body.classList.add("ready");
    setTimeout(() => el.remove(), reduceMotion ? 50 : 1400);
  };
  $("#splash-skip").addEventListener("click", close);
  addEventListener("keydown", e => e.key === "Escape" && close(), { once: true });
  return {
    track(label, promise) {
      total++;
      return promise.finally(() => {
        done++;
        bar.style.width = `${(done / total) * 100}%`;
        status.textContent = label;
      });
    },
    finish() {
      setTimeout(close, Math.max(0, (reduceMotion ? 0 : 1900) - (performance.now() - started)));
    },
  };
}

/* ============================================================
   ルーティング (#/view)
   ============================================================ */
const views = {};
function route() {
  const name = (location.hash.match(/^#\/(\w+)/) || [])[1] || "home";
  const target = $(`#view-${name}`) ? name : "home";
  $$(".view").forEach(v => v.classList.toggle("on", v.id === `view-${target}`));
  $$("#nav a").forEach(a => a.classList.toggle("on", a.dataset.view === target));
  movePill();
  state.sim?.setVisible(target === "sim");
  if (!views[target]?.loaded) { views[target] = { loaded: true }; init[target]?.(); }
  if (target !== "sim") window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "instant" });
}
function movePill() {
  const a = $("#nav a.on"), pill = $("#nav-pill");
  if (!a) return;
  pill.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
  pill.style.width = `${a.offsetWidth}px`;
  pill.style.height = `${a.offsetHeight}px`;
}

/* ============================================================
   テーマ
   ============================================================ */
function setTheme(mode) {
  try { mode === "auto" ? localStorage.removeItem("kv-theme") : localStorage.setItem("kv-theme", mode); } catch (_) {}
  const next = mode === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
  const apply = () => { document.documentElement.dataset.theme = next; state.sim?.applyTheme(); syncThemeSeg(); };
  if (document.startViewTransition && !reduceMotion && next !== document.documentElement.dataset.theme) document.startViewTransition(apply);
  else apply();
}
function syncThemeSeg() {
  let saved = null;
  try { saved = localStorage.getItem("kv-theme"); } catch (_) {}
  $$("#theme-seg button").forEach(b => b.classList.toggle("on", b.dataset.themeSet === (saved || "auto")));
}

/* ============================================================
   WebAssembly エンジン (C / Zig / Odin)
   ============================================================ */
async function loadEngines() {
  const load = async name => (await WebAssembly.instantiate(await (await fetch(`/static/wasm/${name}.wasm`)).arrayBuffer())).instance.exports;
  const [c, zig, odin] = await Promise.allSettled([load("keiba_physics"), load("montecarlo"), load("pedigree")]);
  state.engines = { c: c.value, zig: zig.value, odin: odin.value };
  const names = [["C (直線物理・期待値)", c], ["Zig (勝率シミュレーション)", zig], ["Odin (血量計算)", odin]];
  $("#engine-status").textContent = names.map(([n, r]) => `${n}: ${r.status === "fulfilled" ? "稼働中" : "読み込み失敗"}`).join(" / ");
}

/* ============================================================
   ホーム
   ============================================================ */
const COND = { FIRM: ["良", "cond-good"], GOOD: ["稍重", "cond-wet"], YIELDING: ["重", "cond-wet"], SOFT: ["不良", "cond-bad"] };
const init = {};

init.home = async () => {
  const d = new Date();
  $("#hero-date").textContent = d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  const withPhoto = state.courses.filter(c => c.image);
  const pick = withPhoto[d.getDate() % Math.max(1, withPhoto.length)];
  if (pick) {
    const img = $("#hero-img");
    img.onload = () => img.classList.add("loaded");
    img.src = photo(pick.image, 1920);
    img.alt = pick.name;
    credit([pick.image], $("#hero-credit"), pick.name);
  }
  renderWeatherGrid();
  try {
    const [st, top] = await Promise.all([api("/api/library/status"), api("/api/horses?sort=rating&photo=1&limit=12")]);
    $("#home-stats").innerHTML = [
      [st.horses.toLocaleString(), "頭の競走馬"], [st.horsesWithPhoto.toLocaleString(), "頭は写真付き"],
      [st.races.toLocaleString(), "の競走"], [st.courses, "の競馬場"],
    ].map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");
    $("#home-horses").innerHTML = top.items.map(horseCard).join("");
    bindHorseCards($("#home-horses"));
  } catch (e) { console.error(e); }
};

async function loadWeather() {
  try {
    const list = await api("/api/weather");
    list.forEach(w => state.weather.set(w.id, w));
  } catch (e) { console.warn("天気を取得できませんでした", e); }
}

function renderWeatherGrid() {
  $("#weather-grid").innerHTML = state.courses.map(c => {
    const w = state.weather.get(c.id);
    const [cond, cls] = w ? COND[w.trackCondition] : ["—", ""];
    return `<a class="wx" href="#/courses" data-course="${c.id}">
      <strong>${esc(c.short)}</strong>${icon(w?.icon || "cloud")}
      <span class="t">${w ? `${w.temperatureC.toFixed(0)}°` : "—"}</span>
      <span class="c">${w ? esc(w.description) : "取得できません"} ・ 推定 <b class="${cls}">${cond}</b></span></a>`;
  }).join("");
  $$("#weather-grid .wx").forEach(a => a.addEventListener("click", () => setTimeout(() => openCourse(a.dataset.course), 50)));
}

/* ============================================================
   写真のクレジット (作者とライセンスの表示)
   ============================================================ */
async function credit(files, el, prefix = "") {
  if (!files.length || !el) return;
  try {
    const list = await api(`/api/media?files=${encodeURIComponent(files.join("|"))}`);
    const c = list[0];
    if (!c) return;
    el.innerHTML = `${prefix ? esc(prefix) + " ・ " : ""}写真: ${esc(c.artist || "不明")} / <a href="${esc(c.pageUrl)}" target="_blank" rel="noopener">${esc(c.license || "Wikimedia Commons")}</a>`;
  } catch (_) { /* クレジット取得に失敗しても表示は続ける */ }
}

/* ============================================================
   競走馬名鑑
   ============================================================ */
function horseCard(v) {
  const h = v.horse;
  const [body, , , hair] = coatOf(h.color);
  const wins = h.bigWins.slice(0, 3).map(w => gradeBadge(w.grade)).join("");
  return `<button class="hcard" type="button" data-title="${esc(h.title)}">
    <div class="ph">${h.image ? `<img loading="lazy" alt="${esc(h.name)}" src="${photo(h.image, 500)}" onload="this.classList.add('loaded')" onerror="this.remove()">` : ""}${h.image ? "" : horseSvg(body, hair)}</div>
    <span class="rating num" title="戦績から算出した参考値">${v.rating}</span>
    <div class="body">
      <span class="name">${esc(h.name)}</span>
      <span class="meta">${[h.birthYear && `${h.birthYear}年`, h.sex, h.color, h.sire && `父 ${h.sire}`].filter(Boolean).map(esc).join(" ・ ")}</span>
      ${wins ? `<span class="wins">${wins}<span class="meta">${esc(h.bigWins[0].race)}${h.bigWins.length > 1 ? ` ほか${h.bigWins.length - 1}` : ""}</span></span>` : `<span class="meta">${esc(h.recordText.split(" / ")[0] || "")}</span>`}
    </div></button>`;
}
function bindHorseCards(root) {
  $$(".hcard", root).forEach(b => b.addEventListener("click", () => openHorse(b.dataset.title)));
}

init.horses = () => {
  const reload = debounce(() => loadHorses(true), 250);
  ["#horse-q"].forEach(s => $(s).addEventListener("input", reload));
  ["#horse-sort", "#horse-sex", "#horse-surface", "#horse-photo"].forEach(s => $(s).addEventListener("change", () => loadHorses(true)));
  $("#horse-more").addEventListener("click", () => loadHorses(false));
  loadHorses(true);
};

async function loadHorses(reset) {
  const st = state.horses;
  if (st.loading) return;
  st.loading = true;
  if (reset) { st.offset = 0; $("#horse-grid").innerHTML = Array(8).fill('<div class="skeleton"></div>').join(""); }
  const p = new URLSearchParams({
    q: $("#horse-q").value, sort: $("#horse-sort").value, sex: $("#horse-sex").value,
    surface: $("#horse-surface").value, photo: $("#horse-photo").checked ? "1" : "0", offset: st.offset, limit: 48,
  });
  try {
    const page = await api(`/api/horses?${p}`);
    st.total = page.total;
    const html = page.items.map(horseCard).join("");
    if (reset) $("#horse-grid").innerHTML = html || `<p class="empty">条件に合う馬が見つかりませんでした</p>`;
    else $("#horse-grid").insertAdjacentHTML("beforeend", html);
    bindHorseCards($("#horse-grid"));
    st.offset += page.items.length;
    $("#horse-count").textContent = `${page.total.toLocaleString()} 頭`;
    $("#horse-more").hidden = st.offset >= page.total;
  } catch (e) {
    $("#horse-grid").innerHTML = `<p class="empty">読み込めませんでした</p>`;
  } finally { st.loading = false; }
}

async function openHorse(title) {
  openSheet(`<div class="detail-photo"></div><div class="detail-body"><p class="muted">読み込み中</p></div>`);
  try {
    const { view: v, summary } = await api(`/api/horses/detail?title=${encodeURIComponent(title)}`);
    const h = v.horse;
    const [body, , , hair] = coatOf(h.color);
    const fav = state.user?.favoriteHorses?.includes(h.title);
    const facts = [
      ["生年", [h.birthYear && `${h.birthYear}年`, h.deathYear && `(${h.deathYear}年没)`].filter(Boolean).join(" ")],
      ["性・毛色", [h.sex, h.color].filter(Boolean).join(" ・ ")],
      ["血統", [h.sire && `父 ${h.sire}`, h.dam && `母 ${h.dam}`, h.damSire && `母父 ${h.damSire}`].filter(Boolean).join(" / ")],
      ["調教師", h.trainer], ["馬主", h.owner], ["生産", h.breeder], ["生国", h.country],
      ["成績", h.recordText], ["獲得賞金", h.earningsText],
      ["適性 (推定)", [v.surface !== "不明" && v.surface, v.bestDistance && `${v.bestDistance}m 前後`].filter(Boolean).join(" ・ ")],
    ].filter(([, val]) => val);
    $("#sheet-body").innerHTML = `
      <div class="detail-photo">${h.image ? `<img alt="${esc(h.name)}" src="${photo(h.image, 960)}" onerror="this.remove()">` : horseSvg(body, hair)}</div>
      ${h.image ? `<p class="credit photo-credit" id="detail-credit">${esc(h.imageCaption)}</p>` : ""}
      <div class="detail-body">
        <h2>${esc(h.name)}</h2>
        ${h.nameEn ? `<p class="en">${esc(h.nameEn)}</p>` : ""}
        <div class="meter"><b>${v.rating}</b><div class="bar"><i style="width:${v.rating}%"></i></div><span class="muted" style="font-size:12px">能力値 (参考)</span></div>
        <dl class="facts">${facts.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join("")}</dl>
        ${h.bigWins.length ? `<h3 style="margin-bottom:10px">主な勝ち鞍</h3><ul class="wins-list">${h.bigWins.map(w => `<li>${gradeBadge(w.grade)}${esc(w.race)}</li>`).join("")}</ul>` : ""}
        ${summary ? `<p class="summary">${esc(summary)}</p><p class="fine">出典: <a href="${wikiUrl(h.title)}" target="_blank" rel="noopener">Wikipedia「${esc(h.title)}」</a> (CC BY-SA 4.0)</p>` : ""}
        <div class="btn-row" style="margin-top:18px">
          <button class="btn primary small" id="add-to-sim" type="button">${icon("plus")}シミュレーションに追加</button>
          <button class="btn ghost small star ${fav ? "on" : ""}" id="fav-btn" type="button">${icon("star")}${fav ? "お気に入り済み" : "お気に入り"}</button>
          <a class="btn ghost small" href="${wikiUrl(h.title)}" target="_blank" rel="noopener">${icon("external-link")}Wikipedia</a>
        </div>
      </div>`;
    if (h.image) credit([h.image], $("#detail-credit"), h.imageCaption);
    $("#add-to-sim").addEventListener("click", () => { addToField(v); closeSheet(); location.hash = "#/sim"; });
    $("#fav-btn").addEventListener("click", () => toggleFavorite(h.title));
  } catch (e) {
    $("#sheet-body").innerHTML = `<div class="detail-body"><p class="muted">読み込めませんでした</p></div>`;
  }
}

function openSheet(html) {
  $("#sheet-body").innerHTML = html;
  const s = $("#sheet");
  s.hidden = false;
  requestAnimationFrame(() => s.classList.add("on"));
  $(".sheet-close", s).focus({ preventScroll: true });
}
function closeSheet() {
  const s = $("#sheet");
  s.classList.remove("on");
  setTimeout(() => (s.hidden = true), 400);
}

/* ============================================================
   競馬場
   ============================================================ */
init.courses = () => {
  renderCourses("");
  $$("#course-filter button").forEach(b => b.addEventListener("click", () => {
    $$("#course-filter button").forEach(x => x.classList.toggle("on", x === b));
    renderCourses(b.dataset.cat);
  }));
};
function renderCourses(cat) {
  $("#course-grid").innerHTML = state.courses.filter(c => !cat || c.category === cat).map(c => {
    const w = state.weather.get(c.id);
    return `<button class="ccard" type="button" data-id="${c.id}">
      <div class="ph">${c.image ? `<img loading="lazy" alt="${esc(c.name)}" src="${photo(c.image, 500)}" onerror="this.remove()">` : ""}
        <span class="tag">${esc(c.category)}</span>
        ${w ? `<span class="wxs">${icon(w.icon)}${w.temperatureC.toFixed(0)}°</span>` : ""}</div>
      <div class="body"><h3>${esc(c.name)}</h3>
        <div class="specs"><span>${esc(c.region)}</span><span>${c.turn === "直線" ? "直線" : `${esc(c.turn)}回り`}</span><span>直線 <b>${c.straightMeters}</b>m</span></div></div>
    </button>`;
  }).join("");
  $$("#course-grid .ccard").forEach(b => b.addEventListener("click", () => openCourse(b.dataset.id)));
}

function courseSvg(c) {
  const W = 320, cx = W / 2, cy = 70;
  if (c.turn === "直線") {
    return `<svg class="course-svg" viewBox="0 0 ${W} 110" role="img" aria-label="${esc(c.name)} 直線コース">
      <rect x="20" y="40" width="280" height="30" rx="4" class="dirt"/><line x1="40" y1="55" x2="290" y2="55" class="straight"/>
      <line x1="290" y1="34" x2="290" y2="76" class="goal"/><text x="290" y="92" text-anchor="middle">ゴール</text>
      <text x="40" y="92">スタート (直線 200m・障害2か所)</text></svg>`;
  }
  const rx = 95 + Math.min(1, c.straightMeters / 660) * 50, ry = 42;
  const left = c.turn === "左";
  const x1 = cx - rx * 0.55, x2 = cx + rx * 0.55, y = cy + ry;
  const [from, to] = left ? [x2, x1] : [x1, x2];
  const prof = c.elevationProfile || [];
  const pMax = Math.max(...prof, 1), px = i => 20 + (i / Math.max(1, prof.length - 1)) * (W - 40), py = v => 200 - (v / pMax) * 26;
  const line = prof.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
  return `<svg class="course-svg" viewBox="0 0 ${W} ${prof.length ? 210 : 140}" role="img" aria-label="${esc(c.name)} ${esc(c.turn)}回り 直線${c.straightMeters}m">
    <ellipse cx="${cx}" cy="${cy}" rx="${rx + 9}" ry="${ry + 9}" class="outer"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="${c.surfaces.includes("芝") ? "turf" : "dirt"}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx - 14}" ry="${ry - 12}" class="inner"/>
    <line x1="${from}" y1="${y + 4}" x2="${to}" y2="${y + 4}" class="straight"/>
    <line x1="${to}" y1="${y - 8}" x2="${to}" y2="${y + 14}" class="goal"/>
    <text x="${to}" y="${y + 26}" text-anchor="middle">ゴール</text>
    <text x="${cx}" y="${cy + 4}" text-anchor="middle">${esc(c.turn)}回り ・ 直線 ${c.straightMeters}m</text>
    ${prof.length ? `<path d="${line} L${px(prof.length - 1)} 202 L${px(0)} 202 Z" class="elev-fill"/><path d="${line}" class="elev"/><text x="20" y="165">高低差 (向こう正面→ゴール、模式)</text>` : ""}
  </svg>`;
}

async function openCourse(id) {
  const c = state.courses.find(x => x.id === id);
  if (!c) return;
  const w = state.weather.get(c.id);
  openSheet(`<div class="course-detail">
    <div class="detail-photo">${c.image ? `<img alt="${esc(c.name)}" src="${photo(c.image, 960)}" onerror="this.remove()">` : ""}</div>
    ${c.image ? `<p class="credit photo-credit" id="course-credit"></p>` : ""}
    <div class="detail-body">
      <p class="eyebrow">${esc(c.category)} ・ ${esc(c.region)}</p>
      <h2>${esc(c.name)}</h2>
      ${courseSvg(c)}
      <dl class="facts">
        <dt>主催</dt><dd>${esc(c.organizer)}</dd>
        <dt>コース</dt><dd>${esc(c.surfaces)} ・ ${c.turn === "直線" ? "直線" : esc(c.turn) + "回り"}</dd>
        <dt>最後の直線</dt><dd class="num">${c.straightMeters}m (参考値)</dd>
        ${w ? `<dt>現在の天気</dt><dd>${esc(w.description)} ${w.temperatureC.toFixed(1)}℃ ・ 風 ${w.windKmh.toFixed(0)}km/h ・ 推定 ${COND[w.trackCondition][0]}</dd>` : ""}
        <dt>特徴</dt><dd>${esc(c.note)}</dd>
      </dl>
      <div class="btn-row">
        <button class="btn primary small" id="course-sim" type="button">${icon("rotate-3d")}このコースで走らせる</button>
        <button class="btn ghost small" id="course-live" type="button">${icon("tv")}中継</button>
        <a class="btn ghost small" href="${esc(c.website)}" target="_blank" rel="noopener">${icon("external-link")}公式サイト</a>
      </div>
      <h3 style="margin:24px 0 8px">この競馬場の主な競走</h3>
      <div id="course-races"><p class="muted">読み込み中</p></div>
    </div></div>`);
  if (c.image) credit([c.image], $("#course-credit"));
  $("#course-sim").addEventListener("click", () => { closeSheet(); presetSim({ course: c.id }); location.hash = "#/sim"; });
  $("#course-live").addEventListener("click", () => { closeSheet(); location.hash = "#/live"; setTimeout(() => playLive(c.id), 100); });
  try {
    const page = await api(`/api/catalog/races?course=${encodeURIComponent(c.name)}&limit=40`);
    $("#course-races").innerHTML = page.items.length
      ? `<ul class="wins-list">${page.items.map(r => `<li>${gradeBadge(r.grade)}<a href="${wikiUrl(r.title)}" target="_blank" rel="noopener">${esc(r.name)}</a><span class="muted">${esc(r.surface)} ${r.distance ?? ""}${r.distance ? "m" : ""}</span></li>`).join("")}</ul>`
      : `<p class="muted">記事のある競走は見つかりませんでした</p>`;
  } catch (_) { $("#course-races").innerHTML = ""; }
}

/* ============================================================
   競走一覧
   ============================================================ */
init.catalog = () => {
  $("#catalog-course").insertAdjacentHTML("beforeend", state.courses.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join(""));
  $("#catalog-q").addEventListener("input", debounce(() => loadCatalog(true)));
  ["#catalog-course", "#catalog-grade", "#catalog-surface"].forEach(s => $(s).addEventListener("change", () => loadCatalog(true)));
  $("#catalog-more").addEventListener("click", () => loadCatalog(false));
  loadCatalog(true);
};
async function loadCatalog(reset) {
  const st = state.catalog;
  if (reset) st.offset = 0;
  const p = new URLSearchParams({ q: $("#catalog-q").value, course: $("#catalog-course").value, grade: $("#catalog-grade").value, surface: $("#catalog-surface").value, offset: st.offset, limit: 100 });
  const page = await api(`/api/catalog/races?${p}`);
  const rows = page.items.map(r => `<tr>
    <td>${gradeBadge(r.grade)}</td>
    <td><a href="${wikiUrl(r.title)}" target="_blank" rel="noopener"><strong>${esc(r.name)}</strong></a>${r.nameEn ? `<span class="sub">${esc(r.nameEn)}</span>` : ""}</td>
    <td>${esc(r.course.replace("競馬場", "")) || "—"}</td>
    <td class="num">${esc(r.surface)} ${r.distance ? r.distance + "m" : ""}</td>
    <td class="num">${esc(r.prize)}</td>
    <td>${simButtonFor(r)}</td></tr>`).join("");
  const head = `<thead><tr><th>格付け</th><th>競走名</th><th>競馬場</th><th>コース</th><th>1着賞金</th><th></th></tr></thead>`;
  if (reset) $("#catalog-table").innerHTML = head + `<tbody>${rows}</tbody>`;
  else $("#catalog-table tbody").insertAdjacentHTML("beforeend", rows);
  st.offset += page.items.length;
  $("#catalog-count").textContent = `${page.total.toLocaleString()} 競走`;
  $("#catalog-more").hidden = st.offset >= page.total;
  $$("#catalog-table [data-sim]").forEach(b => (b.onclick = () => {
    presetSim({ course: b.dataset.course, distance: +b.dataset.distance || undefined, surface: b.dataset.surface || undefined });
    location.hash = "#/sim";
  }));
}
function simButtonFor(r) {
  const c = state.courses.find(x => r.course.startsWith(x.name));
  if (!c) return "";
  return `<button class="btn ghost small" type="button" data-sim data-course="${c.id}" data-distance="${r.distance || ""}" data-surface="${r.surface.includes("ダート") ? "ダート" : r.surface.includes("芝") ? "芝" : ""}" title="この条件で3Dシミュレーション">${icon("rotate-3d")}</button>`;
}

/* ============================================================
   レース予想 (サンプルの出馬表)
   ============================================================ */
init.races = async () => {
  const races = await api("/api/races");
  $("#race-tabs").innerHTML = races.map((r, i) => `<button type="button" data-id="${r.id}" class="${i ? "" : "on"}">${esc(r.name.replace(/\s*\(.*\)/, ""))}</button>`).join("");
  $$("#race-tabs button").forEach(b => b.addEventListener("click", () => {
    $$("#race-tabs button").forEach(x => x.classList.toggle("on", x === b));
    loadRace(b.dataset.id);
  }));
  $$("#mc-pace button").forEach(b => b.addEventListener("click", () => {
    $$("#mc-pace button").forEach(x => x.classList.toggle("on", x === b));
    state.mcPace = +b.dataset.pace;
    renderMonteCarlo();
  }));
  $$("#table-sort button").forEach(b => b.addEventListener("click", () => {
    $$("#table-sort button").forEach(x => x.classList.toggle("on", x === b));
    state.raceSort = b.dataset.sort;
    renderEntries();
  }));
  $("#race-to-sim").addEventListener("click", raceToSim);
  $("#note-open").addEventListener("click", openNote);
  if (races[0]) loadRace(races[0].id);
};

const STYLE_CODE = { NIGE: 0, SENKO: 1, SASHI: 2, OIKOMI: 3 };
const TRAINING = { "S": 1.0, "A+": 0.9, "A": 0.8, "B": 0.65, "C": 0.5 };

async function loadRace(id) {
  const a = state.race = await api(`/api/races/${id}/analysis`);
  const r = a.race, w = r.weather;
  $("#race-hero").innerHTML = `<div>
      <div class="race-meta">${gradeBadge(r.grade === "G1" ? "GI" : r.grade)}<span>${esc(r.racecourse)}</span><span>${r.courseType === "TURF" ? "芝" : "ダート"} ${r.distanceMeters}m</span><span>${esc(r.turnDirection)}</span><span class="num">発走 ${esc(r.postTime)}</span></div>
      <h2>${esc(r.name)}</h2><p class="muted">${esc(r.subtitle)}</p>
      <div class="race-facts"><div>1着賞金<b>${(r.prizeFirstYen / 1e8).toFixed(0)}億円</b></div><div>出走<b>${r.horses.length}頭</b></div><div>想定ペース<b>${esc(a.paceForecast)}</b></div></div>
    </div>
    ${w ? `<div class="wx-box">${icon(w.weatherIcon)}<div><b>${w.temperatureC.toFixed(1)}°</b><span class="muted">${esc(w.weatherDescription)} ・ 推定 ${COND[r.condition][0]}${w.isLive ? "" : " (推定値)"}</span></div></div>` : ""}`;
  $("#bets").innerHTML = a.betRecommendations.map(b => `<div class="bet"><span class="type">${esc(b.betType)}</span><span class="combo">${esc(b.combination)}</span><span class="alloc">${b.allocationPercent}%</span><p>${esc(b.reason)} ・ 想定 ${b.oddsEstimate}倍</p></div>`).join("");
  renderMonteCarlo();
  renderEntries();
}

function renderMonteCarlo() {
  const z = state.engines.zig, a = state.race;
  if (!a) return;
  if (!z) { $("#mc").innerHTML = `<p class="muted">計算エンジン (Zig) を読み込めませんでした</p>`; return; }
  const list = a.race.horses.slice(0, 18);
  list.forEach((h, i) => z.set_horse(i, h.speedIndex, TRAINING[h.trainingScore] ?? 0.7, STYLE_CODE[h.runningStyle] ?? 2));
  const t0 = performance.now();
  z.simulate(list.length, 100000, state.mcPace, 20261109);
  const ms = performance.now() - t0;
  const rows = list.map((h, i) => ({ h, w: z.win_rate(i), p: z.place_rate(i) })).sort((x, y) => y.w - x.w);
  const max = Math.max(...rows.map(r => r.p), 1);
  $("#mc").innerHTML = rows.map(r => `<div class="mc-row">${wakuBadge(r.h.horseNumber, r.h.postPosition)}<span class="n">${esc(r.h.name)}</span>
    <div class="mc-track"><i class="p" style="width:${(r.p / max) * 100}%"></i><i class="w" style="width:${(r.w / max) * 100}%"></i></div>
    <span class="v">${r.w.toFixed(1)}%<small>${r.p.toFixed(1)}%</small></span></div>`).join("");
  $("#mc-meta").textContent = `100,000 回の計算に ${ms.toFixed(0)} ms (Zig → WebAssembly)`;
}

function renderEntries() {
  const a = state.race;
  if (!a) return;
  const c = state.engines.c;
  const pred = new Map(a.predictions.map(p => [p.horseNumber, p]));
  const rows = a.race.horses.map(h => {
    const p = pred.get(h.horseNumber);
    const ev = c && p ? c.calculate_ev_index(h.odds, p.winProbability) : p?.expectedValueScore ?? 0;
    return { h, p, ev };
  });
  const by = { num: (x, y) => x.h.horseNumber - y.h.horseNumber, score: (x, y) => (y.p?.totalScore ?? 0) - (x.p?.totalScore ?? 0), odds: (x, y) => x.h.odds - y.h.odds, ev: (x, y) => y.ev - x.ev };
  rows.sort(by[state.raceSort]);
  const markColor = m => ({ "◎": "var(--danger)", "◯": "var(--g1)", "▲": "var(--warn)", "☆": "var(--accent)" })[m] || "var(--ink-3)";
  $("#entry-table").innerHTML = `<thead><tr><th></th><th>馬番</th><th>印</th><th>馬名</th><th>性齢・斤量</th><th>騎手</th><th>単勝</th><th>指数</th><th>脚質</th><th>評価</th></tr></thead><tbody>${rows.map(({ h, p, ev }) => {
    const fav = state.user?.favoriteHorses?.includes(h.name);
    return `<tr>
      <td><button class="star ${fav ? "on" : ""}" type="button" data-fav="${esc(h.name)}" aria-label="お気に入り">${icon("star")}</button></td>
      <td>${wakuBadge(h.horseNumber, h.postPosition)}</td>
      <td class="mark" style="color:${markColor(p?.mark)}">${esc(p?.mark || "")}</td>
      <td><strong>${esc(h.name)}</strong><span class="sub">${esc(h.sire)} × ${esc(h.damSire)}</span></td>
      <td>${esc(h.sexAge)} ・ <span class="num">${h.weightCarry}</span><span class="sub num">${h.horseWeight}kg (${h.weightDiff >= 0 ? "+" : ""}${h.weightDiff})</span></td>
      <td>${esc(h.jockey)}<span class="sub">${esc(h.trainer)}</span></td>
      <td class="num"><strong>${h.odds}</strong><span class="sub">${h.popularity}番人気</span></td>
      <td class="num">${h.speedIndex}</td>
      <td>${STYLE_NAMES[STYLE_CODE[h.runningStyle]] || ""}</td>
      <td><div class="num" style="display:flex;justify-content:space-between;gap:8px;font-size:12px"><strong>${p ? p.totalScore : "-"}</strong><span class="muted">妙味 ${ev.toFixed(0)}</span></div><div class="bar"><i style="width:${p ? p.totalScore : 0}%"></i></div></td>
    </tr>`;
  }).join("")}</tbody>`;
  $$("#entry-table [data-fav]").forEach(b => b.addEventListener("click", () => toggleFavorite(b.dataset.fav)));
}

const COURSE_BY_SHORT = s => state.courses.find(c => c.short === s);

async function raceToSim() {
  const r = state.race?.race;
  if (!r) return;
  const course = COURSE_BY_SHORT(r.racecourse);
  // 名鑑にいれば毛色・写真を使う
  const looked = await Promise.all(r.horses.map(h => api(`/api/horses?q=${encodeURIComponent(h.name)}&limit=5&photo=0`).then(p => p.items.find(v => v.horse.name === h.name)).catch(() => null)));
  state.field = r.horses.slice(0, 18).map((h, i) => ({
    key: h.name, name: h.name, title: looked[i]?.horse.title,
    coat: looked[i]?.horse.color || "鹿毛",
    rating: Math.round(55 + (h.speedIndex - 100) * 2), speed: h.speedIndex,
    style: STYLE_CODE[h.runningStyle] ?? 2, stamina: TRAINING[h.trainingScore] ?? 0.7,
  }));
  presetSim({ course: course?.id, distance: r.distanceMeters, surface: r.courseType === "TURF" ? "芝" : "ダート", pace: a2pace(state.race.paceForecast) });
  location.hash = "#/sim";
}
const a2pace = s => (s === "ハイペース" ? "1.2" : s === "スローペース" ? "0.8" : "1.0");

/* ============================================================
   3D シミュレーション
   ============================================================ */
function defaultStyle(v) {
  const d = v.bestDistance;
  if (d && d < 1500) return 1;
  if (d && d > 2300) return 2;
  let hsh = 0;
  for (const ch of v.horse.title) hsh = (hsh * 31 + ch.charCodeAt(0)) | 0;
  const x = Math.abs(hsh) % 100;
  return x < 12 ? 0 : x < 52 ? 1 : x < 85 ? 2 : 3;
}
function addToField(v) {
  if (state.field.length >= 18) { toast("出走できるのは18頭までです"); return; }
  if (state.field.some(f => f.title === v.horse.title)) { toast(`${v.horse.name} はすでに出走表にいます`); return; }
  state.field.push({
    key: v.horse.title, title: v.horse.title, name: v.horse.name, coat: v.horse.color,
    rating: v.rating, surface: v.surface, bestDistance: v.bestDistance, style: defaultStyle(v), stamina: 0.8,
  });
  renderField();
  toast(`${v.horse.name} を追加しました`);
}

function renderField() {
  const n = state.field.length;
  $("#sim-count").textContent = `${n} / 18`;
  $("#sim-field").innerHTML = state.field.map((f, i) => `<li>
    ${wakuBadge(i + 1, wakuOf(i + 1, n))}<span class="nm" title="${esc(f.name)}">${esc(f.name)}</span>
    <select data-style="${i}" aria-label="${esc(f.name)} の脚質">${STYLE_NAMES.map((s, k) => `<option value="${k}" ${k === f.style ? "selected" : ""}>${s}</option>`).join("")}</select>
    <button type="button" data-remove="${i}" aria-label="外す">${icon("x")}</button></li>`).join("") || `<li class="muted" style="grid-template-columns:1fr">まだ出走馬がいません</li>`;
  $$("#sim-field [data-style]").forEach(s => s.addEventListener("change", () => { state.field[+s.dataset.style].style = +s.value; prepareSim(); }));
  $$("#sim-field [data-remove]").forEach(b => b.addEventListener("click", () => { state.field.splice(+b.dataset.remove, 1); renderField(); prepareSim(); }));
  $("#sim-start").disabled = n < 2;
}

function presetSim(preset = {}) {
  if (!$("#sim-course").options.length) { state.preset = preset; return; } // シミュレーション画面の初期化後に適用
  const { course, distance, surface, pace } = preset;
  if (course) $("#sim-course").value = course;
  if (distance) $("#sim-distance").value = distance;
  if (surface) $("#sim-surface").value = surface;
  if (pace) $("#sim-pace").value = pace;
  renderField();
  prepareSim();
}

/** 能力値と、距離・馬場の向き不向きから Zig に渡す「スピード」を作る */
function effectiveSpeed(f, distance, surface) {
  if (f.speed) return f.speed;
  let s = 70 + f.rating * 0.5;
  if (f.surface && f.surface !== "不明" && !f.surface.includes(surface)) s -= 4;
  if (f.bestDistance) s -= Math.min(6, Math.abs(distance - f.bestDistance) / 250);
  return s;
}

let prepareToken = 0;
async function prepareSim() {
  if (!state.sim) return;
  const token = ++prepareToken;
  await state.simReady;
  if (token !== prepareToken || state.field.length < 2) return;
  const course = state.courses.find(c => c.id === $("#sim-course").value) || state.courses[0];
  const distance = Math.max(200, Math.min(4000, +$("#sim-distance").value || 2000));
  const surface = $("#sim-surface").value;
  const pace = +$("#sim-pace").value;
  const z = state.engines.zig;
  const n = state.field.length;
  const seed = (Math.random() * 2 ** 31) | 0;
  let scores;
  if (z) {
    state.field.forEach((f, i) => z.set_horse(i, effectiveSpeed(f, distance, surface), f.stamina ?? 0.8, f.style));
    z.race_once(n, pace, seed);
    scores = state.field.map((_, i) => z.race_score(i));
  } else {
    const rnd = seeded(seed);
    scores = state.field.map(f => effectiveSpeed(f, distance, surface) / 100 + (rnd() - 0.5) * 0.2);
  }
  const field = state.field.map((f, i) => {
    const waku = wakuOf(i + 1, n);
    return { name: f.name, coat: f.coat, style: f.style, num: i + 1, waku, silk: wakuCss(waku) || "#ffffff" };
  });
  state.sim.setup({ course, distance, surface, field, scores });
  $("#sim-result").hidden = true;
  $("#sim-hud").hidden = false;
  $("#hud-course").textContent = `${course.short} ${course.category === "ばんえい" ? "ばんえい 200m" : `${surface}${distance}m`}`;
  updateHud({ order: field.map((_, i) => i), remain: course.category === "ばんえい" ? 200 : distance, t: 0 });
}

let hudAt = 0;
function updateHud({ order, remain, t }, force) {
  const now = performance.now();
  if (!force && now - hudAt < 120) return;
  hudAt = now;
  const n = state.field.length;
  $("#hud-remain").textContent = remain > 0 ? `残り ${Math.ceil(remain / 10) * 10}m` : "ゴール";
  $("#hud-clock").textContent = `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
  $("#hud-order").innerHTML = order.slice(0, 18).map((i, k) => `<li><span class="pos">${k + 1}</span>${wakuBadge(i + 1, wakuOf(i + 1, n))}<span class="nm">${esc(state.field[i]?.name || "")}</span></li>`).join("");
}

function showResult(results) {
  $("#sim-result").innerHTML = `<h3>結果</h3><ol class="result-list">${results.map((r, k) => `<li><span class="pos">${k + 1}</span>${wakuBadge(r.num, r.waku)}<span>${esc(r.name)}</span><span class="gap">${k === 0 ? `${Math.floor(r.time / 60)}:${(r.time % 60).toFixed(1).padStart(4, "0")}` : esc(r.margin)}</span></li>`).join("")}</ol>
    <div class="btn-row"><button class="btn primary small" id="sim-again" type="button">${icon("refresh-cw")}もう一度 (別の展開)</button><button class="btn ghost small" id="sim-replay" type="button">${icon("rotate-ccw")}リプレイ</button></div>`;
  $("#sim-result").hidden = false;
  $("#sim-again").onclick = async () => { await prepareSim(); state.sim.start(); };
  $("#sim-replay").onclick = () => { $("#sim-result").hidden = true; state.sim.start(); };
}

init.sim = async () => {
  $("#sim-course").innerHTML = ["中央", "地方", "ばんえい"].map(cat => `<optgroup label="${cat}">${state.courses.filter(c => c.category === cat).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</optgroup>`).join("");
  $("#sim-course").value = "tokyo";
  if (state.preset) { const p = state.preset; state.preset = null; if (p.course) $("#sim-course").value = p.course; if (p.distance) $("#sim-distance").value = p.distance; if (p.surface) $("#sim-surface").value = p.surface; if (p.pace) $("#sim-pace").value = p.pace; }
  ["#sim-course", "#sim-distance", "#sim-surface", "#sim-pace"].forEach(s => $(s).addEventListener("change", prepareSim));
  $("#sim-course").addEventListener("change", () => {
    const c = state.courses.find(x => x.id === $("#sim-course").value);
    if (c && !c.surfaces.includes("芝")) $("#sim-surface").value = "ダート";
  });
  $("#sim-start").addEventListener("click", () => { $("#sim-result").hidden = true; state.sim.start(); });
  $("#sim-clear").addEventListener("click", () => { state.field = []; renderField(); });
  $("#sim-auto").addEventListener("click", autoField);
  $$("#sim-cams [data-cam]").forEach(b => b.addEventListener("click", () => {
    $$("#sim-cams [data-cam]").forEach(x => x.classList.toggle("on", x === b));
    state.sim.setCamera(b.dataset.cam);
  }));
  $$("#sim-cams [data-speed]").forEach(b => b.addEventListener("click", () => {
    $$("#sim-cams [data-speed]").forEach(x => x.classList.toggle("on", x === b));
    state.sim.setSpeed(+b.dataset.speed);
  }));
  setupSuggest();
  renderField();

  const { RaceSim } = await import("./sim3d.js");
  state.sim = new RaceSim($("#sim-canvas"), {
    onFrame: f => updateHud(f),
    onFinish: r => { updateHud({ order: r.map(x => x.index), remain: 0, t: r[r.length - 1].time }, true); showResult(r); },
    onLost: () => { $("#sim-loading").textContent = "3D 描画が中断されました。ページを再読み込みしてください"; $("#sim-loading").classList.remove("done"); },
  });
  state.sim.setVisible(true);
  state.simReady = state.sim.init().then(() => $("#sim-loading").classList.add("done")).catch(e => {
    console.error(e);
    $("#sim-loading").textContent = "3D を表示できませんでした (WebGL に対応したブラウザが必要です)";
  });
  if (state.field.length < 2) await autoField();
  else prepareSim();
};

async function autoField() {
  const surface = $("#sim-surface").value;
  const page = await api(`/api/horses?sort=rating&surface=${encodeURIComponent(surface)}&limit=80`);
  const rnd = seeded(Date.now() & 0xffff);
  const pool = page.items.slice();
  state.field = [];
  while (state.field.length < 14 && pool.length) {
    const v = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    state.field.push({ key: v.horse.title, title: v.horse.title, name: v.horse.name, coat: v.horse.color, rating: v.rating, surface: v.surface, bestDistance: v.bestDistance, style: defaultStyle(v), stamina: 0.8 });
  }
  renderField();
  prepareSim();
}

function setupSuggest() {
  const input = $("#sim-search"), list = $("#sim-suggest");
  let items = [], active = -1;
  const show = () => {
    list.innerHTML = items.map((v, i) => `<li data-i="${i}" class="${i === active ? "on" : ""}"><span>${esc(v.horse.name)}</span><small>${esc([v.horse.birthYear, v.horse.sex, v.rating].filter(Boolean).join(" ・ "))}</small></li>`).join("");
    list.hidden = !items.length;
  };
  const pick = i => { if (items[i]) { addToField(items[i]); prepareSim(); input.value = ""; items = []; show(); } };
  input.addEventListener("input", debounce(async () => {
    const q = input.value.trim();
    if (!q) { items = []; show(); return; }
    items = (await api(`/api/horses?q=${encodeURIComponent(q)}&limit=8&sort=rating`)).items;
    active = -1;
    show();
  }, 200));
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { active = Math.min(items.length - 1, active + 1); show(); e.preventDefault(); }
    if (e.key === "ArrowUp") { active = Math.max(0, active - 1); show(); e.preventDefault(); }
    if (e.key === "Enter") { pick(active < 0 ? 0 : active); e.preventDefault(); }
    if (e.key === "Escape") { items = []; show(); }
  });
  list.addEventListener("mousedown", e => { const li = e.target.closest("li"); if (li) pick(+li.dataset.i); });
  input.addEventListener("blur", () => setTimeout(() => (list.hidden = true), 150));
}

/* ============================================================
   中継
   ============================================================ */
let liveCourse = null, liveMode = "latest"; // ライブは配信中しか映らないので、既定は最新の映像
init.live = () => {
  $("#live-grid").innerHTML = state.courses.map(c => `<button class="live-item" type="button" data-id="${c.id}">
    <span class="ic">${icon(c.youtubeChannel ? "monitor-play" : "external-link")}</span>
    <span><strong>${esc(c.name)}</strong><small>${esc(c.youtubeLabel)}</small></span></button>`).join("");
  $$("#live-grid .live-item").forEach(b => b.addEventListener("click", () => playLive(b.dataset.id)));
  $$("#player-mode button").forEach(b => b.addEventListener("click", () => {
    $$("#player-mode button").forEach(x => x.classList.toggle("on", x === b));
    liveMode = b.dataset.mode;
    if (liveCourse) playLive(liveCourse);
  }));
};
function playLive(id) {
  if (!views.live?.loaded) { views.live = { loaded: true }; init.live(); }
  const c = state.courses.find(x => x.id === id);
  if (!c) return;
  liveCourse = id;
  $$("#live-grid .live-item").forEach(b => b.classList.toggle("on", b.dataset.id === id));
  $("#player-title").textContent = c.name;
  $("#player-sub").textContent = c.youtubeLabel;
  const ch = c.youtubeChannel;
  $("#player-open").href = ch ? `https://www.youtube.com/channel/${ch}/${liveMode === "live" ? "live" : "videos"}` : c.website;
  $("#player-mode").hidden = !ch;
  if (!ch) {
    $("#player-frame").innerHTML = `<p class="player-empty">${esc(c.name)} は公式サイトでライブ配信しています。「公式で開く」からご覧ください。</p>`;
    return;
  }
  const src = liveMode === "live"
    ? `https://www.youtube.com/embed/live_stream?channel=${ch}&autoplay=1&mute=1&playsinline=1`
    : `https://www.youtube.com/embed/videoseries?list=UU${ch.slice(2)}&playsinline=1`;
  $("#player-frame").innerHTML = `<iframe src="${src}" title="${esc(c.name)} の映像" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}

/* ============================================================
   血統 / 品種と毛色 / 払戻計算 / 設定
   ============================================================ */
init.pedigree = async () => {
  ["#odin-g1", "#odin-g2"].forEach(s => $(s).addEventListener("input", renderOdin));
  renderOdin();
  const lines = await api("/api/encyclopedia/pedigree");
  $("#lineage-tree").innerHTML = lines.map(p => `<div><span class="tree-root">${esc(p.founder.replace(/\s*\(.*\)/, ""))}<small>${esc(p.name)}</small></span>
    <ul>${p.keyStallions.map((s, i) => `<li>${esc(s)}${p.representativeHorses[i] ? `<span>代表産駒 ${esc(p.representativeHorses[i])}</span>` : ""}</li>`).join("")}</ul></div>`).join("");
  $("#lineage-cards").innerHTML = lines.map(p => `<section class="card lcard"><h3>${esc(p.name)}</h3><p class="muted" style="font-size:13px">始祖 ${esc(p.founder)}</p>
    <dl><dt>芝</dt><dd>${esc(p.turfAptitude)}</dd><dt>ダート</dt><dd>${esc(p.dirtAptitude)}</dd><dt>得意距離</dt><dd>${esc(p.distanceRange)}</dd></dl>
    <p>${esc(p.characteristics)}</p><div class="chips">${p.keyStallions.map(s => `<span class="chip">${esc(s)}</span>`).join("")}</div></section>`).join("");
};
function renderOdin() {
  const g1 = parseInt($("#odin-g1").value, 10), g2 = parseInt($("#odin-g2").value, 10), o = state.engines.odin;
  const out = $("#odin-out");
  if (!(g1 >= 1 && g1 <= 12 && g2 >= 1 && g2 <= 12)) { out.innerHTML = `<p class="muted">1〜12 の整数を入れてください</p>`; return; }
  if (!o) { out.innerHTML = `<p class="muted">計算エンジン (Odin) を読み込めませんでした</p>`; return; }
  const trim = x => x.toFixed(4).replace(/\.?0+$/, "");
  const r = o.cross_rating(g1, g2);
  out.innerHTML = `<div class="big">${trim(o.blood_percent(g1, g2))}<small>%</small></div>
    <p class="lbl">${g1}×${g2} の血量 ・ 近交係数 ${trim(o.inbreeding_coefficient(g1, g2))}%</p>
    <span class="tag r${r}">${["弱いクロス", "ほどよいクロス", "濃いクロス"][r]}</span>`;
}

init.knowledge = async () => {
  const [breeds, coats] = await Promise.all([api("/api/encyclopedia/breeds"), api("/api/encyclopedia/coats")]);
  const parseCm = s => { const n = (s.match(/\d+/g) || []).map(Number); return n.length ? n.reduce((a, b) => a + b) / n.length : 0; };
  const items = [...breeds.map(b => ({ name: b.name, cm: parseCm(b.heightCm), art: horseSvg(b.bodyHex, "#2a1d14", b.build, "") })),
    { name: "人間", cm: 170, human: true, art: `<svg viewBox="0 0 40 100" style="stroke:none;fill:var(--ink-4)"><circle cx="20" cy="10" r="8"/><path d="M8 22h24l-3 38h-4l-1 38h-6l-1-38h-4z"/></svg>` }];
  const max = Math.max(...items.map(i => i.cm));
  $("#size-chart").innerHTML = items.map((it, i) => `<figure class="size-item ${it.human ? "human" : ""}"><div class="art">${it.art}</div>
    <div class="size-bar" style="height:${(it.cm / max) * 160}px;--d:${i * 50}ms">${Math.round(it.cm)}</div><figcaption>${esc(it.name)}</figcaption></figure>`).join("");
  $("#breed-grid").innerHTML = breeds.map(b => `<article class="kcard"><div class="fig">${horseSvg(b.bodyHex, "#2a1d14", b.build, "")}</div>
    <h3>${esc(b.name)}</h3><p class="spec">${esc(b.origin)} ・ 体高 ${esc(b.heightCm)} ・ 体重 ${esc(b.weightKg)}</p><p>${esc(b.description)}</p><p class="spec">用途: ${esc(b.use)}</p></article>`).join("");
  $("#coat-grid").innerHTML = coats.map(c => `<article class="kcard"><div class="fig">${horseSvg(c.bodyHex, c.maneHex, 1, "")}</div>
    <h3>${esc(c.name)}<small>${esc(c.reading)}</small></h3><p>${esc(c.description)}</p><p class="spec">代表馬 ${esc(c.famousHorse)}</p></article>`).join("");
};

init.tools = () => {
  const calc = () => {
    const odds = Math.max(1, parseFloat($("#pay-odds").value) || 1), amount = Math.max(100, parseInt($("#pay-amount").value, 10) || 100);
    const pay = Math.round((odds * amount) / 10) * 10, profit = pay - amount;
    $("#pay-out").innerHTML = `<div class="big num">¥${pay.toLocaleString()}</div><p class="lbl">${esc($("#pay-type").value)} が的中したときの払戻金</p>
      <span class="tag ${profit >= 0 ? "r1" : "r2"}">回収率 ${Math.round((pay / amount) * 100)}% ・ ${profit >= 0 ? "+" : ""}¥${profit.toLocaleString()}</span>`;
  };
  ["#pay-type", "#pay-odds", "#pay-amount"].forEach(s => $(s).addEventListener("input", calc));
  calc();
};

init.settings = () => {
  syncThemeSeg();
  $$("#theme-seg button").forEach(b => b.addEventListener("click", () => setTheme(b.dataset.themeSet)));
  const show = st => {
    const at = st.generatedAt ? new Date(st.generatedAt).toLocaleString("ja-JP") : "未取得";
    $("#data-status").textContent = st.syncing ? `更新中: ${st.progress}` : `競走馬 ${st.horses.toLocaleString()} 頭 (写真 ${st.horsesWithPhoto.toLocaleString()}) ・ 競走 ${st.races} ・ ${at} 時点${st.progress && !st.syncing && st.progress !== "完了" ? ` ・ ${st.progress}` : ""}`;
    $("#data-refresh").disabled = st.syncing;
  };
  const poll = async () => { const st = await api("/api/library/status"); show(st); if (st.syncing) setTimeout(poll, 2000); };
  $("#data-refresh").addEventListener("click", async () => { show(await api("/api/library/refresh", { method: "POST" })); setTimeout(poll, 1500); });
  poll();
};

/* ============================================================
   アカウント・お気に入り・メモ (デモ)
   ============================================================ */
function renderAccount() {
  const u = state.user;
  $("#account").innerHTML = u
    ? `<button type="button" id="logout" title="サインアウト"><img src="${esc(u.avatarUrl)}" alt=""><span>${esc(u.name)}</span></button>`
    : `<button type="button" id="login">${icon("log-in")}<span>サインイン</span></button>`;
  $("#login")?.addEventListener("click", () => $("#login-dialog").showModal());
  $("#logout")?.addEventListener("click", async () => { await fetch("/api/auth/logout", { method: "POST" }); state.user = null; renderAccount(); renderEntries(); toast("サインアウトしました"); });
}
async function toggleFavorite(name) {
  if (!state.user) { $("#login-dialog").showModal(); return; }
  const res = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ horseName: name }) });
  if (!res.ok) return;
  state.user = await res.json();
  renderEntries();
  const on = state.user.favoriteHorses.includes(name);
  const btn = $("#fav-btn");
  if (btn) { btn.classList.toggle("on", on); btn.innerHTML = `${icon("star")}${on ? "お気に入り済み" : "お気に入り"}`; }
  toast(on ? "お気に入りに追加しました" : "お気に入りから外しました");
}
function openNote() {
  if (!state.user) { $("#login-dialog").showModal(); return; }
  const id = $("#race-tabs button.on")?.dataset.id;
  $("#note-race").textContent = state.race?.race.name || "";
  $("#note-text").value = state.user.notes?.[id] || "";
  $("#note-dialog").dataset.race = id;
  $("#note-dialog").showModal();
}

/* ============================================================
   起動
   ============================================================ */
async function boot() {
  const sp = splash();
  const tasks = [
    sp.track("競馬場を読み込みました", api("/api/courses").then(c => (state.courses = c))),
    sp.track("計算エンジンを準備しました", loadEngines()),
    sp.track("天気を取得しました", loadWeather()),
    sp.track("アカウントを確認しました", fetch("/api/auth/me").then(r => (r.ok ? r.json() : null)).then(u => (state.user = u)).catch(() => null)),
  ];
  await Promise.allSettled(tasks);
  renderAccount();

  $("#theme-switch").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    let saved = null;
    try { saved = localStorage.getItem("kv-theme"); } catch (_) {}
    if (!saved) setTheme("auto");
  });
  $$("[data-close]").forEach(el => el.addEventListener("click", closeSheet));
  addEventListener("keydown", e => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
  $("#login-dialog").addEventListener("close", async () => {
    if ($("#login-dialog").returnValue !== "demo") return;
    const res = await fetch("/api/auth/login?provider=demo", { method: "POST" });
    if (res.ok) { state.user = await res.json(); renderAccount(); renderEntries(); toast("サインインしました"); }
  });
  $("#note-dialog").addEventListener("close", async () => {
    const d = $("#note-dialog");
    if (d.returnValue !== "save") return;
    const res = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raceId: d.dataset.race, note: $("#note-text").value }) });
    if (res.ok) { state.user = await res.json(); toast("メモを保存しました"); }
  });
  addEventListener("hashchange", route);
  addEventListener("resize", movePill);
  route();
  sp.finish();
}

boot();
