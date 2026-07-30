const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Asa = sequelize.define('ASA', {
  asa_id: {
    type:          DataTypes.INTEGER.UNSIGNED,
    primaryKey:    true,
    autoIncrement: true,
  },
  entity_id: {
    type:      DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },
  assigned_region: {
    type: DataTypes.STRING(50),
  },
  asa_name: {
    type:      DataTypes.STRING(255),
    allowNull: false,
  },
  ic_no:            DataTypes.STRING(20),
  cert_no:          DataTypes.STRING(100),
  cert_issue_date:  DataTypes.DATEONLY,
  cert_expiry_date: DataTypes.DATEONLY,
  status: {
    type:         DataTypes.ENUM('Active', 'Inactive', 'Expired'),
    defaultValue: 'Active',
  },
}, {
  tableName: 'ASA',
});

module.exports = Asa;
