const express         = require('express');
const router          = express.Router();
const multer          = require('multer');
const ctrl            = require('../controllers/importController');
const { verifyToken } = require('../middleware/auth');

// Store file in memory (buffer) – no disk writes
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx / .xls files are accepted.'));
    }
  },
});

router.use(verifyToken);

// POST /api/import?dry_run=true|false
router.post('/',             upload.single('file'), ctrl.importExcel);
// GET  /api/import/template
router.get('/template',      ctrl.downloadTemplate);
// GET  /api/import/export
router.get('/export',        ctrl.exportMembers);

module.exports = router;
