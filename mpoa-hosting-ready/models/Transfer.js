const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transfer = sequelize.define('TRANSFER', {
  transfer_id: {
    type:          DataTypes.INTEGER.UNSIGNED,
    primaryKey:    true,
    autoIncrement: true,
  },
  entity_id: {
    type:      DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  from_branch: {
    type:      DataTypes.ENUM('MPOA', 'MPOASSB'),
    allowNull: false,
  },
  to_branch: {
    type:      DataTypes.ENUM('MPOA', 'MPOASSB'),
    allowNull: false,
  },
  transfer_date: {
    type:      DataTypes.DATEONLY,
    allowNull: false,
  },
  reason:      DataTypes.TEXT,
  approved_by: DataTypes.INTEGER.UNSIGNED,
}, {
  tableName:  'TRANSFER',
  updatedAt:  false,   // transfer records are immutable
});

module.exports = Transfer;
