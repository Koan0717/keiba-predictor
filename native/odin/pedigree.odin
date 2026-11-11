// ==============================================================================
// 血統の計算 (Odin)
// ==============================================================================
// 用語:
//   クロス   … 同じ祖先が父方と母方の両方の血統表に出てくること。
//              「3×4」= その祖先が父方の 3 代前、母方の 4 代前にいる
//   血量     … その祖先の血が何% 入っているか。n 代前の祖先 1 頭分は (1/2)^n
//              3×4 なら (1/2)^3 + (1/2)^4 = 12.5% + 6.25% = 18.75% (「奇跡の血量」と呼ばれる)
//   近交係数 … 両親が血縁関係にある度合い (Wright の式)。共通祖先までの世代数 n1, n2 から
//              F = (1/2)^(n1 + n2 + 1)。n は「親から数えた」世代数なので 3×4 なら n1 = 2, n2 = 3
//              → (1/2)^6 = 1.5625%。このファイルでは代数 g から n = g - 1 として計算している
// proc "c"   : C と同じ呼び出し規約にする (WebAssembly の外から呼べるように)
// @(export)  : JS から exports.blood_percent(...) のように呼べる関数にする
// ビルド: odin build odin -target:freestanding_wasm32 -no-entry-point (native/build.sh)
package pedigree

// Odin 血統計算エンジン。freestanding_wasm32 にビルドされ、
// ブラウザの「血統・系統図」画面の血量計算機から呼ばれます。
//
// クロス表記 "3×4" = 同じ祖先が父方3代目・母方4代目に出現する、という意味。

// pow を使わずに掛け算を繰り返す (標準ライブラリを使わない freestanding 環境でも動くように)。
// (1/2)^n
@(private)
half_pow :: proc "contextless" (n: i32) -> f64 {
	r := 1.0
	for _ in 0 ..< n {
		r *= 0.5
	}
	return r
}

@(private)
valid :: proc "contextless" (g: i32) -> bool {
	return g >= 1 && g <= 12
}

// 血量 (%): その祖先の血が何%入っているか。3×4 → 12.5 + 6.25 = 18.75 (奇跡の血量)
@(export)
blood_percent :: proc "c" (gen_sire_side, gen_dam_side: i32) -> f64 {
	if !valid(gen_sire_side) || !valid(gen_dam_side) do return 0
	return (half_pow(gen_sire_side) + half_pow(gen_dam_side)) * 100
}

// g1 + g2 - 1 = (g1 - 1) + (g2 - 1) + 1 = n1 + n2 + 1
// Wright の近交係数 (%): F = (1/2)^(n1+n2+1), n = 世代数-1。3×4 → 1.5625
@(export)
inbreeding_coefficient :: proc "c" (gen_sire_side, gen_dam_side: i32) -> f64 {
	if !valid(gen_sire_side) || !valid(gen_dam_side) do return 0
	return half_pow(gen_sire_side + gen_dam_side - 1) * 100
}

// 血量 25% 以上は「濃い」(例: 2×3 = 37.5%)。12.5% 以上は「ほどよい」(3×4 など)。
// 0: 弱いクロス, 1: 適度 (活力が出やすい), 2: 濃い (リスク大)
@(export)
cross_rating :: proc "c" (gen_sire_side, gen_dam_side: i32) -> i32 {
	b := blood_percent(gen_sire_side, gen_dam_side)
	if b >= 25 do return 2
	if b >= 12.5 do return 1
	return 0
}

@(export)
engine_version :: proc "c" () -> i32 {
	return 2
}
