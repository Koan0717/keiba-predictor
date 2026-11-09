// Keiba Vision Pro — Apple Glassmorphism & High-Performance Wasm Engine Frontend

let currentRaceId = "arima-2026";
let currentAnalysis = null;
let currentUser = null;
let currentFilter = "all";
let wasmExports = null; // C   (keiba_physics.wasm)
let zigExports = null;  // Zig (montecarlo.wasm)
let odinExports = null; // Odin (pedigree.wasm)
let mcPace = 1.0;
const STYLE_CODE = { NIGE: 0, SENKO: 1, SASHI: 2, OIKOMI: 3 };
let legendHorses = [];

// DOM Elements
const racePickerTabs = document.querySelectorAll(".race-btn[data-race]");
const sidebarTabBtns = document.querySelectorAll(".sidebar-tab-btn");
const viewSections = document.querySelectorAll(".view-section");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeIcon = document.getElementById("theme-icon");
const themeText = document.getElementById("theme-text");
const wasmEngineLabel = document.getElementById("wasm-engine-label");

// Dashboard Elements
const raceTitle = document.getElementById("race-title");
const raceSubtitle = document.getElementById("race-subtitle");
const raceGrade = document.getElementById("race-grade");
const raceTrack = document.getElementById("race-track");
const raceCourseInfo = document.getElementById("race-course-info");
const raceTime = document.getElementById("race-time");
const racePrize = document.getElementById("race-prize");
const horseCount = document.getElementById("horse-count");

const weatherIcon = document.getElementById("weather-icon");
const weatherTemp = document.getElementById("weather-temp");
const weatherDesc = document.getElementById("weather-desc");
const weatherWind = document.getElementById("weather-wind");
const weatherRain = document.getElementById("weather-rain");
const weatherStatusBadge = document.getElementById("weather-status-badge");

const topPicksContainer = document.getElementById("top-picks-container");
const betListContainer = document.getElementById("bet-list-container");
const horsesTableBody = document.getElementById("horses-table-body");
const simTrack = document.getElementById("sim-track");
const authContainer = document.getElementById("auth-container");

// Encyclopedia, Pedigree, Courses Containers
const encyclopediaGrid = document.getElementById("encyclopedia-grid");
const pedigreeGrid = document.getElementById("pedigree-grid");
const courseGrid = document.getElementById("course-grid");

// Simulator Elements
const simTypeSelect = document.getElementById("sim-type-select");
const simOddsInput = document.getElementById("sim-odds-input");
const simAmountInput = document.getElementById("sim-amount-input");
const simCalculateBtn = document.getElementById("sim-calculate-btn");
const simPayoutDisplay = document.getElementById("sim-payout-display");
const simReturnRate = document.getElementById("sim-return-rate");

// Modals
const loginModal = document.getElementById("login-modal");
const openLoginBtn = document.getElementById("open-login-btn");
const closeLoginBtn = document.getElementById("close-login-btn");
const noteModal = document.getElementById("note-modal");
const closeNoteBtn = document.getElementById("close-note-btn");
const cancelNoteBtn = document.getElementById("cancel-note-btn");
const saveNoteBtn = document.getElementById("save-note-btn");
const noteTextarea = document.getElementById("note-textarea");
const noteRaceTitle = document.getElementById("note-race-title");

// Filter buttons
const filterButtons = document.querySelectorAll("#table-filter-group .race-btn");

// Initialize on Load
document.addEventListener("DOMContentLoaded", async () => {
  const splash = startSplash();
  initTheme();
  setupEventListeners();
  await Promise.all([
    fetch("/api/health").then(r => splash.mark("kotlin", r.ok)).catch(() => splash.mark("kotlin", false)),
    initWasm(splash),
  ]);
  await checkAuthSession();
  await loadRaceData(currentRaceId);
  await loadEncyclopediaData();
  splash.finish();
});

// 0. 起動スプラッシュ
// 背景キャンバスで光の筋 (馬が駆け抜けるスピード線) を流し、読み込みが終わったら
// 中央から円形に穴が広がってアプリが現れる。最低 2.4 秒は見せる。
function startSplash() {
  const el = document.getElementById("splash");
  const bar = document.getElementById("splash-bar");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const started = performance.now();
  let total = 0, done = 0, finished = false, raf = 0;

  // 光の筋パーティクル
  const cv = document.getElementById("splash-canvas");
  const ctx = cv.getContext("2d");
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const resize = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  resize();
  addEventListener("resize", resize);
  const hues = [195, 230, 265, 300];
  const streaks = Array.from({ length: reduce ? 0 : 90 }, () => newStreak(true));
  function newStreak(anywhere) {
    return {
      x: anywhere ? Math.random() * cv.width : -200 * dpr,
      y: Math.random() * cv.height,
      v: (4 + Math.random() * 14) * dpr,
      len: (60 + Math.random() * 240) * dpr,
      w: (0.6 + Math.random() * 1.8) * dpr,
      h: hues[(Math.random() * hues.length) | 0],
    };
  }
  let boost = 1;
  function frame() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = "lighter";
    for (const st of streaks) {
      st.x += st.v * boost;
      if (st.x - st.len > cv.width) Object.assign(st, newStreak(false));
      const g = ctx.createLinearGradient(st.x - st.len, 0, st.x, 0);
      g.addColorStop(0, `hsla(${st.h},90%,70%,0)`);
      g.addColorStop(1, `hsla(${st.h},95%,75%,.85)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = st.w;
      ctx.beginPath();
      ctx.moveTo(st.x - st.len, st.y);
      ctx.lineTo(st.x, st.y);
      ctx.stroke();
    }
    raf = requestAnimationFrame(frame);
  }
  if (!reduce) frame();

  // タイトルを1文字ずつ分解してスタッガー表示
  const title = document.getElementById("splash-title");
  title.innerHTML = [...title.textContent].map((c, i) =>
    `<span style="--i:${i}">${c === " " ? "&nbsp;" : c}</span>`).join("");

  document.querySelectorAll("#splash-boot li").forEach(() => total++);
  const close = () => {
    if (finished) return;
    finished = true;
    boost = 6; // 退場時に光が一気に加速
    el.classList.add("out");
    document.body.classList.add("app-ready");
    setTimeout(() => { cancelAnimationFrame(raf); el.remove(); }, reduce ? 300 : 1400);
  };
  document.getElementById("splash-skip").addEventListener("click", close);
  addEventListener("keydown", e => { if (e.key === "Escape") close(); }, { once: true });

  return {
    mark(name, ok) {
      const li = el.querySelector(`[data-boot="${name}"]`);
      if (!li || li.dataset.state) return;
      li.dataset.state = ok ? "ok" : "ng";
      done++;
      bar.style.width = `${(done / total) * 100}%`;
    },
    finish() {
      el.querySelectorAll("[data-boot]:not([data-state])").forEach(li => this.mark(li.dataset.boot, false));
      const wait = Math.max(0, (reduce ? 300 : 2400) - (performance.now() - started));
      setTimeout(close, wait);
    },
  };
}

// 1. Theme Management (Light & Dark Mode)
// 初期テーマは index.html の <head> 内スクリプトで決定済み (保存値 → OS 設定)
function initTheme() {
  applyTheme(document.documentElement.getAttribute("data-theme") || "light", false);

  themeToggleBtn?.addEventListener("click", (e) => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    // 対応ブラウザでは、押したボタンの位置から新しいテーマが円形に広がる
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyTheme(next, true);
      return;
    }
    const x = e.clientX, y = e.clientY;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(() => applyTheme(next, true)).ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)", pseudoElement: "::view-transition-new(root)" }
      );
    });
  });

  // 手動で選んでいない間は OS のダーク/ライト切替に追従
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    let saved = null;
    try { saved = localStorage.getItem("keiba_theme"); } catch (_) {}
    if (!saved) applyTheme(e.matches ? "dark" : "light", false);
  });
}

function applyTheme(theme, remember) {
  document.documentElement.setAttribute("data-theme", theme);
  if (remember) {
    try { localStorage.setItem("keiba_theme", theme); } catch (_) {}
  }
  if (theme === "dark") {
    themeIcon.textContent = "🌙";
    themeText.textContent = "ダーク";
  } else {
    themeIcon.textContent = "☀️";
    themeText.textContent = "ライト";
  }
}

// 2. WebAssembly エンジン (C / Zig / Odin) の読み込み
async function loadWasm(name) {
  const res = await fetch(`/static/wasm/${name}.wasm`);
  if (!res.ok) throw new Error(`${name}.wasm: HTTP ${res.status}`);
  return (await WebAssembly.instantiate(await res.arrayBuffer())).instance.exports;
}

async function initWasm(splash) {
  const engines = [
    ["c", "keiba_physics", ex => (wasmExports = ex)],
    ["zig", "montecarlo", ex => (zigExports = ex)],
    ["odin", "pedigree", ex => (odinExports = ex)],
  ];
  const results = await Promise.all(engines.map(async ([key, file, set]) => {
    try {
      set(await loadWasm(file));
      splash?.mark(key, true);
      return true;
    } catch (err) {
      console.warn(`${file}.wasm を読めなかったので JS で代用します`, err);
      splash?.mark(key, false);
      return false;
    }
  }));
  const ok = results.filter(Boolean).length;
  if (wasmEngineLabel) wasmEngineLabel.textContent = `Wasm エンジン ${ok}/3 稼働中`;
  document.querySelectorAll(".engine-status").forEach((el, i) => {
    el.textContent = results[i] ? "● 稼働中" : "○ 読込失敗 (JS で代用)";
    el.classList.toggle("ng", !results[i]);
  });
  updateOdinResult();
}

// 3. Event Listeners & Navigation
function setupEventListeners() {
  // Sidebar Tab Switching
  sidebarTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      sidebarTabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const targetView = btn.getAttribute("data-view");

      viewSections.forEach(sec => sec.classList.remove("active"));
      const activeSection = document.getElementById(`view-${targetView}`);
      if (activeSection) activeSection.classList.add("active");

      // Hide or show race picker tabs on dashboard
      const raceBar = document.getElementById("race-tabs-bar");
      if (raceBar) {
        raceBar.style.display = targetView === "dashboard" ? "flex" : "none";
      }
      moveNavIndicator();
    });
  });
  addEventListener("resize", moveNavIndicator);
  requestAnimationFrame(moveNavIndicator);

  // モンテカルロのペース切替
  document.querySelectorAll("#mc-pace button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#mc-pace button").forEach(b => b.classList.toggle("active", b === btn));
      mcPace = parseFloat(btn.dataset.pace);
      if (currentAnalysis) renderMonteCarlo(currentAnalysis.race.horses);
    });
  });

  // Odin 計算機
  document.getElementById("odin-g1")?.addEventListener("input", updateOdinResult);
  document.getElementById("odin-g2")?.addEventListener("input", updateOdinResult);

  // 名鑑検索
  document.getElementById("horse-search")?.addEventListener("input", (e) => renderEncyclopedia(legendHorses, e.target.value));

  // Race Switcher
  racePickerTabs.forEach(btn => {
    btn.addEventListener("click", async () => {
      racePickerTabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentRaceId = btn.getAttribute("data-race");
      await loadRaceData(currentRaceId);
    });
  });

  // Table Filters
  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter");
      renderHorseTable();
    });
  });

  // Simulator Calculate
  simCalculateBtn?.addEventListener("click", calculateSimulation);
  simOddsInput?.addEventListener("input", calculateSimulation);
  simAmountInput?.addEventListener("input", calculateSimulation);

  // Modals
  openLoginBtn?.addEventListener("click", () => loginModal.classList.add("open"));
  closeLoginBtn?.addEventListener("click", () => loginModal.classList.remove("open"));
  closeNoteBtn?.addEventListener("click", () => noteModal.classList.remove("open"));
  cancelNoteBtn?.addEventListener("click", () => noteModal.classList.remove("open"));

  loginModal.addEventListener("click", (e) => {
    if (e.target === loginModal) loginModal.classList.remove("open");
  });
  noteModal.addEventListener("click", (e) => {
    if (e.target === noteModal) noteModal.classList.remove("open");
  });

  // OAuth buttons
  document.getElementById("login-demo-btn")?.addEventListener("click", () => loginWithProvider("demo"));
  document.getElementById("login-github-btn")?.addEventListener("click", () => loginWithProvider("github"));
  document.getElementById("login-google-btn")?.addEventListener("click", () => loginWithProvider("google"));

  saveNoteBtn?.addEventListener("click", saveCurrentNote);
}

// サイドバーの選択中ハイライト (ガラスのピル) をなめらかに移動
function moveNavIndicator() {
  const nav = document.getElementById("sidebar-nav");
  const ind = document.getElementById("nav-indicator");
  const active = nav?.querySelector(".sidebar-tab-btn.active");
  if (!ind || !active) return;
  ind.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
  ind.style.width = `${active.offsetWidth}px`;
  ind.style.height = `${active.offsetHeight}px`;
}

// 4. Load Race Data & AI Analysis
async function loadRaceData(raceId) {
  try {
    const res = await fetch(`/api/races/${raceId}/analysis`);
    if (!res.ok) throw new Error("Failed to load race analysis");
    const data = await res.json();
    currentAnalysis = data;

    renderRaceOverview(data.race, data.paceForecast);
    renderWasmTrackSimulation(data.race.horses, data.predictions, data.paceForecast);
    renderMonteCarlo(data.race.horses);
    renderTopPicks(data.race.horses, data.predictions);
    renderBettingStrategy(data.betRecommendations);
    renderHorseTable();
  } catch (err) {
    console.error("API error", err);
  }
}

// Render Race Overview & Live Weather
function renderRaceOverview(race, paceForecast) {
  raceTitle.textContent = race.name;
  raceSubtitle.textContent = race.subtitle;
  raceGrade.textContent = race.grade;
  raceTrack.textContent = `${race.racecourse}競馬場`;
  raceCourseInfo.textContent = `${race.courseType === "TURF" ? "芝" : "ダート"} ${race.distanceMeters}m (${race.turnDirection})`;
  raceTime.textContent = `発走 ${race.postTime}`;
  racePrize.textContent = `${(race.prizeFirstYen / 100000000).toFixed(0)}億円`;
  horseCount.textContent = `${race.horses.length}頭`;

  if (race.weather) {
    weatherIcon.textContent = race.weather.weatherIcon || "☀️";
    weatherTemp.textContent = `${race.weather.temperatureC.toFixed(1)}°C`;
    weatherDesc.textContent = `${race.weather.weatherDescription}・${getTrackCondJapanese(race.condition)}`;
    weatherWind.textContent = `${race.weather.windSpeedKmh.toFixed(1)} km/h`;
    weatherRain.textContent = `${race.weather.precipitationMm.toFixed(1)} mm`;
    if (weatherStatusBadge) {
      weatherStatusBadge.textContent = race.weather.isLive ? "● LIVE 気象連動中" : "○ 推定気象データ";
    }
  }
}

function getTrackCondJapanese(cond) {
  switch (cond) {
    case "FIRM": return "良馬場";
    case "GOOD": return "稍重";
    case "YIELDING": return "重馬場";
    case "SOFT": return "不良馬場";
    default: return "良馬場";
  }
}

// 5. Wasm (C) で直線の位置を計算し、4コーナーから一斉にスパートするアニメーションで表示
function renderWasmTrackSimulation(horses, predictions, paceForecast) {
  simTrack.querySelectorAll(".track-runner-item").forEach(r => r.remove());
  const paceFactor = paceForecast === "ハイペース" ? 1.2 : paceForecast === "スローペース" ? 0.8 : 1.0;

  const scored = horses.map(h => {
    const style = STYLE_CODE[h.runningStyle] ?? 2;
    const score = wasmExports?.calculate_stretch_pos
      ? wasmExports.calculate_stretch_pos(h.speedIndex, style, paceFactor, 2.2, 0.85)
      : (h.speedIndex / 100.0) * 80.0; // JS フォールバック
    return { h, score };
  }).sort((a, b) => b.score - a.score);

  const max = scored[0]?.score ?? 1, min = scored[scored.length - 1]?.score ?? 0;
  const LANES = 4;
  scored.forEach(({ h, score }, rank) => {
    // 先頭 = ゴール手前 (右端)、最後方 = 左。隣り合う順位は別レーンに置いて重なりを防ぐ
    const x = (score - min) / Math.max(0.001, max - min); // 0 = 最後方, 1 = 先頭
    const runner = document.createElement("div");
    runner.className = "track-runner-item";
    runner.style.top = `${10 + (rank % LANES) * 30}px`;
    runner.style.left = "0px";
    runner.style.transitionDelay = `${rank * 40}ms`;
    runner.title = `${rank + 1}番手 ${h.horseNumber}番 ${h.name} (${getRunningStyleJa(h.runningStyle)}) ・ Wasm 計算値 ${score.toFixed(1)}`;
    runner.innerHTML = `<span class="runner-name-tag">${h.name.length > 6 ? h.name.substring(0, 6) + "…" : h.name}</span>
      <div class="runner-gate-badge gate-${h.postPosition}">${h.horseNumber}</div>`;
    simTrack.appendChild(runner);
    // 名札ぶんの幅 (左 130px) とゴール線 (右 85px) を避けて配置
    requestAnimationFrame(() => requestAnimationFrame(() => { runner.style.left = `calc(130px + (100% - 215px) * ${x.toFixed(4)})`; }));
  });
}

// Zig モンテカルロ: 10万回レースを走らせた勝率・複勝率
const TRAINING_STAMINA = { "S": 1.0, "A+": 0.9, "A": 0.8, "B": 0.65, "C": 0.5 };

function renderMonteCarlo(horses) {
  const box = document.getElementById("mc-bars");
  const meta = document.getElementById("mc-meta");
  if (!box) return;
  if (!zigExports) {
    box.innerHTML = `<p class="panel-note">Zig エンジン (montecarlo.wasm) を読み込めなかったため表示できません。</p>`;
    return;
  }
  const ITER = 100000;
  const list = horses.slice(0, 18);
  list.forEach((h, i) => zigExports.set_horse(i, h.speedIndex, TRAINING_STAMINA[h.trainingScore] ?? 0.7, STYLE_CODE[h.runningStyle] ?? 2));
  const t0 = performance.now();
  zigExports.simulate(list.length, ITER, mcPace, 20261109);
  const ms = performance.now() - t0;

  const rows = list.map((h, i) => ({ h, win: zigExports.win_rate(i), place: zigExports.place_rate(i) }))
    .sort((a, b) => b.win - a.win);
  const max = Math.max(...rows.map(r => r.place), 1);
  box.innerHTML = rows.map((r, rank) => `
    <div class="mc-row" style="--d:${rank * 25}ms">
      <span class="runner-gate-badge gate-${r.h.postPosition}">${r.h.horseNumber}</span>
      <span class="mc-name">${r.h.name}</span>
      <div class="mc-track">
        <div class="mc-place" style="width:${(r.place / max) * 100}%"></div>
        <div class="mc-win" style="width:${(r.win / max) * 100}%"></div>
      </div>
      <span class="mc-num"><strong>${r.win.toFixed(1)}%</strong> <small>複 ${r.place.toFixed(1)}%</small></span>
    </div>`).join("");
  if (meta) meta.innerHTML = `濃い棒 = 勝率 / 薄い棒 = 3着以内率 ・ ${ITER.toLocaleString()} 回を <strong>${ms.toFixed(0)} ms</strong> で計算`;
}

// Top Picks (印・指数)
function renderTopPicks(horses, predictions) {
  topPicksContainer.innerHTML = "";
  const markedPicks = predictions.filter(p => p.mark && p.mark !== "");

  markedPicks.forEach(pick => {
    const horse = horses.find(h => h.horseNumber === pick.horseNumber);
    if (!horse) return;

    let markColor = "var(--status-danger)";
    if (pick.mark === "◯") markColor = "var(--color-primary)";
    else if (pick.mark === "▲") markColor = "var(--status-warning)";
    else if (pick.mark === "☆") markColor = "#a855f7";

    const box = document.createElement("div");
    box.style.background = "var(--bg-subtle)";
    box.style.border = "1px solid var(--border-subtle)";
    box.style.borderRadius = "10px";
    box.style.padding = "0.95rem";
    box.style.position = "relative";

    box.innerHTML = `
      <span style="position: absolute; top: 0.65rem; right: 0.65rem; font-size: 1.3rem; font-weight: 900; color: ${markColor};">${pick.mark}</span>
      <div class="runner-gate-badge gate-${horse.postPosition}" style="width: 22px; height: 22px; font-size: 0.75rem; margin-bottom: 0.4rem;">${horse.horseNumber}</div>
      <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 0.2rem;" title="${horse.name}">${horse.name}</div>
      <div style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 0.6rem;">${horse.jockey} ｜ ${horse.odds}倍 (${horse.popularity}番人気)</div>

      <div style="background: rgba(0,0,0,0.08); height: 5px; border-radius: 3px; overflow: hidden; margin-bottom: 0.3rem;">
        <div style="height: 100%; width: ${pick.totalScore}%; background: var(--color-primary); border-radius: 3px;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.72rem; font-family: var(--font-mono); color: var(--text-tertiary);">
        <span>総合指数</span>
        <strong>${pick.totalScore}</strong>
      </div>
      <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.35; margin-top: 0.6rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-subtle);">
        ${pick.comments}
      </div>
    `;

    topPicksContainer.appendChild(box);
  });
}

// Betting Strategy
function renderBettingStrategy(recommendations) {
  betListContainer.innerHTML = "";
  recommendations.forEach(bet => {
    const row = document.createElement("div");
    row.style.background = "var(--bg-subtle)";
    row.style.border = "1px solid var(--border-subtle)";
    row.style.borderRadius = "8px";
    row.style.padding = "0.75rem 0.95rem";

    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
        <span style="background: var(--color-primary-light); color: var(--color-primary); font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 4px;">${bet.betType}</span>
        <span style="font-weight: 700; font-family: var(--font-mono); font-size: 0.95rem;">${bet.combination}</span>
        <span style="font-weight: 700; color: var(--color-primary); font-size: 0.85rem;">${bet.oddsEstimate}倍</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.35rem;">
        <span>推奨配分: <strong>${bet.allocationPercent}%</strong></span>
        <span>自信度: <strong>${bet.confidence}</strong></span>
      </div>
      <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.3rem; line-height: 1.35;">${bet.reason}</div>
    `;
    betListContainer.appendChild(row);
  });
}

// Full Gate Table
function renderHorseTable() {
  if (!currentAnalysis) return;
  horsesTableBody.innerHTML = "";

  let list = currentAnalysis.race.horses.map(h => {
    const pred = currentAnalysis.predictions.find(p => p.horseNumber === h.horseNumber);
    return { horse: h, pred: pred };
  });

  if (currentFilter === "ai-score") {
    list.sort((a, b) => (b.pred?.totalScore || 0) - (a.pred?.totalScore || 0));
  } else if (currentFilter === "odds") {
    list.sort((a, b) => a.horse.odds - b.horse.odds);
  } else if (currentFilter === "ev") {
    list.sort((a, b) => (b.pred?.expectedValueScore || 0) - (a.pred?.expectedValueScore || 0));
  } else {
    list.sort((a, b) => a.horse.horseNumber - b.horse.horseNumber);
  }

  list.forEach(item => {
    const h = item.horse;
    const p = item.pred;
    const isFav = currentUser?.favoriteHorses?.includes(h.name);

    let markColor = "var(--text-tertiary)";
    if (p?.mark === "◎") markColor = "var(--status-danger)";
    else if (p?.mark === "◯") markColor = "var(--color-primary)";
    else if (p?.mark === "▲") markColor = "var(--status-warning)";
    else if (p?.mark === "☆") markColor = "#a855f7";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="text-align: center;">
        <button class="star-toggle ${isFav ? 'active' : ''}" data-name="${h.name}">★</button>
      </td>
      <td style="text-align: center;">
        <span class="runner-gate-badge gate-${h.postPosition}" style="margin: 0 auto;">${h.horseNumber}</span>
      </td>
      <td style="text-align: center; font-weight: 900; font-size: 1.15rem; color: ${markColor};">
        ${p?.mark || '-'}
      </td>
      <td>
        <div style="font-weight: 700; font-size: 0.92rem;">${h.name}</div>
        <div style="font-size: 0.72rem; color: var(--text-tertiary);">${h.sire} × ${h.damSire}</div>
      </td>
      <td>
        <div>${h.sexAge} / ${h.weightCarry}kg</div>
        <div style="font-size: 0.72rem; color: var(--text-tertiary);">${h.horseWeight}kg (${h.weightDiff >= 0 ? '+' : ''}${h.weightDiff})</div>
      </td>
      <td>
        <div style="font-weight: 600;">${h.jockey}</div>
        <div style="font-size: 0.72rem; color: var(--text-tertiary);">${h.trainer}</div>
      </td>
      <td>
        <div style="font-family: var(--font-mono); font-weight: 700; color: var(--color-primary);">${h.odds}倍</div>
        <div style="font-size: 0.72rem; color: var(--text-tertiary);">${h.popularity}番人気</div>
      </td>
      <td style="font-family: var(--font-mono); font-weight: 600;">${h.speedIndex}</td>
      <td style="font-size: 0.8rem;">${getRunningStyleJa(h.runningStyle)}</td>
      <td>
        <span style="font-weight: 800; font-size: 0.8rem; padding: 1px 6px; border-radius: 4px; background: var(--color-primary-light); color: var(--color-primary);">
          ${h.trainingScore}
        </span>
      </td>
      <td>
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 2px;">
          <strong style="color: var(--color-primary);">${p ? p.totalScore : '-'}</strong>
          <span style="color: var(--text-tertiary);">勝率 ${p ? p.winProbability : '-'}%</span>
        </div>
        <div style="background: rgba(0,0,0,0.08); height: 5px; border-radius: 3px; overflow: hidden;">
          <div style="height: 100%; width: ${p ? p.totalScore : 0}%; background: var(--color-primary);"></div>
        </div>
      </td>
    `;

    tr.querySelector(".star-toggle").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(h.name);
    });

    horsesTableBody.appendChild(tr);
  });
}

function getRunningStyleJa(style) {
  switch (style) {
    case "NIGE": return "逃げ";
    case "SENKO": return "先行";
    case "SASHI": return "差し";
    case "OIKOMI": return "追込";
    default: return style;
  }
}

// 6. 名鑑・種類・血統・コース図
async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function loadEncyclopediaData() {
  const jobs = [
    ["horses", d => { legendHorses = d; renderEncyclopedia(d, ""); }],
    ["pedigree", renderPedigree],
    ["courses", renderCourses],
    ["breeds", renderBreeds],
    ["coats", renderCoats],
  ];
  await Promise.all(jobs.map(([name, render]) =>
    getJson(`/api/encyclopedia/${name}`).then(render).catch(err => console.error("Encyclopedia load error", err))));
}

// 5角形レーダーチャート (SVG)
function radarSvg(values, labels) {
  const N = values.length, C = 70, R = 52;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return [C + Math.cos(a) * r, C + Math.sin(a) * r];
  };
  const ring = f => values.map((_, i) => pt(i, R * f).join(",")).join(" ");
  // 60〜100 を中心〜外周に割り当て (名馬同士の差が見えるように)
  const shape = values.map((v, i) => pt(i, R * Math.max(0.08, (v - 60) / 40)).join(",")).join(" ");
  return `<svg class="radar" viewBox="0 0 140 140" role="img" aria-label="${labels.map((l, i) => `${l}${values[i]}`).join(" ")}">
    ${[1, 0.75, 0.5, 0.25].map(f => `<polygon class="radar-grid" points="${ring(f)}"/>`).join("")}
    ${values.map((_, i) => `<line class="radar-grid" x1="${C}" y1="${C}" x2="${pt(i, R)[0]}" y2="${pt(i, R)[1]}"/>`).join("")}
    <polygon class="radar-shape" points="${shape}"/>
    ${labels.map((l, i) => { const [x, y] = pt(i, R + 11); return `<text x="${x}" y="${y + 3}" text-anchor="middle">${l}</text>`; }).join("")}
  </svg>`;
}

function renderEncyclopedia(horses, query) {
  if (!encyclopediaGrid) return;
  const q = (query || "").trim().toLowerCase();
  const list = !q ? horses : horses.filter(h =>
    [h.name, h.kana, h.title, h.sire, h.dam, ...h.majorWins].join(" ").toLowerCase().includes(q));
  encyclopediaGrid.innerHTML = list.length ? "" : `<p class="panel-note">「${query.replace(/[<>&"]/g, "")}」に一致する馬はいません。</p>`;

  list.forEach((h, idx) => {
    const card = document.createElement("div");
    card.className = "glass-panel horse-catalog-card";
    card.style.setProperty("--d", `${idx * 60}ms`);
    card.innerHTML = `
      <div class="horse-card-header">
        <div class="horse-avatar-badge">${h.iconEmoji}</div>
        <div class="horse-main-names">
          <h3>${h.name} <small>${h.kana}</small></h3>
          <span class="horse-title-badge">${h.title}</span>
        </div>
      </div>
      <div class="horse-card-body">
        ${radarSvg([h.speedRadar, h.staminaRadar, h.powerRadar, h.spiritRadar, h.agilityRadar], ["スピード", "スタミナ", "パワー", "根性", "瞬発力"])}
        <table class="horse-stat-table">
          <tr><td class="stat-key">生年・毛色</td><td>${h.birthYear}年 ・ ${h.color}</td></tr>
          <tr><td class="stat-key">通算成績</td><td><strong>${h.record}</strong></td></tr>
          <tr><td class="stat-key">獲得賞金</td><td><strong>${h.totalEarnings}</strong></td></tr>
          <tr><td class="stat-key">血統</td><td>${h.sire} × ${h.dam}</td></tr>
        </table>
      </div>
      <div class="stallion-tags">${h.majorWins.map(w => `<span class="stallion-tag">🏆 ${w}</span>`).join("")}</div>
      <p class="horse-desc-p">${h.description}</p>
    `;
    encyclopediaGrid.appendChild(card);
  });
}

// 横向きの馬シルエット (SVG)。build で体格の太さ、色で毛色を表現
function horseSvg(body, mane, build = 1, cls = "") {
  const legW = 5.5 * build, bodyRy = 14 * build;
  const legs = [30, 40, 67, 77].map((x, i) =>
    `<rect x="${x - (legW - 5.5) / 2}" y="${50 + (i % 3 ? 2 : 0)}" width="${legW}" height="${36 - (i % 3 ? 2 : 0)}" rx="2.5" fill="${body}"/>
     <rect x="${x - (legW - 5.5) / 2}" y="83" width="${legW}" height="4" rx="1.5" fill="#1b1b1b" opacity=".75"/>`).join("");
  return `<svg class="horse-svg ${cls}" viewBox="0 0 120 92" aria-hidden="true">
    <ellipse cx="58" cy="89" rx="40" ry="2.5" class="horse-shadow"/>
    <path d="M24 38 C10 42 8 62 13 76 C17 64 19 52 27 45 Z" fill="${mane}"/>
    ${legs}
    <ellipse cx="55" cy="46" rx="33" ry="${bodyRy}" fill="${body}"/>
    <polygon points="72,40 84,16 96,20 90,48" fill="${body}"/>
    <ellipse cx="97" cy="25" rx="12" ry="6" transform="rotate(32 97 25)" fill="${body}"/>
    <polygon points="85,15 87,6 91,14" fill="${body}"/>
    <path d="M84 15 L72 40 L78 41 L89 19 Z" fill="${mane}"/>
    <circle cx="94" cy="21" r="1.4" fill="#111"/>
    <ellipse cx="48" cy="40" rx="22" ry="5" fill="#fff" opacity=".12"/>
  </svg>`;
}

const parseCm = s => { const n = (s.match(/\d+/g) || []).map(Number); return n.length ? n.reduce((a, b) => a + b) / n.length : 0; };

function renderBreeds(breeds) {
  const grid = document.getElementById("breed-grid");
  const chart = document.getElementById("breed-size-chart");
  if (!grid) return;
  grid.innerHTML = breeds.map((b, i) => `
    <div class="glass-panel breed-card" style="--d:${i * 60}ms">
      <div class="breed-figure">${horseSvg(b.bodyHex, "#2a1d14", b.build)}</div>
      <h3>${b.name}</h3>
      <div class="pedigree-meta-box">
        <div><strong>原産:</strong> ${b.origin}</div>
        <div><strong>体高:</strong> ${b.heightCm}</div>
        <div><strong>体重:</strong> ${b.weightKg}</div>
      </div>
      <div class="horse-title-badge" style="margin-bottom:.6rem">用途: ${b.use}</div>
      <p class="horse-desc-p">${b.description}</p>
    </div>`).join("");

  // 体高くらべ: 棒の高さ = 体高 (肩までの高さ)。頭上にその品種の姿を表示
  const HUMAN = 170;
  const items = [...breeds.map(b => ({ name: b.name, cm: parseCm(b.heightCm), art: horseSvg(b.bodyHex, "#2a1d14", b.build) })),
    { name: "人間", cm: HUMAN, human: true,
      art: `<svg viewBox="0 0 40 100" class="human-svg" aria-hidden="true"><circle cx="20" cy="10" r="8"/><path d="M8 22 h24 l-3 38 h-4 l-1 38 h-6 l-1 -38 h-4 z"/></svg>` }];
  const maxCm = Math.max(...items.map(i => i.cm));
  chart.innerHTML = `<div class="size-baseline">${items.map((it, i) => `
    <figure class="size-item ${it.human ? "human" : ""}">
      <div class="size-art">${it.art}</div>
      <div class="size-bar" style="--h:${(it.cm / maxCm) * 100}; --d:${i * 60}ms"><span>${Math.round(it.cm)}cm</span></div>
      <figcaption>${it.name}</figcaption>
    </figure>`).join("")}</div>`;
}

function renderCoats(coats) {
  const grid = document.getElementById("coat-grid");
  if (!grid) return;
  grid.innerHTML = coats.map((c, i) => `
    <div class="glass-panel coat-card" style="--d:${i * 50}ms">
      ${horseSvg(c.bodyHex, c.maneHex, 1)}
      <div class="coat-swatches"><span style="background:${c.bodyHex}" title="体"></span><span style="background:${c.maneHex}" title="たてがみ・尾"></span></div>
      <h3>${c.name} <small>${c.reading}</small></h3>
      <p class="horse-desc-p">${c.description}</p>
      <div class="coat-famous">代表馬: ${c.famousHorse}</div>
    </div>`).join("");
}

function renderPedigree(pedigrees) {
  if (!pedigreeGrid) return;
  pedigreeGrid.innerHTML = "";

  // 系統図: 始祖 → 系統 → 代表種牡馬 → 代表馬
  const tree = document.getElementById("lineage-tree");
  if (tree) {
    tree.innerHTML = pedigrees.map(p => `
      <div class="tree-branch">
        <div class="tree-node root">${p.founder.replace(/\s*\(.*\)/, "")}<small>${p.name}</small></div>
        <div class="tree-children">
          ${p.keyStallions.map((st, i) => `
            <div class="tree-child">
              <div class="tree-node">${st}</div>
              ${p.representativeHorses[i] ? `<div class="tree-leaf">→ ${p.representativeHorses[i]}</div>` : ""}
            </div>`).join("")}
        </div>
      </div>`).join("");
  }

  pedigrees.forEach(p => {
    const card = document.createElement("div");
    card.className = "glass-panel pedigree-card";
    const stallionSpans = p.keyStallions.map(s => `<span class="stallion-tag">${s}</span>`).join(" ");
    card.innerHTML = `
      <h3>${p.name}</h3>
      <div style="font-size: 0.8rem; color: var(--text-tertiary);">始祖: ${p.founder}</div>
      <div class="pedigree-meta-box">
        <div><strong>芝適性:</strong> ${p.turfAptitude}</div>
        <div><strong>ダート適性:</strong> ${p.dirtAptitude}</div>
        <div><strong>得意距離:</strong> ${p.distanceRange}</div>
      </div>
      <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0.75rem;">${p.characteristics}</p>
      <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.25rem;">主な代表種牡馬:</div>
      <div class="stallion-tags">${stallionSpans}</div>
    `;
    pedigreeGrid.appendChild(card);
  });
}

// Odin 血量計算機
function updateOdinResult() {
  const out = document.getElementById("odin-result");
  if (!out) return;
  const g1 = parseInt(document.getElementById("odin-g1").value, 10);
  const g2 = parseInt(document.getElementById("odin-g2").value, 10);
  if (!(g1 >= 1 && g1 <= 12 && g2 >= 1 && g2 <= 12)) {
    out.innerHTML = `<p class="panel-note">1〜12 の整数を入れてください。</p>`;
    return;
  }
  if (!odinExports) {
    out.innerHTML = `<p class="panel-note">Odin エンジン (pedigree.wasm) を読み込めませんでした。</p>`;
    return;
  }
  const blood = odinExports.blood_percent(g1, g2);
  const f = odinExports.inbreeding_coefficient(g1, g2);
  const rating = ["弱いクロス (影響は小さい)", "ほどよいクロス (活力が出やすいと言われる)", "濃いクロス (体質が弱くなるリスク)"][odinExports.cross_rating(g1, g2)];
  out.innerHTML = `
    <div class="odin-big">${blood.toFixed(4).replace(/\.?0+$/, "")}<small>%</small></div>
    <div class="odin-label">${g1}×${g2} の血量</div>
    <div class="odin-sub">Wright 近交係数 <strong>${f.toFixed(4).replace(/\.?0+$/, "")}%</strong></div>
    <div class="odin-rating r${odinExports.cross_rating(g1, g2)}">${rating}</div>`;
}

// コース模式図 (SVG): 楕円トラック + 最後の直線 + 高低差プロファイル
function courseSvg(c) {
  const W = 320, H = 150;
  // 直線が長いほど楕円を横長に
  const straight = Math.min(1, c.straightLengthMeters / 530);
  const rx = 95 + straight * 50, ry = 42, cx = W / 2, cy = 62;
  const left = c.turn === "左";
  // ゴール前直線は手前 (下側)。右回りは左→右に走る想定で図示
  const x1 = cx - rx * 0.55, x2 = cx + rx * 0.55, y = cy + ry;
  const [from, to] = left ? [x2, x1] : [x1, x2];
  const prof = c.elevationProfile || [];
  const pMax = Math.max(...prof, 1);
  const px = i => 20 + (i / Math.max(1, prof.length - 1)) * (W - 40);
  const py = v => 145 - (v / pMax) * 26;
  const line = prof.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
  return `<svg class="course-svg" viewBox="0 0 ${W} 190" role="img" aria-label="${c.name} ${c.turn}回り 直線${c.straightLengthMeters}m 高低差${c.elevationDiffMeters}m">
    <defs><marker id="arr-${c.id}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" class="course-arrow"/></marker></defs>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx + 9}" ry="${ry + 9}" class="course-outer"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="course-turf"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx - 14}" ry="${ry - 12}" class="course-inner"/>
    <path d="M${from} ${y + 4} L${to} ${y + 4}" class="course-straight" marker-end="url(#arr-${c.id})"/>
    <line x1="${to}" y1="${y - 8}" x2="${to}" y2="${y + 14}" class="course-goal"/>
    <text x="${to}" y="${y + 26}" text-anchor="middle" class="course-label strong">GOAL</text>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="course-label">${c.turn}回り</text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" class="course-label strong">直線 ${c.straightLengthMeters}m</text>
    ${prof.length ? `<g transform="translate(0,${190 - 150 - 4})">
      <path d="${line} L${px(prof.length - 1)} 148 L${px(0)} 148 Z" class="elev-fill"/>
      <path d="${line}" class="elev-line"/>
      <text x="20" y="114" class="course-label">高低差 (向こう正面→ゴール・模式)</text>
    </g>` : ""}
  </svg>`;
}

function renderCourses(courses) {
  if (!courseGrid) return;
  courseGrid.innerHTML = courses.map(c => `
    <div class="glass-panel">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem;">
        <h3 style="font-size: 1.25rem; font-weight: 800;">${c.name}</h3>
        <span style="font-size: 0.8rem; color: var(--text-tertiary);">${c.location}</span>
      </div>
      <div class="course-stats">
        <div>直線長 <strong style="color: var(--color-primary);">${c.straightLengthMeters}m</strong></div>
        <div>高低差 <strong style="color: var(--status-danger);">${c.elevationDiffMeters}m</strong></div>
        <div>回り <strong>${c.turn}</strong></div>
      </div>
      ${courseSvg(c)}
      <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
        <strong>坂の特徴:</strong> ${c.slopeCharacteristic}
      </div>
      <div style="font-size: 0.8rem; color: var(--text-tertiary); line-height: 1.4;">
        <strong>攻略要点:</strong> ${c.keyFeature}
      </div>
    </div>`).join("");
}

// 7. Bet Simulator Calculator
function calculateSimulation() {
  const odds = parseFloat(simOddsInput?.value) || 1.0;
  const amount = parseInt(simAmountInput?.value) || 100;

  const payout = Math.round(odds * amount);
  const profit = payout - amount;
  const returnRate = Math.round((payout / amount) * 100);

  if (simPayoutDisplay) {
    simPayoutDisplay.textContent = `¥${payout.toLocaleString()}`;
  }
  if (simReturnRate) {
    simReturnRate.textContent = `${returnRate}% (利益: ${profit >= 0 ? '+' : ''}¥${profit.toLocaleString()})`;
    simReturnRate.style.color = profit >= 0 ? "var(--status-success)" : "var(--status-danger)";
  }
}

// 8. Auth & Sessions
async function checkAuthSession() {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const user = await res.json();
      currentUser = user;
      renderUserProfile(user);
    }
  } catch (err) {}
}

async function loginWithProvider(provider) {
  try {
    const res = await fetch(`/api/auth/login?provider=${provider}`, { method: "POST" });
    if (res.ok) {
      const user = await res.json();
      currentUser = user;
      loginModal.classList.remove("open");
      renderUserProfile(user);
      renderHorseTable();
    }
  } catch (err) {
    alert("ログインに失敗しました: " + err);
  }
}

function renderUserProfile(user) {
  authContainer.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-card); padding: 0.3rem 0.75rem; border-radius: 20px; border: 1px solid var(--border-glass);">
      <img src="${user.avatarUrl}" style="width: 24px; height: 24px; border-radius: 50%;" alt="Avatar">
      <span style="font-size: 0.82rem; font-weight: 700;">${user.name}</span>
      <button id="open-note-btn" class="race-btn" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;">メモ</button>
      <button id="logout-btn" style="background: none; border: none; font-size: 0.72rem; color: var(--status-danger); cursor: pointer;">退出</button>
    </div>
  `;

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    currentUser = null;
    authContainer.innerHTML = `
      <button id="open-login-btn" class="race-btn active" style="padding: 0.45rem 1.1rem;">
        <span>✨ ログイン</span>
      </button>
    `;
    document.getElementById("open-login-btn").addEventListener("click", () => loginModal.classList.add("open"));
    renderHorseTable();
  });

  document.getElementById("open-note-btn").addEventListener("click", () => {
    noteRaceTitle.textContent = `${raceTitle.textContent} のメモ`;
    noteTextarea.value = currentUser?.notes?.[currentRaceId] || "";
    noteModal.classList.add("open");
  });
}

// 9. Favorite Toggle & Notes
async function toggleFavorite(horseName) {
  if (!currentUser) {
    loginModal.classList.add("open");
    return;
  }
  try {
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ horseName })
    });
    if (res.ok) {
      const updatedUser = await res.json();
      currentUser = updatedUser;
      renderHorseTable();
    }
  } catch (err) {
    console.error("Favorite toggle error", err);
  }
}

async function saveCurrentNote() {
  if (!currentUser) return;
  const note = noteTextarea.value;
  try {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raceId: currentRaceId, note })
    });
    if (res.ok) {
      const updatedUser = await res.json();
      currentUser = updatedUser;
      noteModal.classList.remove("open");
    }
  } catch (err) {
    alert("メモ保存に失敗しました");
  }
}
