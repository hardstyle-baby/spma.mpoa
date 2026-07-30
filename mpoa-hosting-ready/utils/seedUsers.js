/**
 * seedUsers.js
 * Run once after schema setup: node utils/seedUsers.js
 * Creates the two admin accounts from environment-supplied passwords.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');
const Users = require('../models/Users');

const SALT_ROUNDS = 12;

const seeds = [
  { username: 'superadmin_mpoa', password: process.env.SEED_MPOA_PASSWORD, branch: 'MPOA' },
  { username: 'superadmin_mpoassb', password: process.env.SEED_MPOASSB_PASSWORD, branch: 'MPOASSB' },
];

(async () => {
  try {
    if (seeds.some((seed) => !seed.password || seed.password.length < 12)) {
      throw new Error(
        'Set SEED_MPOA_PASSWORD and SEED_MPOASSB_PASSWORD to unique passwords of at least 12 characters.'
      );
    }
    if (seeds[0].password === seeds[1].password) {
      throw new Error('The two seed administrator passwords must be different.');
    }

    await sequelize.authenticate();
    console.log('✅  Connected to database.');

    for (const seed of seeds) {
      const hash = await bcrypt.hash(seed.password, SALT_ROUNDS);
      const [user, created] = await Users.findOrCreate({
        where: { username: seed.username },
        defaults: { password_hash: hash, branch: seed.branch, role: 'superadmin' },
      });

      if (created) {
        console.log(`✅  Created user: ${seed.username} (${seed.branch})`);
      } else {
        // Update hash in case password changed
        await user.update({
          password_hash: hash,
          branch: seed.branch,
          role: 'superadmin',
          failed_attempts: 0,
          locked_until: null,
        });
        console.log(`⚠️   User already exists, password refreshed: ${seed.username}`);
      }
    }

    console.log('\n🎉  Seed complete. Default credentials:');
    console.log('Passwords are intentionally not displayed.');
    console.log('\n⚠️  CHANGE THESE PASSWORDS BEFORE GOING LIVE!\n');
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
  } finally {
    await sequelize.close();
  }
})();
