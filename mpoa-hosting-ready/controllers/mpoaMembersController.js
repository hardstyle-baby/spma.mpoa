// controllers/mpoaMembersController.js
// Fits your existing controllers/ folder pattern

const MpoaMember = require('../models/MpoaMember');

// ─────────────────────────────────────────────────────────────────
// GET /api/mpoa/members
// ─────────────────────────────────────────────────────────────────
const getMembers = async (req, res) => {
  try {
    const { type, status, search, page = 1, limit = 20 } = req.query;
    const { data, total } = await MpoaMember.getAll({ type, status, search, page, limit });

    res.json({
      data,
      pagination: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[mpoaMembers] getMembers:', err.message);
    res.status(500).json({ message: 'Failed to fetch members' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/mpoa/members/stats/dashboard
// ─────────────────────────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const stats = await MpoaMember.getDashboardStats();
    res.json(stats);
  } catch (err) {
    console.error('[mpoaMembers] getDashboardStats:', err.message);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/mpoa/members/:id
// ─────────────────────────────────────────────────────────────────
const getMemberById = async (req, res) => {
  try {
    const member = await MpoaMember.getById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
  } catch (err) {
    console.error('[mpoaMembers] getMemberById:', err.message);
    res.status(500).json({ message: 'Failed to fetch member' });
  }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/mpoa/members
// ─────────────────────────────────────────────────────────────────
const createMember = async (req, res) => {
  try {
    const {
      company_name, member_type, palm_oil_mills, plantation_area_ha,
      established_year, contact_person, contact_email, contact_phone,
      branch_id, status,
    } = req.body;

    // Validation
    if (!company_name?.trim())   return res.status(400).json({ message: 'company_name is required' });
    if (!contact_person?.trim()) return res.status(400).json({ message: 'contact_person is required' });
    if (!member_type)            return res.status(400).json({ message: 'member_type is required' });
    if (!['Parent', 'Member'].includes(member_type)) {
      return res.status(400).json({ message: 'member_type must be Parent or Member' });
    }

    // Duplicate check
    const existing = await MpoaMember.findByName(company_name.trim());
    if (existing) return res.status(409).json({ message: 'A member with this company name already exists' });

    const newMember = await MpoaMember.create({
      company_name: company_name.trim(),
      member_type, palm_oil_mills, plantation_area_ha,
      established_year, contact_person: contact_person.trim(),
      contact_email, contact_phone, branch_id, status,
      created_by: req.user?.id,
    });

    res.status(201).json({ message: 'Member created successfully', data: newMember });
  } catch (err) {
    console.error('[mpoaMembers] createMember:', err.message);
    res.status(500).json({ message: 'Failed to create member' });
  }
};

// ─────────────────────────────────────────────────────────────────
// PUT /api/mpoa/members/:id
// ─────────────────────────────────────────────────────────────────
const updateMember = async (req, res) => {
  try {
    const { id } = req.params;

    // Check exists
    const existing = await MpoaMember.getById(id);
    if (!existing) return res.status(404).json({ message: 'Member not found' });

    const { member_type, company_name } = req.body;

    // Type validation
    if (member_type && !['Parent', 'Member'].includes(member_type)) {
      return res.status(400).json({ message: 'member_type must be Parent or Member' });
    }

    // Duplicate name check (excluding self)
    if (company_name) {
      const dup = await MpoaMember.findByName(company_name.trim(), id);
      if (dup) return res.status(409).json({ message: 'Another member with this company name exists' });
    }

    const updated = await MpoaMember.update(id, req.body);
    res.json({ message: 'Member updated successfully', data: updated });
  } catch (err) {
    console.error('[mpoaMembers] updateMember:', err.message);
    res.status(500).json({ message: 'Failed to update member' });
  }
};

// ─────────────────────────────────────────────────────────────────
// DELETE /api/mpoa/members/:id  (soft delete)
// ─────────────────────────────────────────────────────────────────
const deleteMember = async (req, res) => {
  try {
    const existing = await MpoaMember.getById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Member not found' });

    await MpoaMember.deactivate(req.params.id);
    res.json({ message: 'Member deactivated successfully' });
  } catch (err) {
    console.error('[mpoaMembers] deleteMember:', err.message);
    res.status(500).json({ message: 'Failed to deactivate member' });
  }
};

module.exports = {
  getMembers,
  getDashboardStats,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
};
