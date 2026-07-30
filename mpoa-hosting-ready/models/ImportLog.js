const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImportLog = sequelize.define('IMPORT_LOG', {
  log_id: {
    type:          DataTypes.INTEGER.UNSIGNED,
    primaryKey:    true,
    autoIncrement: true,
  },
  filename: {
    type:      DataTypes.STRING(255),
    allowNull: false,
  },
  branch: {
    type:      DataTypes.ENUM('MPOA', 'MPOASSB'),
    allowNull: false,
  },
  imported_by: {
    type:      DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  imported_at: {
    type:         DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  is_dry_run: {
    type:         DataTypes.TINYINT,
    defaultValue: 0,
  },
  total_rows:    { type: DataTypes.INTEGER, defaultValue: 0 },
  success_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  error_count:   { type: DataTypes.INTEGER, defaultValue: 0 },
  errors:        DataTypes.JSON,   // array of { row, message }
}, {
  tableName: 'IMPORT_LOG',
  updatedAt: false,
});

module.exports = ImportLog;
