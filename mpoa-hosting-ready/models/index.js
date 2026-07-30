const sequelize = require('../config/database');

const Company    = require('./Company');
const Entity     = require('./Entity');
const Contact    = require('./Contact');
const AnnualStats = require('./AnnualStats');
const StatAudit  = require('./StatAudit');
const Users      = require('./Users');
const Asa        = require('./Asa');
const Pb         = require('./Pb');
const Transfer   = require('./Transfer');
const ImportLog  = require('./ImportLog');
const MpoaMember = require('./MpoaMember');

// ── Associations ────────────────────────────────────────────
// Company ↔ Entity
Company.hasMany(Entity,  { foreignKey: 'company_id', as: 'entities' });
Entity.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Entity ↔ Contact
Entity.hasMany(Contact,  { foreignKey: 'entity_id', as: 'contacts' });
Contact.belongsTo(Entity, { foreignKey: 'entity_id', as: 'entity' });

// Entity ↔ AnnualStats
Entity.hasMany(AnnualStats,  { foreignKey: 'entity_id', as: 'annualStats' });
AnnualStats.belongsTo(Entity, { foreignKey: 'entity_id', as: 'entity' });

// Entity ↔ StatAudit (change-log for annual statistic edits)
Entity.hasMany(StatAudit,  { foreignKey: 'entity_id', as: 'statAudits' });
StatAudit.belongsTo(Entity, { foreignKey: 'entity_id', as: 'entity' });

// Entity ↔ ASA  (MPOASSB only)
// ASA can now be assigned by region, so entity_id is optional. Disable automatic
// FK changes here to avoid sync conflicts with existing local databases.
Entity.hasMany(Asa,  { foreignKey: 'entity_id', as: 'asaRecords', constraints: false });
Asa.belongsTo(Entity, { foreignKey: 'entity_id', as: 'entity', constraints: false });

// Entity ↔ PB  (MPOASSB only)
Entity.hasMany(Pb,   { foreignKey: 'entity_id', as: 'pbRecords' });
Pb.belongsTo(Entity,  { foreignKey: 'entity_id', as: 'entity' });

// Entity ↔ Transfer
Entity.hasMany(Transfer,  { foreignKey: 'entity_id', as: 'transfers' });
Transfer.belongsTo(Entity, { foreignKey: 'entity_id', as: 'entity' });

// Users ↔ Transfer (approver)
Users.hasMany(Transfer,    { foreignKey: 'approved_by', as: 'approvedTransfers' });
Transfer.belongsTo(Users,  { foreignKey: 'approved_by', as: 'approver' });

// Users ↔ ImportLog
Users.hasMany(ImportLog,   { foreignKey: 'imported_by', as: 'importLogs' });
ImportLog.belongsTo(Users, { foreignKey: 'imported_by', as: 'importer' });

module.exports = {
  sequelize,
  Company,
  Entity,
  Contact,
  AnnualStats,
  StatAudit,
  Users,
  Asa,
  Pb,
  Transfer,
  ImportLog,
  MpoaMember,
};
