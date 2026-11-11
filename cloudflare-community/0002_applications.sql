CREATE TABLE IF NOT EXISTS community_applications (
  user_id TEXT NOT NULL, request_id TEXT NOT NULL,
  profile_id TEXT NOT NULL REFERENCES community_profiles(id),
  PRIMARY KEY(user_id, request_id)
);
CREATE INDEX IF NOT EXISTS community_applications_profile ON community_applications(profile_id);
