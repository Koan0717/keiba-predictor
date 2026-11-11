#!/bin/sh
# dist/data/*.json を R2 (keiba-vision-data/data/) に上げる。
# Functions は R2 を優先して読むので、アプリを再デプロイしなくてもデータだけ更新できる。
set -e
cd "$(dirname "$0")"
for f in dist/data/*.json; do
  npx wrangler r2 object put "keiba-vision-data/data/$(basename "$f")" --file "$f" --content-type application/json --remote
done
