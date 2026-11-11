-- JRA 公式サイトから自動取得するデータ (keiba-vision-sync Worker が書き、Pages Functions が読む)

-- 開催日程 (月ごとの JSON をそのまま保存)
CREATE TABLE IF NOT EXISTS jra_schedule (
  month      TEXT PRIMARY KEY,            -- 例 202611
  json       TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

-- 今週の開催 (出馬表トップに並ぶ「5回東京1日」など)
CREATE TABLE IF NOT EXISTS jra_meetings (
  cname      TEXT PRIMARY KEY,            -- pw01drl... (レース一覧の画面コード)
  date       TEXT NOT NULL,               -- 2026-11-08
  venue      TEXT NOT NULL,               -- 05 (東京)
  label      TEXT NOT NULL,               -- 5回東京2日
  fetched_at INTEGER NOT NULL DEFAULT 0   -- レース一覧を最後に取得した時刻 (ms)
);

-- レース (レース一覧の情報 + 出馬表の中身)
CREATE TABLE IF NOT EXISTS jra_races (
  id         TEXT PRIMARY KEY,            -- 20261108-05-11 (日付-競馬場-レース番号)
  date       TEXT NOT NULL,
  venue      TEXT NOT NULL,
  race_no    INTEGER NOT NULL,
  post_time  TEXT NOT NULL DEFAULT '',
  name       TEXT NOT NULL DEFAULT '',
  grade      TEXT NOT NULL DEFAULT '',
  cond       TEXT NOT NULL DEFAULT '',
  surface    TEXT NOT NULL DEFAULT '',
  distance   INTEGER,
  field      INTEGER,
  cname      TEXT NOT NULL,               -- 出馬表の画面コード
  card       TEXT,                        -- 出馬表から取り出した JSON (見出し + 出走馬)
  card_at    INTEGER NOT NULL DEFAULT 0   -- 出馬表 (オッズ込み) を最後に取得した時刻 (ms)
);
CREATE INDEX IF NOT EXISTS jra_races_by_date ON jra_races (date, venue, race_no);

-- 取得の状態 (最終取得時刻・最後のエラーなど)
CREATE TABLE IF NOT EXISTS jra_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
