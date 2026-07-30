const express = require('express');
const router  = express.Router();
const { login, me, changePassword } = require('../controllers/authController');
const { verifyToken }  = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', login);

// GET  /api/auth/me
router.get('/me', verifyToken, me);

// PUT /api/auth/change-password
router.put('/change-password', verifyToken, changePassword);

module.exports = router;
