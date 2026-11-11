#!/bin/sh
# Pages に置くファイル一式を dist/ に作る。
#   dist/index.html      … 画面 (Kotlin 版と同じもの)
#   dist/static/         … CSS / JS / アイコン / 3D モデル / WebAssembly
#   dist/data/*.json     … Kotlin の --export で書き出した名鑑・競走・競馬場などのデータ
#   dist/_headers        … キャッシュの設定
# API (/api/*) は functions/api/[[path]].ts が担当する (dist には入れない)。
set -e
cd "$(dirname "$0")"
rm -rf ./dist
mkdir -p dist
cp -R ../src/main/resources/static dist/static
cp ../src/main/resources/static/index.html dist/index.html
cat > dist/_headers <<'H'
/static/vendor/*
  Cache-Control: public, max-age=604800
/static/models/*
  Cache-Control: public, max-age=604800
/data/*
  Cache-Control: public, max-age=3600
H
(cd .. && ./gradlew installDist -q --console=plain && build/install/keiba-predictor/bin/keiba-predictor --export pages/dist/data)
du -sh dist
