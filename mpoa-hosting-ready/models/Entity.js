const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Entity = sequelize.define('ENTITY', {
  entity_id: {
    type:          DataTypes.INTEGER.UNSIGNED,
    primaryKey:    true,
    autoIncrement: true,
  },
  company_id: {
    type:      DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  entity_type: {
    type:      DataTypes.ENUM('POM', 'POR'),
    allowNull: false,
  },
  entity_name: {
    type:      DataTypes.STRING(255),
    allowNull: false,
  },
  license_no:   DataTypes.STRING(100),
  location:     DataTypes.STRING(255),
  state:        DataTypes.STRING(100),
  latitude:     DataTypes.DECIMAL(10, 7),
  longitude:    DataTypes.DECIMAL(10, 7),
  capacity_mt:  DataTypes.DECIMAL(12, 2),
  planted_area_2021: DataTypes.STRING(100),
  subscription_payment_2021: DataTypes.STRING(100),
  sst_6: DataTypes.STRING(100),
  payment: DataTypes.STRING(100),
  planted_area_2020: DataTypes.STRING(100),
  subscription_payment_2020: DataTypes.STRING(100),
  palm_oil_mill: DataTypes.INTEGER,
  plantation_area: DataTypes.DECIMAL(12, 2),
  is_active: {
    type:         DataTypes.TINYINT,
    defaultValue: 1,
  },
}, {
  tableName: 'ENTITY',
});

module.exports = Entity;
