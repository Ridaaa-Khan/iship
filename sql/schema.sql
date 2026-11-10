
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS check_ins;
DROP TABLE IF EXISTS qr_credentials;
DROP TABLE IF EXISTS event_registrations;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS scanner_profiles;
DROP TABLE IF EXISTS member_profiles;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('ADMIN', 'SCANNER', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE member_profiles (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  full_name   VARCHAR(150) NOT NULL,
  phone       VARCHAR(20) NULL,
  status      ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_member_profiles_user_id (user_id),
  CONSTRAINT fk_member_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE scanner_profiles (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED NOT NULL,
  scanner_name  VARCHAR(150) NOT NULL,
  gate_number   VARCHAR(50) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_scanner_profiles_user_id (user_id),
  CONSTRAINT fk_scanner_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE events (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title           VARCHAR(200) NOT NULL,
  description     TEXT NULL,
  venue           VARCHAR(255) NULL,
  starts_at       DATETIME NOT NULL,
  ends_at         DATETIME NOT NULL,
  doors_open_at   DATETIME NOT NULL,
  doors_close_at  DATETIME NOT NULL,
  capacity        INT UNSIGNED NOT NULL,
  price_paise     INT UNSIGNED NOT NULL DEFAULT 0,
  cover_image     VARCHAR(255) NULL,
  status          ENUM('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_events_status_starts (status, starts_at),
  CONSTRAINT fk_events_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_events_capacity CHECK (capacity > 0),
  CONSTRAINT chk_events_price CHECK (price_paise >= 0),
  CONSTRAINT chk_events_time_range CHECK (ends_at > starts_at),
  CONSTRAINT chk_events_doors CHECK (
    doors_open_at <= doors_close_at
    AND doors_open_at <= ends_at
    AND doors_close_at >= starts_at
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE event_registrations (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id              BIGINT UNSIGNED NOT NULL,
  member_id             BIGINT UNSIGNED NOT NULL,
  status                ENUM(
                          'PENDING_PAYMENT',
                          'PAID',
                          'CANCELLED',
                          'CHECKED_IN'
                        ) NOT NULL DEFAULT 'PENDING_PAYMENT',
  amount_paise          INT UNSIGNED NOT NULL DEFAULT 0,
  addon_count           INT UNSIGNED NOT NULL DEFAULT 0,
  entered_count         INT UNSIGNED NOT NULL DEFAULT 0,
  razorpay_order_id     VARCHAR(100) NULL,
  razorpay_payment_id   VARCHAR(100) NULL,
  razorpay_signature    VARCHAR(255) NULL,
  paid_at               DATETIME NULL,
  cancelled_at          DATETIME NULL,
  checked_in_at         DATETIME NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_registration_event_member (event_id, member_id),
  KEY idx_registrations_event_status (event_id, status),
  KEY idx_registrations_razorpay_order (razorpay_order_id),
  CONSTRAINT fk_registrations_event
    FOREIGN KEY (event_id) REFERENCES events(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_registrations_member
    FOREIGN KEY (member_id) REFERENCES member_profiles(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE qr_credentials (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id       CHAR(26) NOT NULL,
  secret_hash     VARCHAR(255) NOT NULL,
  qr_payload      VARCHAR(200) NULL,
  registration_id BIGINT UNSIGNED NOT NULL,
  event_id        BIGINT UNSIGNED NOT NULL,
  status          ENUM('ACTIVE', 'USED', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  expires_at      DATETIME NOT NULL,
  used_at         DATETIME NULL,
  revoked_at      DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_qr_public_id (public_id),
  UNIQUE KEY uq_qr_registration_id (registration_id),
  KEY idx_qr_event_status (event_id, status),
  CONSTRAINT fk_qr_registration
    FOREIGN KEY (registration_id) REFERENCES event_registrations(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_qr_event
    FOREIGN KEY (event_id) REFERENCES events(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE check_ins (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id         BIGINT UNSIGNED NOT NULL,
  registration_id  BIGINT UNSIGNED NULL,
  credential_id    BIGINT UNSIGNED NULL,
  scanner_user_id  BIGINT UNSIGNED NULL,
  device_label     VARCHAR(100) NULL,
  result           ENUM('ALLOWED', 'DENIED') NOT NULL,
  denial_reason    VARCHAR(50) NULL,
  notes            VARCHAR(500) NULL,
  voided_at        DATETIME NULL,
  void_reason      VARCHAR(255) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_check_ins_event_created (event_id, created_at),
  KEY idx_check_ins_registration (registration_id),
  CONSTRAINT fk_check_ins_event
    FOREIGN KEY (event_id) REFERENCES events(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_check_ins_registration
    FOREIGN KEY (registration_id) REFERENCES event_registrations(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_check_ins_credential
    FOREIGN KEY (credential_id) REFERENCES qr_credentials(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_check_ins_scanner
    FOREIGN KEY (scanner_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

