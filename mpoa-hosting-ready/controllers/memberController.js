const { Op }  = require('sequelize');
const { Company, Entity, Contact, AnnualStats } = require('../models');

// ── Helpers ──────────────────────────────────────────────────

const memberIncludes = [
  {
    model: Entity,
    as:    'entities',
    include: [
      { model: Contact,     as: 'contacts'    },
      { model: AnnualStats, as: 'annualStats' },
    ],
  },
];

// ── GET /api/members  (list – branch-scoped) ─────────────────
const list = async (req, res) => {
  try {
    const { search, state, entity_type, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { branch: req.user.branch };

    if (search) {
      where.company_name = { [Op.like]: `%${search}%` };
    }
    if (state) where.state = state;

    const entityWhere = {};
    if (entity_type) entityWhere.entity_type = entity_type;

    const { count, rows } = await Company.findAndCountAll({
      where,
      include: [
        {
          model:    Entity,
          as:       'entities',
          where:    Object.keys(entityWhere).length ? entityWhere : undefined,
          required: false,
          include: [
            { model: Contact,     as: 'contacts'    },
            { model: AnnualStats, as: 'annualStats' },
          ],
        },
      ],
      limit:   parseInt(limit),
      offset,
      distinct: true,
      order:    [['company_name', 'ASC']],
    });

    return res.json({ total: count, page: parseInt(page), limit: parseInt(limit), data: rows });
  } catch (err) {
    console.error('[member.list]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── GET /api/members/:id ─────────────────────────────────────
const getOne = async (req, res) => {
  try {
    const company = await Company.findOne({
      where:   { company_id: req.params.id, branch: req.user.branch },
      include: memberIncludes,
    });
    if (!company) return res.status(404).json({ message: 'Member not found.' });
    return res.json(company);
  } catch (err) {
    console.error('[member.getOne]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── POST /api/members ────────────────────────────────────────
const create = async (req, res) => {
  try {
    const payload = { ...req.body, branch: req.user.branch };
    const company = await Company.create(payload, {
      include: [
        {
          model: Entity,
          as: 'entities',
          include: [{ model: Contact, as: 'contacts' }]
        }
      ]
    });
    return res.status(201).json(company);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Registration number already exists.' });
    }
    console.error('[member.create]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── PUT /api/members/:id ─────────────────────────────────────
const update = async (req, res) => {
  try {
    const company = await Company.findOne({
      where: { company_id: req.params.id, branch: req.user.branch },
    });
    if (!company) return res.status(404).json({ message: 'Member not found.' });

    // Prevent branch reassignment via update. Nested records are handled below.
    const { branch: _ignored, entities, ...safePayload } = req.body;
    await company.update(safePayload);

    if (Array.isArray(entities) && entities.length > 0) {
      const incomingEntity = entities[0];
      const { contacts, entity_id, ...entityPayload } = incomingEntity;

      let entity = null;
      if (entity_id) {
        entity = await Entity.findOne({
          where: { entity_id, company_id: company.company_id },
        });
      }

      if (entity) {
        await entity.update(entityPayload);
      } else {
        entity = await Entity.create({
          ...entityPayload,
          company_id: company.company_id,
        });
      }

      if (Array.isArray(contacts)) {
        for (const incomingContact of contacts) {
          const { contact_id, ...contactPayload } = incomingContact;
          let contact = null;

          if (contact_id) {
            contact = await Contact.findOne({
              where: { contact_id, entity_id: entity.entity_id },
            });
          }

          if (contact) {
            await contact.update(contactPayload);
          } else if (contactPayload.contact_name) {
            await Contact.create({
              ...contactPayload,
              entity_id: entity.entity_id,
            });
          }
        }
      }
    }

    const updated = await Company.findOne({
      where: { company_id: req.params.id, branch: req.user.branch },
      include: memberIncludes,
    });
    return res.json(updated);
  } catch (err) {
    console.error('[member.update]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── DELETE /api/members/:id (soft delete) ────────────────────
const remove = async (req, res) => {
  try {
    const company = await Company.findOne({
      where: { company_id: req.params.id, branch: req.user.branch },
    });
    if (!company) return res.status(404).json({ message: 'Member not found.' });
    await company.update({ is_active: 0 });
    return res.json({ message: 'Member deactivated.' });
  } catch (err) {
    console.error('[member.remove]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── POST /api/members/:id/entities ──────────────────────────
const addEntity = async (req, res) => {
  try {
    const company = await Company.findOne({
      where: { company_id: req.params.id, branch: req.user.branch },
    });
    if (!company) return res.status(404).json({ message: 'Member not found.' });

    const entity = await Entity.create({ ...req.body, company_id: company.company_id });
    return res.status(201).json(entity);
  } catch (err) {
    console.error('[member.addEntity]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { list, getOne, create, update, remove, addEntity };
