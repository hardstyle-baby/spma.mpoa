const bcrypt = require('bcryptjs');
const { Users } = require('../models');

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

const toUserResponse = (user) => {
  const plainUser = user.toJSON ? user.toJSON() : user;
  return {
    ...plainUser,
    role: plainUser.role || 'user',
    access_rights: normalizeAccessRights(plainUser.access_rights),
  };
};

// GET /api/users
const getAllUsers = async (req, res) => {
  try {
    const users = await Users.findAll({
      attributes: ['user_id', 'username', 'branch', 'role', 'access_rights', 'coverage', 'last_login', 'failed_attempts', 'locked_until'],
      order: [['user_id', 'ASC']],
    });
    return res.json(users.map(toUserResponse));
  } catch (err) {
    console.error('[getAllUsers]', err);
    return res.status(500).json({ message: 'Server error retrieving users.' });
  }
};

// POST /api/users
const createUser = async (req, res) => {
  const { username, password, branch, role, access_rights, coverage } = req.body;
  const cleanPassword = typeof password === 'string' ? password.trim() : '';

  if (!username || !cleanPassword || !branch) {
    return res.status(400).json({ message: 'Username, password, and branch are required.' });
  }
  if (cleanPassword.length < 12) {
    return res.status(400).json({ message: 'Password must be at least 12 characters.' });
  }

  if (role === 'asa' && (!coverage || !String(coverage).trim())) {
    return res.status(400).json({ message: 'Coverage (contingent/state) is required for an ASA account.' });
  }

  try {
    const existingUser = await Users.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(cleanPassword, salt);

    const newUser = await Users.create({
      username,
      password_hash,
      branch,
      role: role || 'user',
      access_rights: role === 'superadmin' ? [] : normalizeAccessRights(access_rights),
      coverage: role === 'asa' ? String(coverage).trim() : null,
    });

    return res.status(201).json({
      message: 'User created successfully.',
      user: toUserResponse(newUser),
    });
  } catch (err) {
    console.error('[createUser]', err);
    return res.status(500).json({ message: 'Server error creating user.' });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { password, branch, role, access_rights, coverage } = req.body;
  const cleanPassword = typeof password === 'string' ? password.trim() : '';

  try {
    if (cleanPassword && cleanPassword.length < 12) {
      return res.status(400).json({ message: 'Password must be at least 12 characters.' });
    }

    const user = await Users.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const effectiveRole = role || user.role;
    if (effectiveRole === 'asa') {
      const cov = coverage !== undefined ? coverage : user.coverage;
      if (!cov || !String(cov).trim()) {
        return res.status(400).json({ message: 'Coverage (contingent/state) is required for an ASA account.' });
      }
    }

    const updates = {};
    if (cleanPassword) {
      const salt = await bcrypt.genSalt(10);
      updates.password_hash = await bcrypt.hash(cleanPassword, salt);
    }
    if (branch) updates.branch = branch;
    if (role) updates.role = role;
    if (Object.prototype.hasOwnProperty.call(req.body, 'access_rights')) {
      updates.access_rights = role === 'superadmin' ? [] : normalizeAccessRights(access_rights);
    }
    // coverage only applies to ASA accounts; cleared otherwise
    if (effectiveRole === 'asa') {
      if (coverage !== undefined) updates.coverage = String(coverage).trim();
    } else {
      updates.coverage = null;
    }

    await user.update(updates);

    return res.json({ message: 'User updated successfully.', user: toUserResponse(user) });
  } catch (err) {
    console.error('[updateUser]', err);
    return res.status(500).json({ message: 'Server error updating user.' });
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  const { id } = req.params;
  
  if (parseInt(id) === req.user.user_id) {
    return res.status(400).json({ message: 'Cannot delete your own account.' });
  }

  try {
    const user = await Users.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await user.destroy();
    return res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('[deleteUser]', err);
    return res.status(500).json({ message: 'Server error deleting user.' });
  }
};

module.exports = { getAllUsers, createUser, updateUser, deleteUser };
