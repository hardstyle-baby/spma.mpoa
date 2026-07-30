const { Asa, Entity, Company } = require('../models');

// State → region mapping (mirror of REGION_STATES on the frontend)
const REGION_STATES = {
  North:        ['Perlis', 'Kedah', 'Penang', 'Perak'],
  Central:      ['Selangor', 'Kuala Lumpur', 'Putrajaya', 'Negeri Sembilan'],
  South:        ['Melaka', 'Johor'],
  'East Coast': ['Kelantan', 'Terengganu', 'Pahang'],
  Sabah:        ['Sabah', 'Labuan'],
  Sarawak:      ['Sarawak'],
};

const STATE_TO_REGION = Object.entries(REGION_STATES).reduce((acc, [region, states]) => {
  states.forEach((s) => { acc[s.toLowerCase()] = region; });
  return acc;
}, {});

const regionForState = (state) => {
  if (!state) return null;
  return STATE_TO_REGION[String(state).toLowerCase().trim()] || null;
};

// Helper – verify entity belongs to MPOASSB company
const resolveEntity = async (entity_id) => {
  return Entity.findOne({
    where:   { entity_id },
    include: [{ model: Company, as: 'company', where: { branch: 'MPOASSB' } }],
  });
};

// GET /api/asa?entity_id=&assigned_region=&status=&page=&limit=
const list = async (req, res) => {
  try {
    const { entity_id, assigned_region, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (entity_id) where.entity_id = entity_id;
    if (assigned_region) where.assigned_region = assigned_region;
    if (status)    where.status    = status;

    const { count, rows } = await Asa.findAndCountAll({
      where,
      include: [{
        model: Entity,
        as: 'entity',
        required: false,
        include: [{ model: Company, as: 'company', where: { branch: req.user.branch }, required: false }],
      }],
      limit:   parseInt(limit),
      offset,
      order:   [['asa_name', 'ASC']],
    });

    return res.json({ total: count, page: parseInt(page), limit: parseInt(limit), data: rows });
  } catch (err) {
    console.error('[asa.list]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// GET /api/asa/:id
const getOne = async (req, res) => {
  try {
    const asa = await Asa.findByPk(req.params.id, {
      include: [{
        model: Entity,
        as: 'entity',
        required: false,
        include: [{ model: Company, as: 'company', where: { branch: req.user.branch }, required: false }],
      }],
    });
    if (!asa) return res.status(404).json({ message: 'ASA record not found.' });
    return res.json(asa);
  } catch (err) {
    console.error('[asa.getOne]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// POST /api/asa
const create = async (req, res) => {
  try {
    const { entity_id } = req.body;
    if (entity_id) {
      const entity = await resolveEntity(entity_id);
      if (!entity) return res.status(404).json({ message: 'Entity not found or not in MPOASSB branch.' });
    }

    const asa = await Asa.create(req.body);
    return res.status(201).json(asa);
  } catch (err) {
    console.error('[asa.create]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// PUT /api/asa/:id
const update = async (req, res) => {
  try {
    const asa = await Asa.findByPk(req.params.id);
    if (!asa) return res.status(404).json({ message: 'ASA record not found.' });

    if (req.body.entity_id) {
      const entity = await resolveEntity(req.body.entity_id);
      if (!entity) return res.status(404).json({ message: 'Entity not found or not in MPOASSB branch.' });
    }

    await asa.update(req.body);
    return res.json(asa);
  } catch (err) {
    console.error('[asa.update]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// DELETE /api/asa/:id
const remove = async (req, res) => {
  try {
    const asa = await Asa.findByPk(req.params.id);
    if (!asa) return res.status(404).json({ message: 'ASA record not found.' });
    await asa.update({ status: 'Inactive' });
    return res.json({ message: 'ASA record deactivated.' });
  } catch (err) {
    console.error('[asa.remove]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// POST /api/asa/auto-register
// Scans MPOASSB companies for their `name_of_asa` field and creates ASA records
// for any officer not already registered. Region is derived from the company's
// (or first entity's) state via REGION_STATES.
const autoRegister = async (req, res) => {
  try {
    const companies = await Company.findAll({
      where:   { branch: 'MPOASSB' },
      include: [{ model: Entity, as: 'entities', required: false }],
    });

    // Group every (officer name) → preferred entity_id, state, region.
    // If the same officer is named on multiple companies, keep the first
    // non-empty state/entity_id we encounter.
    const byName = new Map(); // key: lowercased trimmed name → { name, entity_id, state, region }

    for (const c of companies) {
      const raw = (c.name_of_asa || '').trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (byName.has(key)) continue;

      const firstEntity = (c.entities || [])[0];
      const stateGuess  = (firstEntity && firstEntity.state) || c.state || null;

      byName.set(key, {
        name:      raw,
        entity_id: firstEntity ? firstEntity.entity_id : null,
        state:     stateGuess,
        region:    regionForState(stateGuess),
      });
    }

    // Already-registered officers (lowercased) → skip
    const existing = await Asa.findAll({ attributes: ['asa_name'] });
    const have = new Set(existing.map(a => (a.asa_name || '').toLowerCase().trim()).filter(Boolean));

    let created = 0;
    let skipped = 0;
    const createdRows = [];
    for (const [key, info] of byName.entries()) {
      if (have.has(key)) { skipped++; continue; }
      const row = await Asa.create({
        asa_name:        info.name,
        entity_id:       info.entity_id,
        assigned_region: info.region,
        status:          'Active',
      });
      created++;
      createdRows.push({
        asa_id:          row.asa_id,
        asa_name:        row.asa_name,
        assigned_region: row.assigned_region,
        state_source:    info.state,
      });
    }

    return res.json({
      total_companies_scanned:    companies.length,
      unique_officers_found:      byName.size,
      already_registered_skipped: skipped,
      created,
      details:                    createdRows,
    });
  } catch (err) {
    console.error('[asa.autoRegister]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { list, getOne, create, update, remove, autoRegister };
