#!/bin/sh
# C / Zig / Odin のソースを WebAssembly にビルドし、アプリの静的ファイルへ配置します。
# ビルド済み .wasm はリポジトリに同梱済みなので、ソースを変更したときだけ実行すれば OK。
#
# 必要なツール (使うものだけでOK):
#   C    : clang + wasm-ld (LLVM)
#   Zig  : zig 0.15 以降
#   Odin : odin (dev-2025 以降) + wasm-ld
# set -e: どれかのコマンドが失敗したら、そこで止める (壊れた .wasm を作らないように)。
# cd "$(dirname "$0")": どこから実行しても、このスクリプトがあるフォルダを基準にする。
set -e
cd "$(dirname "$0")"
OUT=../src/main/resources/static/wasm
mkdir -p "$OUT"

if command -v clang >/dev/null 2>&1; then
  echo "▶ C    → keiba_physics.wasm"
  clang --target=wasm32 -O3 -nostdlib -Wl,--no-entry -Wl,--export-dynamic \
    -o "$OUT/keiba_physics.wasm" wasm/keiba_physics.c
else
  echo "… clang が無いので C はスキップ"
fi

# -fno-entry : main 関数がない (ライブラリとして使う) ことを伝える
# -rdynamic  : export fn を外から見える関数として残す
# ReleaseSmall: できるだけ小さいファイルにする最適化
if command -v zig >/dev/null 2>&1; then
  echo "▶ Zig  → montecarlo.wasm (テスト実行後)"
  (cd zig && zig test montecarlo.zig)
  (cd zig && zig build-exe montecarlo.zig -target wasm32-freestanding -fno-entry -rdynamic \
    -O ReleaseSmall -femit-bin="../$OUT/montecarlo.wasm")
else
  echo "… zig が無いので Zig はスキップ"
fi

if command -v odin >/dev/null 2>&1; then
  echo "▶ Odin → pedigree.wasm"
  odin build odin -target:freestanding_wasm32 -no-entry-point -o:size -out:"$OUT/pedigree.wasm"
else
  echo "… odin が無いので Odin はスキップ"
fi

rm -f "$OUT"/*.o
ls -l "$OUT"
