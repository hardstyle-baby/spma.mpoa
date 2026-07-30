const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { fn, col, where: sequelizeWhere } = require('sequelize');
const { Users } = require('../models');

const MAX_ATTEMPTS    = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_MINUTES = parseInt(process.env.LOCKOUT_MINUTES)    || 15;

const normalizeAccessRights = (rights) => {
  if (Array.isArray(rights)) return rights.filter(Boolean);

  if (typeof rights === 'string') {
    const trimmed = rights.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return trimmed.split(',').map((right) => right.trim()).filter(Boolean);
    }
  }

  return [];
};

const toAuthUser = (user) => ({
  user_id: user.user_id,
  username: user.username,
  branch: user.branch,
  role: user.role || 'user',
  access_rights: normalizeAccessRights(user.access_rights),
  coverage: user.coverage || null,
});

// POST /api/auth/login
const login = async (req, res) => {
  const { username, password, branch } = req.body;
  const cleanUsername = typeof username === 'string' ? username.trim() : '';
  const cleanBranch = typeof branch === 'string' ? branch.trim().toUpperCase() : '';

  if (!cleanUsername || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  if (cleanBranch && !['MPOA', 'MPOASSB'].includes(cleanBranch)) {
    return res.status(400).json({ message: 'Invalid branch selected.' });
  }

  try {
    const lookupUsername =
      cleanUsername.toLowerCase() === 'superadmin' && cleanBranch
        ? `superadmin_${cleanBranch.toLowerCase()}`
        : cleanUsername;

    const user = await Users.findOne({
      where: sequelizeWhere(fn('LOWER', col('username')), lookupUsername.toLowerCase()),
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (cleanBranch && user.branch !== cleanBranch) {
      return res.status(401).json({
        message: `This username belongs to ${user.branch}. Please select the ${user.branch} tab and try again.`,
      });
    }

    // Check lockout
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const remaining = Math.ceil(
        (new Date(user.locked_until) - new Date()) / 60000
      );
      return res.status(423).json({
        message: `Account locked. Try again in ${remaining} minute(s).`,
      });
    }

    if (!user.password_hash) {
      console.error(`[login] User ${user.username} has no password_hash.`);
      return res.status(500).json({ message: 'User password is not configured.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      const attempts = user.failed_attempts + 1;
      const updateData = { failed_attempts: attempts };

      if (attempts >= MAX_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        updateData.locked_until    = lockUntil;
        updateData.failed_attempts = 0;
        await user.update(updateData);
        return res.status(423).json({
          message: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
        });
      }

      await user.update(updateData);
      return res.status(401).json({
        message: `Invalid credentials. ${MAX_ATTEMPTS - attempts} attempt(s) remaining.`,
      });
    }

    // Successful login – reset counters
    await user.update({
      failed_attempts: 0,
      locked_until:    null,
      last_login:      new Date(),
    });

    const authUser = toAuthUser(user);
    const token = jwt.sign(
      authUser,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.json({
      token,
      user: authUser,
    });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// GET /api/auth/me  – return current user info from token
const me = async (req, res) => {
  try {
    const user = await Users.findByPk(req.user.user_id, {
      attributes: ['user_id', 'username', 'branch', 'role', 'access_rights', 'coverage', 'last_login'],
    });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json({ ...toAuthUser(user), last_login: user.last_login });
  } catch (err) {
    console.error('[me]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const cleanCurrentPassword = typeof currentPassword === 'string' ? currentPassword.trim() : '';
  const cleanNewPassword = typeof newPassword === 'string' ? newPassword.trim() : '';

  if (!cleanCurrentPassword || !cleanNewPassword) {
    return res.status(400).json({ message: 'Current password and new password are required.' });
  }

  if (cleanNewPassword.length < 12) {
    return res.status(400).json({ message: 'New password must be at least 12 characters.' });
  }

  try {
    const user = await Users.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const isMatch = await bcrypt.compare(cleanCurrentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(cleanNewPassword, salt);
    await user.update({ password_hash });

    return res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('[changePassword]', err);
    return res.status(500).json({ message: 'Server error changing password.' });
  }
};

module.exports = { login, me, changePassword };
