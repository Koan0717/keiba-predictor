// WebAssembly Acceleration Module for Keiba Vision
// High-performance stretch run physics & expected value computation

// WASM_EXPORT を付けた関数は、WebAssembly の外 (JS) から呼べるようになる。
// ビルド: clang --target=wasm32 -nostdlib (標準ライブラリなし。native/build.sh を参照)
#define WASM_EXPORT __attribute__((visibility("default")))

// Calculates horse final stretch position (0.0 to 100.0) based on physics parameters
WASM_EXPORT
float calculate_stretch_pos(
    float base_speed,     // スピード指数 (60.0 - 120.0)
    int running_style,    // 0: 逃げ, 1: 先行, 2: 差し, 3: 追込
    float pace_factor,    // 0.8 (スロー) - 1.2 (ハイ)
    float slope_penalty,  // 坂による減衰係数
    float stamina_reserve // 残存スタミナ (0.0 - 1.0)
) {
    float style_mult = 1.0f;
    if (running_style == 0) { // 逃げ
        style_mult = 1.25f - (pace_factor * 0.25f);
    } else if (running_style == 1) { // 先行
        style_mult = 1.15f - (pace_factor * 0.12f);
    } else if (running_style == 2) { // 差し
        style_mult = 0.95f + (pace_factor * 0.18f);
    } else { // 追込
        style_mult = 0.85f + (pace_factor * 0.28f);
    }

    float effective_power = (base_speed / 100.0f) * style_mult * stamina_reserve;
    float slope_factor = 1.0f - (slope_penalty * 0.08f);

    float final_pos = (effective_power * slope_factor) * 100.0f;
    if (final_pos < 10.0f) final_pos = 10.0f;
    if (final_pos > 99.5f) final_pos = 99.5f;

    return final_pos;
}

// Ultra-fast Expected Value & Anomaly Score
WASM_EXPORT
// 期待値の目安: (勝率 / 100) × オッズ。1.0 なら「賭けた額が平均で戻ってくる」水準。
// 画面で見やすいよう 75 倍して 0〜100 の指数にする (1.33 以上は 100 で頭打ち)。
// レース予想画面の出馬表「妙味」列で使っている。
float calculate_ev_index(float odds, float win_prob) {
    if (odds <= 0.0f || win_prob <= 0.0f) return 0.0f;
    float ev = (win_prob / 100.0f) * odds;
    float index = ev * 75.0f;
    if (index > 100.0f) index = 100.0f;
    return index;
}

// Version identifier
WASM_EXPORT
int get_wasm_version() {
    return 2026;
}
