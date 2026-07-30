const { Op } = require('sequelize');
const { Company, Entity, Contact, Asa, Pb, ImportLog, sequelize } = require('../models');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Human-friendly relative time (e.g. "3h ago", "2d ago").
const timeAgo = (date) => {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

// GET /api/dashboard  – summary + charts + recent activity for the current branch
const getDashboard = async (req, res) => {
  try {
    const branch = req.user.branch;
    const now = new Date();
    const year = now.getFullYear();
    const monthStart = new Date(year, now.getMonth(), 1);
    const yearStart = new Date(year, 0, 1);

    // ── Member / entity counts ──────────────────────────────────
    const totalCompanies = await Company.count({ where: { branch, is_active: 1 } });

    const monthlyGrowth = await Company.count({
      where: { branch, is_active: 1, created_at: { [Op.gte]: monthStart } },
    });

    const entityCounts = await Entity.findAll({
      attributes: ['entity_type', [sequelize.fn('COUNT', sequelize.col('entity_id')), 'count']],
      include: [{ model: Company, as: 'company', where: { branch, is_active: 1 }, attributes: [] }],
      group: ['entity_type'],
      raw: true,
    });
    const byType = { POM: 0, POR: 0 };
    for (const row of entityCounts) byType[row.entity_type] = parseInt(row.count, 10);
    const totalEntities = byType.POM + byType.POR;

    // ── Member growth chart (cumulative active members by month, current year) ──
    const monthlyRows = await Company.findAll({
      attributes: [
        [sequelize.fn('MONTH', sequelize.col('created_at')), 'month'],
        [sequelize.fn('COUNT', sequelize.col('company_id')), 'count'],
      ],
      where: { branch, is_active: 1, created_at: { [Op.gte]: yearStart } },
      group: [sequelize.fn('MONTH', sequelize.col('created_at'))],
      raw: true,
    });
    const perMonth = Array(12).fill(0);
    for (const row of monthlyRows) perMonth[parseInt(row.month, 10) - 1] = parseInt(row.count, 10);
    // Baseline = members already registered before this year, so the curve reflects the real running total.
    const priorTotal = await Company.count({
      where: { branch, is_active: 1, created_at: { [Op.lt]: yearStart } },
    });
    let running = priorTotal;
    const memberGrowthChart = perMonth.map((c, i) => {
      running += c;
      return { month: MONTHS[i], count: running };
    });

    const result = {
      branch,
      total_members: totalCompanies,
      monthly_growth: monthlyGrowth,
      total_entities: totalEntities,
      total_pom: byType.POM,
      total_por: byType.POR,
      member_growth_chart: memberGrowthChart,
      year,
    };

    // ── MPOASSB-only stats (ASA officers + Auxiliary Police) ────
    if (branch === 'MPOASSB') {
      result.total_asa = await Asa.count({ where: { status: 'Active' } });
      result.asa_assigned = await Asa.count({
        where: {
          status: 'Active',
          [Op.or]: [
            { entity_id: { [Op.ne]: null } },
            { assigned_region: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
          ],
        },
      });
      result.total_pb = await Pb.count({ where: { status: 'Active' } });
      result.pb_on_leave = await Pb.count({ where: { status: { [Op.ne]: 'Active' } } });
    }

    // ── Recent members (latest 5 companies, with primary entity + contact) ──
    const recentCompanies = await Company.findAll({
      where: { branch, is_active: 1 },
      include: [{
        model: Entity,
        as: 'entities',
        required: false,
        include: [{ model: Contact, as: 'contacts', required: false }],
      }],
      order: [['created_at', 'DESC']],
      limit: 5,
    });

    result.recent_members = recentCompanies.map((c) => {
      const entity = (c.entities || [])[0] || null;
      const contact = entity
        ? (entity.contacts || []).find((ct) => ct.is_primary) || (entity.contacts || [])[0]
        : null;
      return {
        id: c.company_id,
        company_name: c.company_name,
        type: c.company_type || entity?.entity_type || 'Member',
        pom: entity?.palm_oil_mill ?? byType_for(entity, 'POM'),
        por: entity ? Number(entity.plantation_area || 0) : 0,
        established: c.est_date || '-',
        contact: contact
          ? [contact.contact_name, contact.phone || contact.mobile].filter(Boolean).join(' · ')
          : 'No contact',
        status: c.is_active === 1 ? 'Active' : 'Inactive',
      };
    });

    // ── Recent activity feed (companies, imports, and ASA/PB for MPOASSB) ──
    const activity = [];

    for (const c of recentCompanies) {
      activity.push({
        id: `company-${c.company_id}`,
        description: `New member "${c.company_name}" registered`,
        type: 'orange',
        at: c.created_at,
      });
    }

    const recentImports = await ImportLog.findAll({
      where: { branch, is_dry_run: 0 },
      order: [['imported_at', 'DESC']],
      limit: 3,
    });
    for (const log of recentImports) {
      activity.push({
        id: `import-${log.log_id}`,
        description: `Imported ${log.success_count} record(s) from "${log.filename}"`,
        type: 'blue',
        at: log.imported_at,
      });
    }

    if (branch === 'MPOASSB') {
      const recentAsa = await Asa.findAll({ order: [['created_at', 'DESC']], limit: 3 });
      for (const a of recentAsa) {
        activity.push({
          id: `asa-${a.asa_id}`,
          description: `ASA officer "${a.asa_name}" added`,
          type: 'green',
          at: a.created_at,
        });
      }
      const recentPb = await Pb.findAll({ order: [['created_at', 'DESC']], limit: 3 });
      for (const p of recentPb) {
        activity.push({
          id: `pb-${p.pb_id}`,
          description: `Auxiliary police "${p.pb_name}" registered`,
          type: 'purple',
          at: p.created_at,
        });
      }
    }

    result.recent_activity = activity
      .filter((a) => a.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 8)
      .map((a) => ({ id: a.id, description: a.description, type: a.type, time_ago: timeAgo(a.at) }));

    return res.json(result);
  } catch (err) {
    console.error('[dashboard]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// Fallback POM count when entity has no explicit palm_oil_mill value.
function byType_for(entity, type) {
  if (!entity) return 0;
  return entity.entity_type === type ? 1 : 0;
}

module.exports = { getDashboard };
