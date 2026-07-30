const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pb = sequelize.define('PB', {
  pb_id: {
    type:          DataTypes.INTEGER.UNSIGNED,
    primaryKey:    true,
    autoIncrement: true,
  },
  entity_id: {
    type:      DataTypes.INTEGER.UNSIGNED,
    allowNull: true, // nullable so imported roster rows without an entity can be saved
  },
  pb_name: {
    type:      DataTypes.STRING(255),
    allowNull: false,
  },
  ic_no:            DataTypes.STRING(20),
  badge_no: {
    type:   DataTypes.STRING(50),
    unique: true,
  },
  appointment_date: DataTypes.DATEONLY,
  expiry_date:      DataTypes.DATEONLY,
  rank:             DataTypes.STRING(100),
  status: {
    type:         DataTypes.ENUM('Active', 'Inactive', 'Suspended'),
    defaultValue: 'Active',
  },
  // ── PB roster fields (from the imported database sheet) ──
  asa_name:            DataTypes.STRING(255),
  asa_police_name:     DataTypes.STRING(255),
  contingent:          DataTypes.STRING(255),
  agency:              DataTypes.STRING(255),
  assignment_location: DataTypes.STRING(255),
  body_no:             DataTypes.STRING(50),
  gender:              DataTypes.STRING(20),
  ethnicity:           DataTypes.STRING(100),
  phone_no:            DataTypes.STRING(50),
  authority_card:      DataTypes.STRING(100),
  aprc:                DataTypes.STRING(100),
  remark:              DataTypes.TEXT,
}, {
  tableName: 'PB',
});

module.exports = Pb;
