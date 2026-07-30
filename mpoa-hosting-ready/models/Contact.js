const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Contact = sequelize.define('CONTACT', {
  contact_id: {
    type:          DataTypes.INTEGER.UNSIGNED,
    primaryKey:    true,
    autoIncrement: true,
  },
  entity_id: {
    type:      DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  contact_name: {
    type:      DataTypes.STRING(255),
    allowNull: false,
  },
  role:  DataTypes.STRING(100),
  phone: DataTypes.STRING(30),
  fax: DataTypes.STRING(30),
  mobile: DataTypes.STRING(30),
  email: DataTypes.STRING(255),
  date_new_manager: DataTypes.DATEONLY,
  is_primary: {
    type:         DataTypes.TINYINT,
    defaultValue: 0,
  },
}, {
  tableName: 'CONTACT',
});

module.exports = Contact;
