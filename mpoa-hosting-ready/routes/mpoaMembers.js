// routes/mpoaMembers.js
const express = require('express');
const router  = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
  getMembers,
  getDashboardStats,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
} = require('../controllers/mpoaMembersController');

router.use(verifyToken);

// Stats must be before /:id so it isn't caught as an id param
router.get('/stats/dashboard', getDashboardStats);

router.get('/',       getMembers);
router.get('/:id',    getMemberById);
router.post('/',      createMember);
router.put('/:id',    updateMember);
router.delete('/:id', deleteMember);

module.exports = router;
