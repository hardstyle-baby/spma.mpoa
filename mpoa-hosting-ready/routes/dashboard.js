const express         = require('express');
const router          = express.Router();
const { getDashboard } = require('../controllers/dashboardController');
const { verifyToken }  = require('../middleware/auth');

router.get('/', verifyToken, getDashboard);  // GET /api/dashboard

module.exports = router;
