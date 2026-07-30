// controllers/statsController.js
// Annual statistics + audit trail for an estate (ENTITY).
//
// ANNUAL_STATS holds the *current* figure per estate per year. Every edit is
// diffed field-by-field and written to STAT_AUDIT, so old values are preserved
// and the member profile can show a full change history ("audit trail").

const { Company, Entity, AnnualStats, StatAudit } = require('../models');

// Fields tracked in the audit trail, in display order.
const TRACKED_FIELDS = [
  { name: 'planted_ha',     label: 'Planted HA'     },
  { name: 'mature_ha',      label: 'Mature HA'      },
  { name: 'ffb_production', label: 'FFB Production' },
  { name: 'cpo_production', label: 'CPO Production' },
  { name: 'pk_production',  label: 'PK Production'  },
];

// Normalise a stored/incoming value to a comparable trimmed string ('' = empty).
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());

// Load an entity and confirm it belongs to a company in the caller's branch.
// Returns the entity, or null if not found / not in branch.
const findScopedEntity = async (entityId, branch) => {
  const entity = await Entity.findByPk(entityId, {
    include: [{ model: Company, as: 'company', attributes: ['company_id', 'branch', 'company_name'] }],
  });
  if (!entity || !entity.company || entity.company.branch !== branch) return null;
  return entity;
};

// ── GET /api/members/entities/:entityId/stats ───────────────────────
// Current per-year figures for one estate (newest year first).
const getEntityStats = async (req, res) => {
  try {
    const entity = await findScopedEntity(req.params.entityId, req.user.branch);
    if (!entity) return res.status(404).json({ message: 'Estate not found.' });

    const stats = await AnnualStats.findAll({
      where: { entity_id: entity.entity_id },
      order: [['stat_year', 'DESC']],
    });
    return res.json({ entity_id: entity.entity_id, entity_name: entity.entity_name, data: stats });
  } catch (err) {
    console.error('[stats.getEntityStats]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── POST /api/members/entities/:entityId/stats ──────────────────────
// Create or update one year's figures. Each changed field is logged to
// STAT_AUDIT (old → new) with the year, the editing user, and a timestamp.
const upsertEntityStat = async (req, res) => {
  try {
    const entity = await findScopedEntity(req.params.entityId, req.user.branch);
    if (!entity) return res.status(404).json({ message: 'Estate not found.' });

    const year = parseInt(req.body.stat_year, 10);
    if (!year || year < 1900 || year > 2100) {
      return res.status(400).json({ message: 'A valid stat_year is required.' });
    }

    const existing = await AnnualStats.findOne({
      where: { entity_id: entity.entity_id, stat_year: year },
    });
    const isNew = !existing;

    // Build the field set + collect audit entries for anything that changed.
    const newFields = {};
    const auditRows = [];
    for (const { name, label } of TRACKED_FIELDS) {
      if (!(name in req.body)) continue;            // field not submitted — leave as-is
      const oldVal = norm(existing ? existing[name] : '');
      const newVal = norm(req.body[name]);
      newFields[name] = req.body[name] === '' ? null : req.body[name];

      if (oldVal !== newVal && !(oldVal === '' && newVal === '')) {
        auditRows.push({
          entity_id:       entity.entity_id,
          stat_year:       year,
          field_name:      name,
          field_label:     label,
          old_value:       oldVal || null,
          new_value:       newVal || null,
          action:          isNew ? 'create' : 'update',
          changed_by:      req.user.user_id || null,
          changed_by_name: req.user.username || null,
        });
      }
    }

    // Persist the current figure (upsert on entity + year).
    let stat;
    if (existing) {
      stat = await existing.update(newFields);
    } else {
      stat = await AnnualStats.create({
        entity_id: entity.entity_id,
        stat_year: year,
        ...newFields,
      });
    }

    if (auditRows.length) await StatAudit.bulkCreate(auditRows);

    return res.status(isNew ? 201 : 200).json({
      message:       isNew ? 'Year added.' : 'Year updated.',
      data:          stat,
      changesLogged: auditRows.length,
    });
  } catch (err) {
    console.error('[stats.upsertEntityStat]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── GET /api/members/:id/audit ──────────────────────────────────────
// Full statistic change history across all of a company's estates,
// newest change first. Optional ?entity_id= to scope to one estate.
const getCompanyAudit = async (req, res) => {
  try {
    const company = await Company.findOne({
      where: { company_id: req.params.id, branch: req.user.branch },
      attributes: ['company_id'],
      include: [{ model: Entity, as: 'entities', attributes: ['entity_id', 'entity_name'] }],
    });
    if (!company) return res.status(404).json({ message: 'Member not found.' });

    const entityNames = {};
    let entityIds = (company.entities || []).map((e) => {
      entityNames[e.entity_id] = e.entity_name;
      return e.entity_id;
    });

    if (req.query.entity_id) {
      const scoped = parseInt(req.query.entity_id, 10);
      entityIds = entityIds.filter((id) => id === scoped);
    }
    if (!entityIds.length) return res.json({ data: [] });

    const audits = await StatAudit.findAll({
      where: { entity_id: entityIds },
      order: [['changed_at', 'DESC'], ['audit_id', 'DESC']],
      limit: 500,
    });

    const data = audits.map((a) => ({
      ...a.toJSON(),
      entity_name: entityNames[a.entity_id] || `Estate #${a.entity_id}`,
    }));
    return res.json({ data });
  } catch (err) {
    console.error('[stats.getCompanyAudit]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getEntityStats, upsertEntityStat, getCompanyAudit };
