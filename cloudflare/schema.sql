-- Cloudflare D1 Database Schema for Keiba Vision AI

-- 1. Users table (OAuth profiles for GitHub & Google)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    provider TEXT NOT NULL, -- 'github' | 'google'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Favorites table (Favorite horses per user)
CREATE TABLE IF NOT EXISTS user_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    horse_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, horse_name)
);

-- 3. Race Prediction Notes table (User custom analysis and bets memo)
CREATE TABLE IF NOT EXISTS race_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    race_id TEXT NOT NULL,
    note TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, race_id)
);

-- 4. Betting Simulation History
CREATE TABLE IF NOT EXISTS bet_simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    race_id TEXT NOT NULL,
    bet_type TEXT NOT NULL,
    combination TEXT NOT NULL,
    bet_amount INTEGER NOT NULL,
    odds REAL NOT NULL,
    is_hit INTEGER DEFAULT 0,
    payout INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for ultra-fast query on Cloudflare Edge
CREATE INDEX IF NOT EXISTS idx_user_favorites ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_race_notes ON race_notes(user_id, race_id);
