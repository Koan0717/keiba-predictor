-- ユーザー (Firebase Auth の uid がキー。パスワード等はここに保存しない)
CREATE TABLE IF NOT EXISTS users (
  uid        TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  photo_url  TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- お気に入りの馬 (名鑑の記事名、またはサンプル出馬表の馬名)
CREATE TABLE IF NOT EXISTS favorites (
  uid        TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  horse      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (uid, horse)
);

-- レースごとの予想メモ
CREATE TABLE IF NOT EXISTS notes (
  uid        TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  race_id    TEXT NOT NULL,
  note       TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (uid, race_id)
);

-- 3D シミュレーションの結果 (着順は JSON で保存)
CREATE TABLE IF NOT EXISTS sim_results (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  course_id  TEXT NOT NULL,
  course     TEXT NOT NULL,
  distance   INTEGER NOT NULL,
  surface    TEXT NOT NULL,
  result     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sim_results_by_user ON sim_results (uid, created_at DESC);
