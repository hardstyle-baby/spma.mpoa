// database/setupMpoaTables.js
// Run once: node database/setupMpoaTables.js
// Creates MPOA membership tables without touching your existing MPOASSB tables

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const sequelize = require('../config/database');

async function setupMpoaTables() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    await sequelize.transaction(async (t) => {
      console.log('Creating MPOA membership tables...');

      // ── Branches ────────────────────────────────────────────────
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS mpoa_branches (
          id            INT AUTO_INCREMENT PRIMARY KEY,
          branch_name   VARCHAR(150) NOT NULL,
          branch_code   VARCHAR(20)  UNIQUE,
          state         VARCHAR(100),
          address       TEXT,
          contact_phone VARCHAR(30),
          created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `, { transaction: t });
      console.log('  ✓ mpoa_branches');

      // ── Members ─────────────────────────────────────────────────
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS mpoa_members (
          id                  INT AUTO_INCREMENT PRIMARY KEY,
          company_name        VARCHAR(200) NOT NULL UNIQUE,
          member_type         ENUM('Parent','Member') NOT NULL,
          palm_oil_mills      INT          DEFAULT 0,
          plantation_area_ha  DECIMAL(12,2) DEFAULT 0,
          established_year    INT,
          contact_person      VARCHAR(150) NOT NULL,
          contact_email       VARCHAR(150),
          contact_phone       VARCHAR(30),
          branch_id           INT,
          status              ENUM('active','inactive') DEFAULT 'active',
          created_by          INT,
          created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_member_branch FOREIGN KEY (branch_id)
            REFERENCES mpoa_branches(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `, { transaction: t });
      console.log('  ✓ mpoa_members');

      // ── Plantations ─────────────────────────────────────────────
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS mpoa_plantations (
          id               INT AUTO_INCREMENT PRIMARY KEY,
          member_id        INT NOT NULL,
          plantation_name  VARCHAR(200) NOT NULL,
          location         VARCHAR(200),
          state            VARCHAR(100),
          area_ha          DECIMAL(10,2) DEFAULT 0,
          created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_plantation_member FOREIGN KEY (member_id)
            REFERENCES mpoa_members(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `, { transaction: t });
      console.log('  ✓ mpoa_plantations');

      // ── Indexes ──────────────────────────────────────────────────
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_mpoa_members_status  ON mpoa_members(status);
      `, { transaction: t }).catch(() => {});
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_mpoa_members_type    ON mpoa_members(member_type);
      `, { transaction: t }).catch(() => {});
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_mpoa_plantations_member ON mpoa_plantations(member_id);
      `, { transaction: t }).catch(() => {});
      console.log('  ✓ indexes');
    });

    console.log('\n✅ All MPOA tables created successfully.');
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

setupMpoaTables();
