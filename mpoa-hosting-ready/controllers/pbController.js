const { Op } = require('sequelize');
const { Pb, Entity, Company } = require('../models');

const resolveEntity = async (entity_id) => {
  return Entity.findOne({
    where:   { entity_id },
    include: [{ model: Company, as: 'company', where: { branch: 'MPOASSB' } }],
  });
};

// Parse an ASA user's coverage string ("Johor" or "Johor, Melaka") into a list.
const coverageList = (user) =>
  (user?.coverage || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Sequelize where-fragment that matches PB.contingent against the coverage list.
// Returns null when the user is not an ASA (no scoping needed).
const coverageFilter = (user) => {
  if (user?.role !== 'asa') return null;
  const areas = coverageList(user);
  if (areas.length === 0) return { contingent: null }; // ASA with no coverage sees nothing
  return { contingent: { [Op.or]: areas.map((a) => ({ [Op.like]: `%${a}%` })) } };
};

// True when a contingent value falls within the ASA's coverage.
const inCoverage = (user, contingent) => {
  const areas = coverageList(user);
  if (areas.length === 0) return false;
  const c = String(contingent || '').toLowerCase();
  return areas.some((a) => c.includes(a.toLowerCase()));
};

// GET /api/pb?entity_id=&status=&page=&limit=
const list = async (req, res) => {
  try {
    const { entity_id, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (entity_id) where.entity_id = entity_id;
    if (status)    where.status    = status;

    const { count, rows } = await Pb.findAndCountAll({
      where,
      include: [{ model: Entity, as: 'entity', include: [{ model: Company, as: 'company' }] }],
      limit:   parseInt(limit),
      offset,
      order:   [['pb_name', 'ASC']],
    });

    return res.json({ total: count, page: parseInt(page), limit: parseInt(limit), data: rows });
  } catch (err) {
    console.error('[pb.list]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// GET /api/pb/:id
const getOne = async (req, res) => {
  try {
    const pb = await Pb.findByPk(req.params.id, {
      include: [{ model: Entity, as: 'entity' }],
    });
    if (!pb) return res.status(404).json({ message: 'PB record not found.' });
    return res.json(pb);
  } catch (err) {
    console.error('[pb.getOne]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// POST /api/pb
const create = async (req, res) => {
  try {
    // ASA can only add officers inside their own coverage.
    if (req.user?.role === 'asa' && !inCoverage(req.user, req.body.contingent)) {
      return res.status(403).json({ message: 'You can only add PB officers within your coverage.' });
    }

    const { entity_id } = req.body;
    const entity = await resolveEntity(entity_id);
    if (!entity) return res.status(404).json({ message: 'Entity not found or not in MPOASSB branch.' });

    const pb = await Pb.create(req.body);
    return res.status(201).json(pb);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Badge number already exists.' });
    }
    console.error('[pb.create]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// PUT /api/pb/:id
const update = async (req, res) => {
  try {
    const pb = await Pb.findByPk(req.params.id);
    if (!pb) return res.status(404).json({ message: 'PB record not found.' });

    if (req.user?.role === 'asa') {
      // Must currently be inside coverage…
      if (!inCoverage(req.user, pb.contingent)) {
        return res.status(403).json({ message: 'You can only edit PB officers within your coverage.' });
      }
      // …and cannot be moved outside coverage.
      if (req.body.contingent !== undefined && !inCoverage(req.user, req.body.contingent)) {
        return res.status(403).json({ message: 'You cannot move a PB officer outside your coverage.' });
      }
    }

    await pb.update(req.body);
    return res.json(pb);
  } catch (err) {
    console.error('[pb.update]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// POST /api/pb/import   { rows: [...], replace: bool }
// Bulk-saves PB roster rows parsed from an imported database sheet.
const bulkImport = async (req, res) => {
  // Importing/replacing the whole roster is an admin action — not for ASA accounts.
  if (req.user?.role === 'asa') {
    return res.status(403).json({ message: 'ASA accounts cannot import the database.' });
  }

  const { rows, replace = false } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: 'No rows to import.' });
  }

  const FIELDS = [
    'asa_name', 'asa_police_name', 'contingent', 'agency', 'assignment_location',
    'ic_no', 'rank', 'body_no', 'gender', 'ethnicity', 'phone_no',
    'authority_card', 'aprc', 'remark',
  ];

  // Treat the placeholder "-" / blanks as empty.
  const clean = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' || s === '-' ? null : s;
  };

  const records = rows.map((r) => {
    const rec = { entity_id: null, status: 'Active' };
    rec.pb_name = clean(r.name) || 'Unknown';
    for (const f of FIELDS) rec[f] = clean(r[f]);
    return rec;
  });

  const t = await Pb.sequelize.transaction();
  try {
    if (replace) {
      // Wipe the existing roster before inserting the fresh sheet.
      await Pb.destroy({ where: {}, truncate: false, transaction: t });
    }
    const created = await Pb.bulkCreate(records, { transaction: t, validate: true });
    await t.commit();
    return res.status(201).json({ message: `Imported ${created.length} PB record(s).`, count: created.length });
  } catch (err) {
    await t.rollback();
    console.error('[pb.bulkImport]', err);
    return res.status(500).json({ message: err.message || 'Import failed.' });
  }
};

// DELETE /api/pb/:id
const remove = async (req, res) => {
  // Deleting/deactivating officers is not allowed for ASA accounts.
  if (req.user?.role === 'asa') {
    return res.status(403).json({ message: 'ASA accounts cannot delete PB officers.' });
  }
  try {
    const pb = await Pb.findByPk(req.params.id);
    if (!pb) return res.status(404).json({ message: 'PB record not found.' });
    await pb.update({ status: 'Inactive' });
    return res.json({ message: 'PB record deactivated.' });
  } catch (err) {
    console.error('[pb.remove]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { list, getOne, create, bulkImport, update, remove };
