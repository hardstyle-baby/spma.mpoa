const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { verifyToken, requireSuperAdmin } = require('../middleware/auth');

// All routes here are protected and require superadmin
router.use(verifyToken, requireSuperAdmin);

// GET /api/users
router.get('/', getAllUsers);

// POST /api/users
router.post('/', createUser);

// PUT /api/users/:id
router.put('/:id', updateUser);

// DELETE /api/users/:id
router.delete('/:id', deleteUser);

module.exports = router;
