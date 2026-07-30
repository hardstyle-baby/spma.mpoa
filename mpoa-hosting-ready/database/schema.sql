-- ============================================================
-- MPOA Membership Management System - Database Schema
-- Engine: MySQL / MariaDB (XAMPP port 3306)
-- ============================================================

CREATE DATABASE IF NOT EXISTS mpoa_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mpoa_db;

-- ============================================================
-- TABLE: COMPANY
-- Top-level membership entity (one company, many entities)
-- ============================================================
CREATE TABLE IF NOT EXISTS COMPANY (
  company_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_name    VARCHAR(255)  NOT NULL,
  name_of_asa     VARCHAR(255)  NULL,       -- MPOASSB: authorized representative name (separate from corporate name)
  registration_no VARCHAR(100)  UNIQUE,
  est_date        YEAR          NULL,                        -- year only
  branch          ENUM('MPOA','MPOASSB') NOT NULL,
  address         TEXT          NULL,
  state           VARCHAR(100)  NULL,
  postcode        VARCHAR(10)   NULL,
  country         VARCHAR(100)  DEFAULT 'Malaysia',
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: ENTITY
-- A company can have multiple entities (POM / POR)
-- ============================================================
CREATE TABLE IF NOT EXISTS ENTITY (
  entity_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id      INT UNSIGNED  NOT NULL,
  entity_type     ENUM('POM','POR') NOT NULL,               -- Palm Oil Mill / Plantation
  entity_name     VARCHAR(255)  NOT NULL,
  license_no      VARCHAR(100)  NULL,
  location        VARCHAR(255)  NULL,
  state           VARCHAR(100)  NULL,
  latitude        DECIMAL(10,7) NULL,
  longitude       DECIMAL(10,7) NULL,
  capacity_mt     DECIMAL(12,2) NULL,                       -- processing capacity (MT/hr)
  planted_area_2021 VARCHAR(100) NULL,
  subscription_payment_2021 VARCHAR(100) NULL,
  sst_6           VARCHAR(100) NULL,
  payment         VARCHAR(100) NULL,
  planted_area_2020 VARCHAR(100) NULL,
  subscription_payment_2020 VARCHAR(100) NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_entity_company FOREIGN KEY (company_id)
    REFERENCES COMPANY(company_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_entity_company (company_id),
  INDEX idx_entity_type (entity_type)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: CONTACT
-- Multiple contacts per entity (slash-separated source normalised)
-- ============================================================
CREATE TABLE IF NOT EXISTS CONTACT (
  contact_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id       INT UNSIGNED  NOT NULL,
  contact_name    VARCHAR(255)  NOT NULL,
  role            VARCHAR(100)  NULL,                       -- e.g. Manager, Director
  phone           VARCHAR(30)   NULL,
  fax             VARCHAR(30)   NULL,
  mobile          VARCHAR(30)   NULL,
  email           VARCHAR(255)  NULL,
  date_new_manager DATE         NULL,
  is_primary      TINYINT(1)    NOT NULL DEFAULT 0,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contact_entity FOREIGN KEY (entity_id)
    REFERENCES ENTITY(entity_id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_contact_entity (entity_id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: ANNUAL_STATS
-- Yearly production / hectarage figures per entity
-- ============================================================
CREATE TABLE IF NOT EXISTS ANNUAL_STATS (
  stat_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id       INT UNSIGNED  NOT NULL,
  stat_year       YEAR          NOT NULL,
  planted_ha      VARCHAR(100) NULL,                       -- hectares planted
  mature_ha       VARCHAR(100) NULL,
  ffb_production  VARCHAR(100) NULL,                       -- Fresh Fruit Bunches (MT)
  cpo_production  VARCHAR(100) NULL,                       -- Crude Palm Oil (MT)
  pk_production   VARCHAR(100) NULL,                       -- Palm Kernel (MT)
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stat_entity_year (entity_id, stat_year),
  CONSTRAINT fk_stats_entity FOREIGN KEY (entity_id)
    REFERENCES ENTITY(entity_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: STAT_AUDIT
-- Audit trail for estate (ENTITY) statistic changes.
-- One row per changed field per edit, so old values are kept
-- even after ANNUAL_STATS / ENTITY are updated. Powers the
-- "Annual Stats" change history shown on the member profile.
-- ============================================================
CREATE TABLE IF NOT EXISTS STAT_AUDIT (
  audit_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id       INT UNSIGNED  NOT NULL,
  stat_year       YEAR          NULL,                       -- year the figure applies to (NULL for entity-level fields)
  field_name      VARCHAR(50)   NOT NULL,                   -- e.g. planted_ha, mature_ha, ffb_production
  field_label     VARCHAR(100)  NULL,                       -- human label for display, e.g. "Planted HA"
  old_value       VARCHAR(255)  NULL,
  new_value       VARCHAR(255)  NULL,
  action          ENUM('create','update','delete') NOT NULL DEFAULT 'update',
  changed_by      INT UNSIGNED  NULL,                       -- FK to USERS (NULL = system/import)
  changed_by_name VARCHAR(100)  NULL,                       -- denormalised username for display
  changed_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stataudit_entity FOREIGN KEY (entity_id)
    REFERENCES ENTITY(entity_id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_stataudit_entity (entity_id),
  INDEX idx_stataudit_year (stat_year)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: USERS
-- Exactly two admin accounts: one per branch
-- ============================================================
CREATE TABLE IF NOT EXISTS USERS (
  user_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username        VARCHAR(100)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255)  NOT NULL,
  branch          ENUM('MPOA','MPOASSB') NOT NULL,
  role            ENUM('superadmin','user','asa') NOT NULL DEFAULT 'user',
  access_rights   JSON          NULL,
  coverage        VARCHAR(255)  NULL,                       -- role='asa': contingent/state scope (comma-separated)
  failed_attempts TINYINT       NOT NULL DEFAULT 0,
  locked_until    DATETIME      NULL,                       -- NULL = not locked
  last_login      DATETIME      NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: ASA  (MPOASSB-exclusive)
-- Assistant Security Advisor records linked to an ENTITY
-- ============================================================
CREATE TABLE IF NOT EXISTS ASA (
  asa_id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id       INT UNSIGNED  NOT NULL,
  asa_name        VARCHAR(255)  NULL,
  ic_no           VARCHAR(20)   NULL,                       -- MyKad number
  cert_no         VARCHAR(100)  NULL,
  cert_issue_date DATE          NULL,
  cert_expiry_date DATE         NULL,
  status          ENUM('Active','Inactive','Expired') NOT NULL DEFAULT 'Active',
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_asa_entity FOREIGN KEY (entity_id)
    REFERENCES ENTITY(entity_id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_asa_entity (entity_id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: PB  (MPOASSB-exclusive)
-- Polis Bantuan / Auxiliary Police records linked to an ENTITY
-- ============================================================
CREATE TABLE IF NOT EXISTS PB (
  pb_id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id       INT UNSIGNED  NULL,                         -- nullable: imported roster rows may have no entity
  pb_name         VARCHAR(255)  NOT NULL,
  ic_no           VARCHAR(20)   NULL,
  badge_no        VARCHAR(50)   NULL UNIQUE,
  appointment_date DATE         NULL,
  expiry_date     DATE          NULL,
  rank            VARCHAR(100)  NULL,
  status          ENUM('Active','Inactive','Suspended') NOT NULL DEFAULT 'Active',
  -- ── PB roster fields (imported database sheet) ──
  asa_name            VARCHAR(255) NULL,
  asa_police_name     VARCHAR(255) NULL,
  contingent          VARCHAR(255) NULL,
  agency              VARCHAR(255) NULL,
  assignment_location VARCHAR(255) NULL,
  body_no             VARCHAR(50)  NULL,
  gender              VARCHAR(20)  NULL,
  ethnicity           VARCHAR(100) NULL,
  phone_no            VARCHAR(50)  NULL,
  authority_card      VARCHAR(100) NULL,
  aprc                VARCHAR(100) NULL,
  remark              TEXT         NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pb_entity FOREIGN KEY (entity_id)
    REFERENCES ENTITY(entity_id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_pb_entity (entity_id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: TRANSFER
-- Records inter-branch or inter-entity transfers
-- ============================================================
CREATE TABLE IF NOT EXISTS TRANSFER (
  transfer_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id       INT UNSIGNED  NOT NULL,
  from_branch     ENUM('MPOA','MPOASSB') NOT NULL,
  to_branch       ENUM('MPOA','MPOASSB') NOT NULL,
  transfer_date   DATE          NOT NULL,
  reason          TEXT          NULL,
  approved_by     INT UNSIGNED  NULL,                       -- FK to USERS
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transfer_entity  FOREIGN KEY (entity_id)
    REFERENCES ENTITY(entity_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_transfer_user    FOREIGN KEY (approved_by)
    REFERENCES USERS(user_id)    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: IMPORT_LOG
-- Audit trail for every Excel import attempt
-- ============================================================
CREATE TABLE IF NOT EXISTS IMPORT_LOG (
  log_id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  filename        VARCHAR(255)  NOT NULL,
  branch          ENUM('MPOA','MPOASSB') NOT NULL,
  imported_by     INT UNSIGNED  NOT NULL,
  imported_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_dry_run      TINYINT(1)    NOT NULL DEFAULT 0,
  total_rows      INT           NOT NULL DEFAULT 0,
  success_count   INT           NOT NULL DEFAULT 0,
  error_count     INT           NOT NULL DEFAULT 0,
  errors          JSON          NULL,                       -- array of {row, message}
  CONSTRAINT fk_importlog_user FOREIGN KEY (imported_by)
    REFERENCES USERS(user_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- SEED: Default admin accounts (passwords hashed at app boot)
-- Plaintext shown here for documentation only — DO NOT USE AS-IS
-- Run: node utils/seedUsers.js to insert with bcrypt hashes
-- ============================================================
