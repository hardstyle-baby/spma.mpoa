const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Company = sequelize.define('COMPANY', {
  company_id: {
    type:          DataTypes.INTEGER.UNSIGNED,
    primaryKey:    true,
    autoIncrement: true,
  },
  company_name: {
    type:      DataTypes.STRING(255),
    allowNull: false,
  },
  name_of_asa: {
    type: DataTypes.STRING(255),
  },
  registration_no: {
    type:   DataTypes.STRING(100),
    unique: true,
  },
  est_date: {
    type: DataTypes.INTEGER,   // YEAR stored as integer
  },
  branch: {
    type:      DataTypes.ENUM('MPOA', 'MPOASSB'),
    allowNull: false,
  },
  company_type: {
    type: DataTypes.STRING(50),
  },
  website: {
    type: DataTypes.STRING(255),
  },
  annual_production: {
    type: DataTypes.STRING(100),
  },
  coverage_region: {
    type: DataTypes.STRING(50),
  },
  address:  DataTypes.TEXT,
  state:    DataTypes.STRING(100),
  postcode: DataTypes.STRING(10),
  country: {
    type:         DataTypes.STRING(100),
    defaultValue: 'Malaysia',
  },
  // MPOASSB-specific HQ fields
  hq_tel:            DataTypes.STRING(50),
  hq_fax:            DataTypes.STRING(50),
  address_for_letter: DataTypes.TEXT,
  remarks:           DataTypes.TEXT,
  is_active: {
    type:         DataTypes.TINYINT,
    defaultValue: 1,
  },
}, {
  tableName: 'COMPANY',
});

module.exports = Company;
