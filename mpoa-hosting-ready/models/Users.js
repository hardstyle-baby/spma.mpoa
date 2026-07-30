const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Users = sequelize.define('USERS', {
  user_id: {
    type:          DataTypes.INTEGER.UNSIGNED,
    primaryKey:    true,
    autoIncrement: true,
  },
  username: {
    type:      DataTypes.STRING(100),
    allowNull: false,
    unique:    true,
  },
  password_hash: {
    type:      DataTypes.STRING(255),
    allowNull: false,
  },
  branch: {
    type:      DataTypes.ENUM('MPOA', 'MPOASSB'),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('superadmin', 'user', 'asa'),
    allowNull: false,
    defaultValue: 'user',
  },
  access_rights: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  // For role='asa': the contingent/state(s) this ASA covers (e.g. "Johor").
  // Comma-separated for multiple. Used to scope which PB officers they can see.
  coverage: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  failed_attempts: {
    type:         DataTypes.TINYINT,
    defaultValue: 0,
  },
  locked_until: DataTypes.DATE,
  last_login:   DataTypes.DATE,
}, {
  tableName: 'USERS',
});

module.exports = Users;
