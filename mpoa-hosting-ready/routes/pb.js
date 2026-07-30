const express         = require('express');
const router          = express.Router();
const ctrl            = require('../controllers/pbController');
const { verifyToken, requireSuperAdmin } = require('../middleware/auth');
const requireMPOASSB  = require('../middleware/requireMPOASSB');

router.use(verifyToken, requireMPOASSB);

router.get('/',        ctrl.list);       // GET    /api/pb
router.post('/import', requireSuperAdmin, ctrl.bulkImport); // POST /api/pb/import
router.get('/:id',     ctrl.getOne);     // GET    /api/pb/:id
router.post('/',       requireSuperAdmin, ctrl.create); // POST /api/pb
router.put('/:id',     requireSuperAdmin, ctrl.update); // PUT /api/pb/:id
router.delete('/:id',  requireSuperAdmin, ctrl.remove); // DELETE /api/pb/:id

module.exports = router;
