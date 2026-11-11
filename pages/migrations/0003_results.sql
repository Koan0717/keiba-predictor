-- レース結果 (予想の答え合わせ用)。keiba-vision-sync Worker が書き、Pages Functions が読む。
-- jra_races (今週の出馬表) と違って古いものも消さない。予想の成績を長く集計するため。
CREATE TABLE IF NOT EXISTS jra_results (
  id          TEXT PRIMARY KEY,            -- 20261108-05-11 (jra_races と同じ形)
  date        TEXT NOT NULL,
  venue       TEXT NOT NULL,
  race_no     INTEGER NOT NULL,
  cname       TEXT NOT NULL,               -- 結果ページの画面コード (pw01sde...)
  name        TEXT NOT NULL DEFAULT '',
  grade       TEXT NOT NULL DEFAULT '',
  result      TEXT,                        -- 着順と払戻金 (JSON)
  result_at   INTEGER NOT NULL DEFAULT 0,  -- 結果を最後に取りに行った時刻 (ms)
  card_cname  TEXT,                        -- そのレースの出馬表 (確定オッズ・過去 4 走)
  card        TEXT,                        -- 予想に必要な項目だけに絞った出馬表 (JSON)
  card_at     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS jra_results_by_date ON jra_results (date);
