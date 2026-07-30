const jwt = require('jsonwebtoken');
const { Users } = require('../models');

/**
 * verifyToken – validates the JWT and attaches decoded payload to req.user
 */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Users.findByPk(decoded.user_id, {
      attributes: ['user_id', 'username', 'branch', 'role', 'access_rights', 'coverage'],
    });
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
    req.user = user.toJSON();
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

/**
 * requireSuperAdmin – restricts route to superadmin only
 */
const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Superadmin only.' });
  }
};

module.exports = { verifyToken, requireSuperAdmin };
