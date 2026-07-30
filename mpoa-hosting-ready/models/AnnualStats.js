const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AnnualStats = sequelize.define('ANNUAL_STATS', {
  stat_id: {
    type:          DataTypes.INTEGER.UNSIGNED,
    primaryKey:    true,
    autoIncrement: true,
  },
  entity_id: {
    type:      DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  stat_year: {
    type:      DataTypes.INTEGER,  // YEAR
    allowNull: false,
  },
  planted_ha:     DataTypes.DECIMAL(12, 2),
  mature_ha:      DataTypes.DECIMAL(12, 2),
  ffb_production: DataTypes.DECIMAL(14, 2),
  cpo_production: DataTypes.DECIMAL(14, 2),
  pk_production:  DataTypes.DECIMAL(14, 2),
}, {
  tableName: 'ANNUAL_STATS',
  indexes: [
    { unique: true, fields: ['entity_id', 'stat_year'] },
  ],
});

module.exports = AnnualStats;
