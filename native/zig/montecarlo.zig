//! Zig Monte Carlo race simulator.
//! wasm32-freestanding にビルドされ、ブラウザ (app.js) から呼ばれます。
//!   1. set_horse() で各馬のパラメータを登録
//!   2. simulate() で N 回レースを走らせる
//!   3. win_rate() / place_rate() で結果を読む

const MAX_HORSES = 18;

var speed: [MAX_HORSES]f32 = @splat(0);
var stamina: [MAX_HORSES]f32 = @splat(0);
var style: [MAX_HORSES]u32 = @splat(0);
var wins: [MAX_HORSES]u32 = @splat(0);
var places: [MAX_HORSES]u32 = @splat(0);
var runs: u32 = 0;
var rng: u32 = 0x9E3779B9;

fn nextRand() f32 {
    // xorshift32: 速くて十分ランダム (暗号用途ではない)
    rng ^= rng << 13;
    rng ^= rng >> 17;
    rng ^= rng << 5;
    return @as(f32, @floatFromInt(rng >> 8)) / 16777216.0;
}

fn gaussianish() f32 {
    // Irwin-Hall: 一様乱数4個の和で正規分布に近い揺らぎ (平均0)
    return (nextRand() + nextRand() + nextRand() + nextRand()) - 2.0;
}

/// 脚質 (0逃げ 1先行 2差し 3追込) とペース (0.8スロー〜1.2ハイ) の相性
fn styleMultiplier(s: u32, pace: f32) f32 {
    return switch (s) {
        0 => 1.04 - (pace - 1.0) * 0.30,
        1 => 1.02 - (pace - 1.0) * 0.12,
        2 => 1.00 + (pace - 1.0) * 0.15,
        else => 0.98 + (pace - 1.0) * 0.30,
    };
}

export fn set_horse(i: u32, speed_index: f32, stamina_0_1: f32, running_style: u32) void {
    if (i >= MAX_HORSES) return;
    speed[i] = speed_index;
    stamina[i] = stamina_0_1;
    style[i] = running_style;
}

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

export fn win_rate(i: u32) f32 {
    if (i >= MAX_HORSES or runs == 0) return 0;
    return @as(f32, @floatFromInt(wins[i])) * 100.0 / @as(f32, @floatFromInt(runs));
}

export fn place_rate(i: u32) f32 {
    if (i >= MAX_HORSES or runs == 0) return 0;
    return @as(f32, @floatFromInt(places[i])) * 100.0 / @as(f32, @floatFromInt(runs));
}

export fn engine_version() u32 {
    return 2;
}

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
