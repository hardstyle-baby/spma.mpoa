const { DataTypes, Model, Op } = require('sequelize');
const sequelize = require('../config/database');

class MpoaMember extends Model {
  static async getAll({ type, status, search, page = 1, limit = 20 } = {}) {
    const where = {};
    if (type)   where.member_type   = type;
    if (status) where.status        = status;
    if (search) where.company_name  = { [Op.like]: `%${search}%` };

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await MpoaMember.findAndCountAll({
      where,
      limit:  parseInt(limit),
      offset,
      order:  [['company_name', 'ASC']],
    });

    return { data: rows, total: count };
  }

  static async getDashboardStats() {
    const [total, active, parent] = await Promise.all([
      MpoaMember.count(),
      MpoaMember.count({ where: { status: 'active' } }),
      MpoaMember.count({ where: { member_type: 'Parent' } }),
    ]);
    return { total, active, inactive: total - active, parent, member: total - parent };
  }

  static async getById(id) {
    return MpoaMember.findByPk(id);
  }

  static async findByName(name, excludeId = null) {
    const where = { company_name: name };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    return MpoaMember.findOne({ where });
  }

  // Overrides Sequelize's Model.update to accept (id, data) instead of (values, options)
  static async update(id, data) {
    const allowed = [
      'company_name', 'member_type', 'palm_oil_mills', 'plantation_area_ha',
      'established_year', 'contact_person', 'contact_email', 'contact_phone',
      'branch_id', 'status',
    ];
    const fields = {};
    allowed.forEach(k => { if (data[k] !== undefined) fields[k] = data[k]; });

    await super.update(fields, { where: { id } });
    return MpoaMember.findByPk(id);
  }

  static async deactivate(id) {
    return super.update({ status: 'inactive' }, { where: { id } });
  }
}

MpoaMember.init(
  {
    id:                 { type: DataTypes.INTEGER,       primaryKey: true, autoIncrement: true },
    company_name:       { type: DataTypes.STRING(200),   allowNull: false, unique: true },
    member_type:        { type: DataTypes.ENUM('Parent', 'Member'), allowNull: false },
    palm_oil_mills:     { type: DataTypes.INTEGER,       defaultValue: 0 },
    plantation_area_ha: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    established_year:   { type: DataTypes.INTEGER },
    contact_person:     { type: DataTypes.STRING(150),   allowNull: false },
    contact_email:      { type: DataTypes.STRING(150) },
    contact_phone:      { type: DataTypes.STRING(30) },
    branch_id:          { type: DataTypes.INTEGER },
    status:             { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
    created_by:         { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    tableName:  'mpoa_members',
    modelName:  'MpoaMember',
  }
);

module.exports = MpoaMember;
