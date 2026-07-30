const express         = require('express');
const router          = express.Router();
const ctrl            = require('../controllers/asaController');
const { verifyToken } = require('../middleware/auth');
const requireMPOASSB  = require('../middleware/requireMPOASSB');

// All ASA routes: must be authenticated AND from MPOASSB branch
router.use(verifyToken, requireMPOASSB);

router.get('/',                 ctrl.list);          // GET    /api/asa
router.post('/auto-register',   ctrl.autoRegister);  // POST   /api/asa/auto-register
router.get('/:id',              ctrl.getOne);        // GET    /api/asa/:id
router.post('/',                ctrl.create);        // POST   /api/asa
router.put('/:id',              ctrl.update);        // PUT    /api/asa/:id
router.delete('/:id',           ctrl.remove);        // DELETE /api/asa/:id

module.exports = router;
