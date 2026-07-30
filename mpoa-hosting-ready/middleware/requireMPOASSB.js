/**
 * requireMPOASSB – blocks MPOA branch tokens from MPOASSB-exclusive routes.
 * Must be applied AFTER verifyToken.
 *
 * Usage:
 *   router.get('/asa', verifyToken, requireMPOASSB, asaController.list);
 */
const requireMPOASSB = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  if (req.user.branch !== 'MPOASSB') {
    return res.status(403).json({
      message: 'Access denied. This resource is restricted to MPOASSB branch.',
    });
  }
  next();
};

module.exports = requireMPOASSB;
