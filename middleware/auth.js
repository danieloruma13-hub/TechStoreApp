import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

export const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Not authorised' });
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, email, full_name, role FROM users WHERE id = $1', [decoded.id]
    );
    if (!rows[0]) return res.status(401).json({ success: false, message: 'User not found' });
    req.user = rows[0];
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid' });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
};
