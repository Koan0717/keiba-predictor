// ==================================================================================
// learn.js — 「はじめての競馬」(チュートリアル)
// ==================================================================================
// 競馬の仕組み・ルール・馬券・オッズ・予想の考え方を、章ごとに図と確認クイズで説明する。
// 章の中身は下の CHAPTERS にまとめてある (文章を直すときはここだけ見ればよい)。
// 読み終えた章 (クイズに正解した章) は、このブラウザの中にだけ記録する。
import { $, $$, esc, icon, wakuBadge } from "./util.js";

const DONE_KEY = "kv-learn-done";

// 図: 出馬表の 1 行に、各欄の意味の吹き出しを付けたもの
const cardFigure = () => `<figure class="lfig">
  <div class="lcard-row">
    <span class="c" data-n="1">${wakuBadge(5, 3)}</span>
    <span class="c" data-n="2"><b>サンプルホース</b><small>父 サンプル × 母の父 テスト</small></span>
    <span class="c" data-n="3">牡4</span>
    <span class="c" data-n="4">57.0kg</span>
    <span class="c" data-n="5">騎手 A</span>
    <span class="c" data-n="6">486kg (+4)</span>
    <span class="c" data-n="7"><b>3.5</b><small>1番人気</small></span>
  </div>
  <ol class="lcard-legend">
    <li><b>枠番と馬番</b> — 色が枠 (1〜8)、数字が馬番 (1〜18)。内側 (小さい数字) ほどコースの内を走りやすい</li>
    <li><b>馬名と血統</b> — 父と母の父。距離や馬場の向き不向きのヒントになる</li>
    <li><b>性齢</b> — 牡 (オス)・牝 (メス)・セ (去勢したオス) と年齢</li>
    <li><b>斤量</b> — 騎手と鞍などを合わせた、馬が背負う重さ</li>
    <li><b>騎手</b> — 乗り替わり (前走と違う騎手) も予想の材料</li>
    <li><b>馬体重</b> — 当日の体重と前走からの増減。大きく増減していると調子を疑う人が多い</li>
    <li><b>単勝オッズと人気</b> — 当たったら賭け金の何倍が戻るか。低いほど多くの人が買っている</li>
  </ol>
  <figcaption>出馬表 (しゅつばひょう) の 1 行。レース予想の画面の表も同じ並びです</figcaption>
</figure>`;

// 図: 脚質ごとの位置取り (レースの途中、左が先頭)
const styleFigure = () => {
  const groups = [
    { name: "逃げ", x: 70, n: 1, note: "先頭を走る" },
    { name: "先行", x: 190, n: 3, note: "前のほう" },
    { name: "差し", x: 330, n: 4, note: "中団から" },
    { name: "追込", x: 470, n: 2, note: "最後方から" },
  ];
  const dots = groups.flatMap((g) => Array.from({ length: g.n }, (_, k) => `<circle cx="${g.x + (k % 2) * 22 - (g.n > 1 ? 11 : 0)}" cy="${62 + (k % 3) * 16}" r="7" class="horse-dot"/>`));
  return `<figure class="lfig"><svg viewBox="0 0 580 150" role="img" aria-label="脚質ごとの位置取り。左が先頭で、逃げ・先行・差し・追込の順に後ろになる">
    <rect x="10" y="44" width="560" height="64" rx="10" class="track"/>
    <line x1="20" x2="20" y1="40" y2="112" class="goal"/><text x="24" y="34" class="t-small">← 進む向き (ゴールはこちら)</text>
    ${dots.join("")}
    ${groups.map((g) => `<text x="${g.x}" y="130" text-anchor="middle" class="t-label">${g.name}</text><text x="${g.x}" y="145" text-anchor="middle" class="t-small">${g.note}</text>`).join("")}
  </svg><figcaption>脚質 (きゃくしつ) = レースでの位置取りのくせ。先頭がハイペースで飛ばすと、前の馬が最後に疲れて、後ろの差し・追込が届きやすくなります</figcaption></figure>`;
};

// 図: 馬券の種類ごとに、1〜3 着のどこを当てるか
const betFigure = () => {
  const rows = [
    ["単勝", "1着の馬", [1], false, "20%"],
    ["複勝", "3着までに入る馬 (1頭)", [3], false, "20%"],
    ["枠連", "1着・2着の枠の組み合わせ", [1, 2], false, "22.5%"],
    ["馬連", "1着・2着の2頭 (順不同)", [1, 2], false, "22.5%"],
    ["ワイド", "3着までに入る2頭 (順不同)", [3, 3], false, "22.5%"],
    ["馬単", "1着・2着を着順どおり", [1, 2], true, "25%"],
    ["3連複", "1〜3着の3頭 (順不同)", [1, 2, 3], false, "25%"],
    ["3連単", "1〜3着を着順どおり", [1, 2, 3], true, "27.5%"],
  ];
  // picks: 対象の着順。[3] や [3, 3] は「3 着以内ならどこでも」の意味
  const slot = (k, picks, ordered) => {
    const on = picks[0] === 3 ? true : picks.includes(k);
    return `<span class="slot ${on ? "on" : ""}">${k}着</span>`;
  };
  return `<figure class="lfig"><table class="table bet-table"><thead><tr><th>馬券</th><th>当てるもの</th><th>対象の着順</th><th>控除率</th></tr></thead><tbody>
    ${rows.map(([n, what, picks, ord, take]) => `<tr><td><b>${n}</b></td><td>${what}</td><td class="slots">${[1, 2, 3].map((k) => slot(k, picks, ord)).join("")}${ord ? `<small>順番も</small>` : ""}</td><td class="num">${take}</td></tr>`).join("")}
  </tbody></table><figcaption>下に行くほど当てにくく、そのぶん配当が大きくなります。控除率は売上のうち払い戻しに回らない割合 (JRA)</figcaption></figure>`;
};

// 図: 売上 → 控除 → 払戻 の流れ
const poolFigure = () => `<figure class="lfig"><div class="pool">
  <div class="pool-bar"><span class="keep" style="width:20%">控除 20%<small>運営・賞金・国庫など</small></span><span class="back" style="width:80%">払い戻し 80%<small>当たった人で分ける</small></span></div>
  <p class="pool-eq num">例: 単勝の売上 1 億円、ある馬の単勝が 2,000 万円売れていて、その馬が勝った場合<br>
  払戻 = 1 億円 × 0.8 ÷ 2,000 万円 = <b>4.0 倍</b> (100 円が 400 円に)</p>
</div><figcaption>オッズは「みんながどの馬に賭けたか」で決まる (パリミュチュエル方式)。締め切りまで変わり続けます</figcaption></figure>`;

const CHAPTERS = [
  {
    id: "basics",
    title: "競馬ってなに?",
    body: () => `
      <p>競馬は、十数頭の馬が決められた距離を走り、着順を競うスポーツです。日本の競馬には大きく 2 つあります。</p>
      <ul>
        <li><b>中央競馬 (JRA)</b> — 札幌・函館・福島・新潟・東京・中山・中京・京都・阪神・小倉の 10 か所。主に土曜・日曜に開催し、1 日に 1 か所で 12 レース行います</li>
        <li><b>地方競馬 (NAR)</b> — 大井・船橋・園田など、各地の自治体が開催。平日の開催も多く、ナイター (夜のレース) もあります</li>
      </ul>
      <p>1 つのレースの流れは、<b>出走馬の発表 (出馬表)</b> → <b>パドック (下見所) で馬の様子を見せる</b> → <b>本馬場入場</b> → <b>ゲートからスタート</b> → <b>ゴール</b> → <b>着順と払戻金の確定</b> です。馬券 (勝馬投票券) は発走の少し前まで買えます。</p>
      <p class="note">${icon("info")}<span>このアプリのレース予想は、中央競馬 (JRA) の今週のレースを自動で表示します。</span></p>`,
    quiz: [{ q: "中央競馬 (JRA) の競馬場はいくつ?", options: ["10 か所", "25 か所", "47 か所"], answer: 0, why: "札幌から小倉まで 10 か所です。地方競馬を合わせると、このアプリの「競馬場」画面の 25 か所になります。" }],
  },
  {
    id: "class",
    title: "レースの格とクラス",
    body: () => `
      <p>馬は勝つたびに上のクラスへ上がります。強さが近い馬どうしで走らせるための仕組みです。</p>
      <div class="ladder">
        ${["新馬", "未勝利", "1勝クラス", "2勝クラス", "3勝クラス", "オープン (リステッド L)", "GIII", "GII", "GI"].map((c, i) => `<span style="--i:${i}">${c}</span>`).join(icon("chevron-right"))}
      </div>
      <ul>
        <li><b>新馬戦</b> — まだ 1 度もレースに出ていない馬だけのレース。<b>未勝利戦</b> はまだ勝っていない馬のレース</li>
        <li><b>重賞 (じゅうしょう)</b> — GI・GII・GIII の格付けがあるレース。<b>GI</b> が最高格で、日本ダービー・有馬記念・ジャパンカップなどがあります</li>
        <li><b>三冠</b> — 3 歳の馬が 1 年に 1 度しか出られない 3 つの GI。皐月賞・日本ダービー・菊花賞 (牝馬は桜花賞・オークス・秋華賞)</li>
      </ul>
      <h4>斤量 (きんりょう) の決め方</h4>
      <ul>
        <li><b>馬齢・定量</b> — 年齢と性別だけで決まる (例: 牝馬は 2kg 軽い)</li>
        <li><b>別定</b> — これまでに勝ったレースや賞金で重くなる</li>
        <li><b>ハンデ</b> — 強い馬ほど重くして、どの馬にも勝つチャンスがあるようにする</li>
      </ul>`,
    quiz: [{ q: "一番格が高いのはどれ?", options: ["GIII", "GI", "リステッド (L)"], answer: 1, why: "GI > GII > GIII > リステッド > 一般のオープン の順です。" }],
  },
  {
    id: "course",
    title: "コースと馬場",
    body: () => `
      <ul>
        <li><b>芝とダート</b> — 芝は草の上、ダートは砂の上を走ります。得意な馬場は馬によって違い、血統にも表れます。障害レースは、柵や水たまりを跳び越えます</li>
        <li><b>右回り・左回り</b> — 東京・中京・新潟は左回り、ほかの多くは右回りです</li>
        <li><b>距離</b> — おおよそ 1,400m までが短距離、1,600m 前後がマイル、2,400m くらいまでが中距離、それより長いと長距離です</li>
        <li><b>馬場状態</b> — 雨などで <b>良 → 稍重 (ややおも) → 重 → 不良</b> と重くなります。重い馬場が得意な馬もいます</li>
        <li><b>枠</b> — 内側の枠は走る距離が短くて有利なことが多いですが、コースや馬場によって変わります</li>
      </ul>
      <p class="note">${icon("info")}<span>ホーム画面では、天気と降水量から推定した各競馬場の馬場状態を見られます (公式発表ではありません)。</span></p>`,
    quiz: [{ q: "馬場状態で一番水を含んで重いのは?", options: ["稍重", "良", "不良"], answer: 2, why: "良 → 稍重 → 重 → 不良 の順に重くなります。" }],
  },
  {
    id: "card",
    title: "出馬表の読み方",
    body: () => `
      <p>出馬表は、そのレースに出る馬の一覧です。予想に必要な情報はほとんどここにあります。</p>
      ${cardFigure()}
      <p>枠の色は 1 白・2 黒・3 赤・4 青・5 黄・6 緑・7 橙・8 桃 と決まっていて、騎手の帽子の色と同じです。過去のレースの成績 (近走) も出馬表に載っていて、このアプリの予想はそこから計算しています。</p>`,
    quiz: [{ q: "単勝オッズ 3.5 倍の馬に 1,000 円賭けて勝ったら、いくら戻る?", options: ["1,350 円", "3,500 円", "4,500 円"], answer: 1, why: "戻る額 = 賭け金 × オッズ = 1,000 × 3.5 = 3,500 円です (賭け金を含む)。" }],
  },
  {
    id: "style",
    title: "脚質と展開",
    body: () => `
      ${styleFigure()}
      <ul>
        <li><b>逃げ</b> — スタートから先頭に立つ。自分のペースで走れれば強い</li>
        <li><b>先行</b> — 先頭のすぐ後ろ。安定して上位に来やすい</li>
        <li><b>差し</b> — 中団で力をためて、最後の直線で前の馬を抜く</li>
        <li><b>追込</b> — 最後方から一気に追い込む。展開がはまると大きく勝つ</li>
      </ul>
      <p>逃げ・先行の馬が多いと先頭争いが激しくなって <b>ハイペース</b> になり、前の馬が最後にバテやすくなります。逆に少ないと <b>スローペース</b> になり、前の馬がそのまま残りやすくなります。この「展開」を読むのが予想の面白いところです。</p>`,
    quiz: [{ q: "逃げ馬が 3 頭いるレース。有利になりやすいのは?", options: ["逃げ・先行", "差し・追込"], answer: 1, why: "先頭争いでペースが速くなり、前の馬が疲れるので、後ろで力をためた差し・追込が届きやすくなります。" }],
  },
  {
    id: "bets",
    title: "馬券の種類",
    body: () => `
      <p>馬券は 100 円から、1 点ごとに買います。当てるものが多いほど難しく、配当は大きくなります。</p>
      ${betFigure()}
      <ul>
        <li>複勝は、出走が 7 頭以下のレースでは 2 着までが対象です。枠連は 8 頭以下のレースでは発売されません</li>
        <li><b>流し</b> — 1 頭 (軸) を決めて、相手を何頭か選ぶ買い方。例: 馬連 5 → 1・3・8 は 3 点</li>
        <li><b>ボックス</b> — 選んだ馬のすべての組み合わせを買う。例: 3連複 4 頭ボックスは 4 点</li>
        <li><b>フォーメーション</b> — 1 着・2 着・3 着の候補をそれぞれ選んで組み合わせる</li>
        <li>このほか、指定された 5 レースの勝ち馬をすべて当てる <b>WIN5</b> があります</li>
      </ul>
      <p class="note">${icon("ticket")}<span>3D シミュレーションの「予想ゲーム」で、仮想のお金で全種類の馬券を試せます。</span></p>`,
    quiz: [
      { q: "1着と2着を「順番どおり」に当てる馬券は?", options: ["馬連", "馬単", "ワイド"], answer: 1, why: "馬単は順番どおり、馬連は順番を問いません。ワイドは 3 着以内の 2 頭です。" },
      { q: "3連複を 4 頭ボックスで買うと何点?", options: ["4 点", "12 点", "24 点"], answer: 0, why: "4 頭から 3 頭を選ぶ組み合わせは 4C3 = 4 通りです (3連単なら並べ方も数えるので 24 点)。" },
    ],
  },
  {
    id: "odds",
    title: "オッズと払戻のしくみ",
    body: () => `
      ${poolFigure()}
      <ul>
        <li>オッズが低い = 多くの人が買っている = 勝つと思われている (人気)</li>
        <li>払戻は 100 円あたり 10 円単位で、端数は切り捨てです。当たっても 100 円を下回ることはありません (元返し)</li>
        <li>控除率があるので、全部の馬を買うと必ず損をします。<b>単勝オッズの逆数を全部足すと 1 より大きくなる</b> のはそのためです</li>
      </ul>
      <h4>期待値</h4>
      <p>「勝つ確率 × オッズ」が 1 を超える馬券は、長い目で見て得になる計算です。例えば勝つ確率が 30% だと思う馬の単勝が 4.0 倍なら、0.3 × 4.0 = 1.2 で得、3.0 倍なら 0.9 で損です。このアプリの「買い目」は、この考え方で選んでいます。</p>`,
    quiz: [{ q: "勝つ確率 20% と考える馬の単勝が 6.0 倍。期待値は?", options: ["1.2 (得)", "0.8 (損)", "6.0"], answer: 0, why: "0.2 × 6.0 = 1.2 で、1 を超えるので予想上は得です。ただし確率の見積もりが正しい場合に限ります。" }],
  },
  {
    id: "predict",
    title: "予想の考え方とアプリの使い方",
    body: () => `
      <p>予想でよく見るポイントと、このアプリでの見方です。</p>
      <ul>
        <li><b>近走の成績</b> — 最近のレースで何着だったか、どの格のレースか → 出馬表の「指数」と、予想の見解の 1 行目</li>
        <li><b>距離と馬場の経験</b> — 今回と同じ条件で走ったことがあるか</li>
        <li><b>展開</b> — 逃げ・先行の数からペースを読み、有利な脚質を考える</li>
        <li><b>オッズとの比較</b> — 強い馬でも人気しすぎていたら買わない。予想勝率と市場の確率を比べる</li>
      </ul>
      <div class="tour">
        <a class="card" href="#/races">${icon("flag")}<b>レース予想</b><span>今週の JRA のレース。印・見解・買い方の比較</span></a>
        <a class="card" href="#/results">${icon("chart-line")}<b>予想の成績</b><span>過去のレースで、どれだけ当たったか</span></a>
        <a class="card" href="#/sim">${icon("rotate-3d")}<b>3D シミュレーション</b><span>予想ゲームで、馬券を買ってレースを見る</span></a>
        <a class="card" href="#/tools">${icon("calculator")}<b>払戻計算</b><span>買い目の点数と払戻を計算</span></a>
      </div>
      <p class="fine">予想の数学をもっと詳しく知りたい人は、<a href="https://keiba-vision-docs.pages.dev/learn/live" target="_blank" rel="noopener">ドキュメント</a> を読んでください。</p>`,
    quiz: [{ q: "強いと思う馬の単勝が 1.5 倍。予想勝率は 50%。買う?", options: ["買う (強いから)", "買わない (期待値 0.75)"], answer: 1, why: "0.5 × 1.5 = 0.75 で 1 を下回ります。強い馬でも、人気しすぎていると長い目で見て損になります。" }],
  },
  {
    id: "safe",
    title: "楽しむときの約束",
    body: () => `
      <ul>
        <li>馬券は <b>20 歳以上</b> でないと買えません (法律で決まっています)</li>
        <li>使うお金は、なくなっても困らない範囲であらかじめ決めておきましょう。負けを取り返そうとして賭け金を増やすのは危険です</li>
        <li>控除率があるので、平均すると賭けたお金より戻るお金のほうが少なくなります。このアプリの予想も、当たりを約束するものではありません</li>
        <li>のめり込みが心配なときは、JRA や各自治体の相談窓口に相談できます</li>
      </ul>
      <p>予想ゲームやシミュレーションなら、お金を使わずに予想を楽しめます。</p>`,
    quiz: [{ q: "馬券を買えるのは何歳から?", options: ["18 歳", "20 歳"], answer: 1, why: "競馬法で、20 歳未満は馬券を買うことができません。" }],
  },
];

let done = new Set();
try {
  done = new Set(JSON.parse(localStorage.getItem(DONE_KEY) || "[]"));
} catch {}
const saveDone = () => {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
  } catch {}
};

export function renderLearn() {
  const toc = $("#learn-toc"), body = $("#learn-body");
  const renderToc = (k) => {
    toc.innerHTML = `<p class="nav-label">${done.size} / ${CHAPTERS.length} 章 完了</p><div class="bar"><i style="width:${(done.size / CHAPTERS.length) * 100}%"></i></div><ol>${CHAPTERS.map(
      (x, i) => `<li><button type="button" data-ch="${x.id}" class="${i === k ? "on" : ""}">${done.has(x.id) ? icon("circle-check", "ok") : `<span class="n num">${i + 1}</span>`}${esc(x.title)}</button></li>`,
    ).join("")}</ol>`;
    $$("[data-ch]", toc).forEach((b) => b.addEventListener("click", () => show(b.dataset.ch)));
  };
  const show = (id) => {
    const k = Math.max(0, CHAPTERS.findIndex((c) => c.id === id));
    const c = CHAPTERS[k];
    renderToc(k);
    body.innerHTML = `<section class="card lesson"><p class="eyebrow">第 ${k + 1} 章</p><h2>${esc(c.title)}</h2>${c.body()}
      <div class="quiz">${c.quiz.map((q, qi) => `<div class="q" data-q="${qi}"><p><b>確認クイズ</b> ${esc(q.q)}</p><div class="opts">${q.options.map((o, oi) => `<button type="button" class="btn ghost small" data-o="${oi}">${esc(o)}</button>`).join("")}</div><p class="why" hidden></p></div>`).join("")}</div>
      <nav class="lesson-nav">${k > 0 ? `<button class="btn ghost small" type="button" data-ch="${CHAPTERS[k - 1].id}">${icon("chevron-left")}${esc(CHAPTERS[k - 1].title)}</button>` : "<span></span>"}
        ${k < CHAPTERS.length - 1 ? `<button class="btn primary small" type="button" data-ch="${CHAPTERS[k + 1].id}">次へ: ${esc(CHAPTERS[k + 1].title)}${icon("chevron-right")}</button>` : ""}</nav></section>`;
    const correct = new Set();
    $$(".q", body).forEach((qe) => {
      const q = c.quiz[+qe.dataset.q];
      $$("[data-o]", qe).forEach((b) =>
        b.addEventListener("click", () => {
          const ok = +b.dataset.o === q.answer;
          $$("[data-o]", qe).forEach((x) => x.classList.remove("right", "wrong"));
          b.classList.add(ok ? "right" : "wrong");
          const why = $(".why", qe);
          why.hidden = false;
          why.innerHTML = `${icon(ok ? "circle-check" : "circle-x")}<span>${ok ? "正解!" : `おしい! 正解は「${esc(q.options[q.answer])}」です。`} ${esc(q.why)}</span>`;
          why.className = `why ${ok ? "ok" : "ng"}`;
          if (ok) correct.add(qe.dataset.q);
          if (correct.size === c.quiz.length && !done.has(c.id)) {
            done.add(c.id);
            saveDone();
            renderToc(k); // 目次の完了マークだけ更新 (解説は消さない)
          }
        }),
      );
    });
    $$("[data-ch]", body).forEach((b) =>
      b.addEventListener("click", () => {
        show(b.dataset.ch);
        $("#view-learn").scrollIntoView({ block: "start" });
      }),
    );
  };
  show(CHAPTERS.find((c) => !done.has(c.id))?.id ?? CHAPTERS[0].id);
}
