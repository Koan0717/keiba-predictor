package pedigree

// Odin 血統計算エンジン。freestanding_wasm32 にビルドされ、
// ブラウザの「血統・系統図」画面の血量計算機から呼ばれます。
//
// クロス表記 "3×4" = 同じ祖先が父方3代目・母方4代目に出現する、という意味。

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

// Wright の近交係数 (%): F = (1/2)^(n1+n2+1), n = 世代数-1。3×4 → 1.5625
@(export)
inbreeding_coefficient :: proc "c" (gen_sire_side, gen_dam_side: i32) -> f64 {
	if !valid(gen_sire_side) || !valid(gen_dam_side) do return 0
	return half_pow(gen_sire_side + gen_dam_side - 1) * 100
}

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
