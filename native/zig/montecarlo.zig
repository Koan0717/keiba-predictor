//! Zig Monte Carlo race simulator.
//! wasm32-freestanding にビルドされ、ブラウザ (app.js) から呼ばれます。
//!   1. set_horse() で各馬のパラメータを登録
//!   2. simulate() で N 回レースを走らせる
//!   3. win_rate() / place_rate() で結果を読む

// ------------------------------------------------------------------------------
// しくみ
// ------------------------------------------------------------------------------
// WebAssembly には「JS から配列を渡す」簡単な方法がないので、
// 馬のデータは Zig 側のグローバル配列に 1 頭ずつ set_horse() で書き込んでもらう。
// 各馬の「その日の出来」= 基本能力 × 脚質とペースの相性 × スタミナ補正 + ランダムな揺らぎ。
// これを何万回も繰り返して 1 着・3 着以内になった回数を数える (モンテカルロ法)。
// ビルド: native/build.sh (wasm32-freestanding = OS のない環境向け。ファイルは約 1.4KB)
const MAX_HORSES = 18;

// @splat(0) は配列の全要素を 0 で初期化する書き方 (Zig 0.15 以降)。
var speed: [MAX_HORSES]f32 = @splat(0);
var stamina: [MAX_HORSES]f32 = @splat(0);
var style: [MAX_HORSES]u32 = @splat(0);
var wins: [MAX_HORSES]u32 = @splat(0);
var places: [MAX_HORSES]u32 = @splat(0);
var runs: u32 = 0;
var rng: u32 = 0x9E3779B9;

// 0 以上 1 未満の乱数を返す。上位 24 ビットを 2^24 (16777216) で割って f32 の精度に合わせる。
fn nextRand() f32 {
    // xorshift32: 速くて十分ランダム (暗号用途ではない)
    rng ^= rng << 13;
    rng ^= rng >> 17;
    rng ^= rng << 5;
    return @as(f32, @floatFromInt(rng >> 8)) / 16777216.0;
}

// 一様乱数 4 個の和は平均 2・標準偏差約 0.58 の山型の分布になる (中心極限定理)。2 を引いて平均 0 にする。
// 本物の正規分布 (Box-Muller 法) より計算が軽く、log や cos も不要。
fn gaussianish() f32 {
    // Irwin-Hall: 一様乱数4個の和で正規分布に近い揺らぎ (平均0)
    return (nextRand() + nextRand() + nextRand() + nextRand()) - 2.0;
}

// ペース 1.0 (ミドル) のときの倍率: 逃げ 1.04 > 先行 1.02 > 差し 1.00 > 追込 0.98。
// ハイペース (1.2) では前の馬が苦しくなり、逃げ 0.98 / 追込 1.04 と逆転する。
// 係数は、逃げ馬が毎回勝つような極端な結果にならないよう実データで調整した値。
/// 脚質 (0逃げ 1先行 2差し 3追込) とペース (0.8スロー〜1.2ハイ) の相性
fn styleMultiplier(s: u32, pace: f32) f32 {
    return switch (s) {
        0 => 1.04 - (pace - 1.0) * 0.30,
        1 => 1.02 - (pace - 1.0) * 0.12,
        2 => 1.00 + (pace - 1.0) * 0.15,
        else => 0.98 + (pace - 1.0) * 0.30,
    };
}

// export fn は WebAssembly の外 (JS) から呼べる関数になる。JS では exports.set_horse(...) で呼ぶ。
// 範囲外の番号は無視する (配列の外に書き込まないための安全策)。
export fn set_horse(i: u32, speed_index: f32, stamina_0_1: f32, running_style: u32) void {
    if (i >= MAX_HORSES) return;
    speed[i] = speed_index;
    stamina[i] = stamina_0_1;
    style[i] = running_style;
}

// iterations 回レースを走らせて、各馬の 1 着回数と 3 着以内回数を数える。
// seed が同じなら結果も同じ (画面の表示が毎回変わらないように、JS 側は固定の seed を渡す)。
export fn simulate(count: u32, iterations: u32, pace: f32, seed: u32) void {
    const n = @min(count, MAX_HORSES);
    rng = if (seed == 0) 0x9E3779B9 else seed;
    runs = iterations;
    for (0..MAX_HORSES) |i| {
        wins[i] = 0;
        places[i] = 0;
    }

    var it: u32 = 0;
    while (it < iterations) : (it += 1) {
        // 上位3頭だけ追跡すれば十分 (ソート不要)
        var top = [3]u32{ 0, 0, 0 };
        var topScore = [3]f32{ -1e9, -1e9, -1e9 };
        for (0..n) |idx| {
            const i: u32 = @intCast(idx);
            const base = (speed[i] / 100.0) * styleMultiplier(style[i], pace) * (0.85 + 0.15 * stamina[i]);
            // 揺らぎの大きさ 0.11: スピード指数 101〜118 の実在の出馬表で、1 番人気の勝率が 3〜4 割
            // (実際の競馬に近い値) になるように決めた。
            // 上位 3 頭を順位付きで覚えておき、より良い出来の馬が来たら下へずらして入れる (全頭の並べ替えは不要)。
            const score = base + gaussianish() * 0.11; // 指数101〜118の実データで1番人気の勝率が3〜4割になる幅
            if (score > topScore[0]) {
                top[2] = top[1]; topScore[2] = topScore[1];
                top[1] = top[0]; topScore[1] = topScore[0];
                top[0] = i; topScore[0] = score;
            } else if (score > topScore[1]) {
                top[2] = top[1]; topScore[2] = topScore[1];
                top[1] = i; topScore[1] = score;
            } else if (score > topScore[2]) {
                top[2] = i; topScore[2] = score;
            }
        }
        wins[top[0]] += 1;
        for (top[0..@min(n, 3)]) |p| places[p] += 1;
    }
}

// 勝率 (%) = 1 着回数 ÷ 試行回数 × 100。3 着以内率も同じ考え方。
export fn win_rate(i: u32) f32 {
    if (i >= MAX_HORSES or runs == 0) return 0;
    return @as(f32, @floatFromInt(wins[i])) * 100.0 / @as(f32, @floatFromInt(runs));
}

export fn place_rate(i: u32) f32 {
    if (i >= MAX_HORSES or runs == 0) return 0;
    return @as(f32, @floatFromInt(places[i])) * 100.0 / @as(f32, @floatFromInt(runs));
}

var sample: [MAX_HORSES]f32 = @splat(0);

// 3D シミュレーション用: 1 回分だけ計算し、着順は JS 側で race_score の大きい順に並べる。
/// 1 回だけレースを走らせ、各馬の「その日の出来」を記録する (3D シミュレーション用)。
/// 大きいほど速い。着順は race_score() の降順。
export fn race_once(count: u32, pace: f32, seed: u32) void {
    const n = @min(count, MAX_HORSES);
    rng = if (seed == 0) 0x9E3779B9 else seed;
    for (0..n) |idx| {
        const i: u32 = @intCast(idx);
        sample[i] = (speed[i] / 100.0) * styleMultiplier(style[i], pace) * (0.85 + 0.15 * stamina[i]) + gaussianish() * 0.11;
    }
}

export fn race_score(i: u32) f32 {
    if (i >= MAX_HORSES) return 0;
    return sample[i];
}

export fn engine_version() u32 {
    return 3;
}

// ------------------------------------------------------------------------------
// テスト (native/build.sh と GitHub Actions がビルド前に実行する)
// ------------------------------------------------------------------------------
// `zig test montecarlo.zig` で実行される自己チェック
test "strongest horse wins most and rates sum to 100" {
    const std = @import("std");
    set_horse(0, 118, 0.8, 1);
    set_horse(1, 112, 0.8, 1);
    set_horse(2, 108, 0.8, 1);
    set_horse(3, 104, 0.8, 1);
    simulate(4, 20000, 1.0, 42);
    try std.testing.expect(win_rate(0) > win_rate(1));
    try std.testing.expect(win_rate(1) > win_rate(2));
    try std.testing.expect(win_rate(2) > win_rate(3));
    try std.testing.expect(win_rate(3) > 0); // 弱い馬にも勝つ可能性が残る
    const total = win_rate(0) + win_rate(1) + win_rate(2) + win_rate(3);
    try std.testing.expectApproxEqAbs(@as(f32, 100.0), total, 0.01);
    const placeTotal = place_rate(0) + place_rate(1) + place_rate(2) + place_rate(3);
    try std.testing.expectApproxEqAbs(@as(f32, 300.0), placeTotal, 0.01);
}

test "race_once is deterministic for a seed" {
    const std = @import("std");
    set_horse(0, 110, 0.8, 1);
    set_horse(1, 105, 0.8, 2);
    race_once(2, 1.0, 99);
    const a = race_score(0);
    race_once(2, 1.0, 99);
    try std.testing.expectEqual(a, race_score(0));
    race_once(2, 1.0, 100);
    try std.testing.expect(a != race_score(0));
}
