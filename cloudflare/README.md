# ☁️ Cloudflare Backend for Keiba Vision AI

Apple Liquid Glass UI とリアルタイム AI 予想をエッジ（Cloudflare Workers + D1 + KV + Pages Assets）で超高速配信するためのバックエンドです。

---

## 🚀 主な機能
1. **Cloudflare Workers (Edge API)**:
   - 全世界 300 以上のエッジロケーションで低遅延レスポンス
   - Open-Meteo 気象APIと連携し、各競馬場のリアルタイム馬場状態を自動計算
2. **Cloudflare D1 (Edge SQLite)**:
   - ユーザープロファイル、お気に入り馬、独自予想メモをエッジデータベースで永続化
3. **Cloudflare KV**:
   - オッズやAI解析結果をエッジキャッシュし、ミリ秒単位で高速返却
4. **Cloudflare Assets**:
   - `src/main/resources/static/` にある Apple Liquid Glass UI をそのまま静的アセットとして全世界配信

---

## 🛠️ デプロイ手順

### 1. 依存関係のインストール
```bash
cd cloudflare
npm install
```

### 2. D1 データベースの作成
```bash
npx wrangler d1 create keiba-vision-db
```
※ 出力された `database_id` を `wrangler.toml` の `database_id` に貼り付けます。

### 3. テーブルの初期化
```bash
npm run d1:init
```

### 4. KV ネームスペースの作成 (キャッシュ用)
```bash
npx wrangler kv:namespace create KEIBA_CACHE
```
※ 出力された `id` を `wrangler.toml` の `KEIBA_CACHE` の `id` に貼り付けます。

### 5. エッジへのワンコマンドデプロイ
```bash
npm run deploy
```
デプロイ完了後、`https://keiba-vision-ai.<your-subdomain>.workers.dev` で全世界からアクセス可能になります。
