CREATE TABLE IF NOT EXISTS community_profiles (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, author TEXT NOT NULL,
  name TEXT NOT NULL, game TEXT NOT NULL, headphones TEXT NOT NULL,
  focus TEXT NOT NULL, notes TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  object_key TEXT NOT NULL, sha256 TEXT NOT NULL, request_hash TEXT NOT NULL,
  created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published'
    CHECK(status IN ('published','removed','hidden'))
);
CREATE INDEX IF NOT EXISTS community_recent ON community_profiles(status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS community_owner ON community_profiles(owner, status, created_at DESC);
CREATE INDEX IF NOT EXISTS community_game ON community_profiles(game, status, created_at DESC);
CREATE TABLE IF NOT EXISTS community_favorites (
  user_id TEXT NOT NULL, profile_id TEXT NOT NULL REFERENCES community_profiles(id),
  PRIMARY KEY(user_id, profile_id)
);
CREATE TABLE IF NOT EXISTS community_reports (
  user_id TEXT NOT NULL, profile_id TEXT NOT NULL REFERENCES community_profiles(id),
  reason TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, profile_id)
);
CREATE TABLE IF NOT EXISTS community_limits (
  user_id TEXT NOT NULL, action TEXT NOT NULL, hour INTEGER NOT NULL, count INTEGER NOT NULL,
  PRIMARY KEY(user_id, action)
);
