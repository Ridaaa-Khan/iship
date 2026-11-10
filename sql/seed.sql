
INSERT INTO users (email, password_hash, role, is_active)
VALUES (
  'admin@eventra.local',
  '$2b$12$8AJpcSUU6zLnyjOJmNMTi.UZ.2pb/ymoh9874FUGqNXCTjceQQjQC',
  'ADMIN',
  1
)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  is_active = VALUES(is_active);

INSERT INTO users (email, password_hash, role, is_active)
VALUES (
  'member@eventra.local',
  '$2b$12$8AJpcSUU6zLnyjOJmNMTi.UZ.2pb/ymoh9874FUGqNXCTjceQQjQC',
  'MEMBER',
  1
)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  is_active = VALUES(is_active);

INSERT INTO member_profiles (user_id, full_name, status)
SELECT id, 'Demo Member', 'ACTIVE'
FROM users
WHERE email = 'member@eventra.local'
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  status = VALUES(status);

-- Optional: assign cover images for demo events (files under uploads/events/)
-- See sql/seed-event-covers.sql for the full UPDATE list.