-- NULL means an older publication with no Windows Loudness EQ information.
ALTER TABLE community_profiles ADD COLUMN loudness_enabled INTEGER CHECK(loudness_enabled IN (0,1));
ALTER TABLE community_profiles ADD COLUMN loudness_release INTEGER CHECK(loudness_release IN (0,20,40,60,80,100));
