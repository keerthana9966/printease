const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware: verifies JWT token from Authorization header.
 * Attaches req.user on success.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

/**
 * Middleware: restricts access to vendor role only.
 * Must be used AFTER authenticate.
 */
const vendorOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'vendor') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Vendor account required.'
    });
  }
  next();
};

/**
 * Middleware: restricts access to customer role only.
 * Must be used AFTER authenticate.
 */
const customerOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'customer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Customer account required.'
    });
  }
  next();
};

module.exports = { authenticate, vendorOnly, customerOnly };
