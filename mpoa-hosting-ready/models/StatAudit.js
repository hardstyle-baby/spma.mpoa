const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Change-log for estate (ENTITY) statistic edits. One row per changed field,
// so historical values survive updates to ANNUAL_STATS. Drives the member
// profile "Annual Stats" audit trail.
const StatAudit = sequelize.define('STAT_AUDIT', {
  audit_id: {
    type:          DataTypes.INTEGER.UNSIGNED,
    primaryKey:    true,
    autoIncrement: true,
  },
  entity_id: {
    type:      DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  stat_year:       DataTypes.INTEGER,  // YEAR; NULL for entity-level fields
  field_name:      { type: DataTypes.STRING(50), allowNull: false },
  field_label:     DataTypes.STRING(100),
  old_value:       DataTypes.STRING(255),
  new_value:       DataTypes.STRING(255),
  action: {
    type:         DataTypes.ENUM('create', 'update', 'delete'),
    allowNull:    false,
    defaultValue: 'update',
  },
  changed_by:      DataTypes.INTEGER.UNSIGNED,
  changed_by_name: DataTypes.STRING(100),
  changed_at: {
    type:         DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName:  'STAT_AUDIT',
  timestamps: false,
  indexes: [
    { fields: ['entity_id'] },
    { fields: ['stat_year'] },
  ],
});

module.exports = StatAudit;
