const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/memberController');
const stats   = require('../controllers/statsController');
const { verifyToken } = require('../middleware/auth');

// All routes require a valid JWT
router.use(verifyToken);

router.get('/',          ctrl.list);       // GET  /api/members
// Annual-stats audit trail (define before '/:id' so 'entities' isn't read as an id)
router.get('/entities/:entityId/stats',  stats.getEntityStats);   // GET  per-estate yearly figures
router.post('/entities/:entityId/stats', stats.upsertEntityStat); // POST add/update a year (logs audit)
router.get('/:id/audit', stats.getCompanyAudit); // GET  company-wide stat change history
router.get('/:id',       ctrl.getOne);     // GET  /api/members/:id
router.post('/',         ctrl.create);     // POST /api/members
router.put('/:id',       ctrl.update);     // PUT  /api/members/:id
router.delete('/:id',    ctrl.remove);     // DELETE /api/members/:id
router.post('/:id/entities', ctrl.addEntity); // POST /api/members/:id/entities

module.exports = router;
