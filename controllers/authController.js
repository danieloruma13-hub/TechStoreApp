import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const userRes = (user, token) => ({
  success: true, token,
  user: { id: user.id, email: user.email, full_name: user.full_name, phone: user.phone, role: user.role },
});

export const register = async (req, res) => {
  const { full_name, email, password, phone } = req.body;
  if (!full_name || !email || !password)
    return res.status(400).json({ success: false, message: 'All fields required' });
  if (password.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  const { rows: ex } = await pool.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
  if (ex.length) return res.status(409).json({ success: false, message: 'Email already registered' });
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    'INSERT INTO users (full_name,email,password_hash,phone) VALUES ($1,$2,$3,$4) RETURNING *',
    [full_name.trim(), email.toLowerCase(), hash, phone || null]
  );
  res.status(201).json(userRes(rows[0], signToken(rows[0])));
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password required' });
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  res.json(userRes(user, signToken(user)));
};

export const getMe = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id,email,full_name,phone,role,created_at FROM users WHERE id=$1', [req.user.id]
  );
  res.json({ success: true, user: rows[0] });
};

export const updateMe = async (req, res) => {
  const { full_name, phone } = req.body;
  const { rows } = await pool.query(
    'UPDATE users SET full_name=COALESCE($1,full_name),phone=COALESCE($2,phone),updated_at=NOW() WHERE id=$3 RETURNING id,email,full_name,phone,role',
    [full_name || null, phone || null, req.user.id]
  );
  res.json({ success: true, user: rows[0] });
};
