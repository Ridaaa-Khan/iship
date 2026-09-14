
INSERT INTO users (email, password_hash, role, is_active)
VALUES (
  'admin@iship.local',
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
  'member@iship.local',
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
WHERE email = 'member@iship.local'
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  status = VALUES(status);