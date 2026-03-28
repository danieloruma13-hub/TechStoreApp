import { pool } from '../config/db.js';

export const getProducts = async (req, res) => {
  const { category, search, featured, brand, minPrice, maxPrice, sort = 'newest', page = 1, limit = 12 } = req.query;
  const values = [];
  const conditions = ['p.is_active = true'];
  if (category) { values.push(category); conditions.push(`c.slug = $${values.length}`); }
  if (search) { values.push(`%${search}%`); conditions.push(`(p.name ILIKE $${values.length} OR p.brand ILIKE $${values.length})`); }
  if (featured === 'true') conditions.push('p.is_featured = true');
  if (brand) { values.push(brand); conditions.push(`p.brand = $${values.length}`); }
  if (minPrice) { values.push(Number(minPrice)); conditions.push(`p.price >= $${values.length}`); }
  if (maxPrice) { values.push(Number(maxPrice)); conditions.push(`p.price <= $${values.length}`); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const sortMap = { newest:'p.created_at DESC', popular:'p.sold_count DESC', rating:'p.rating DESC', price_asc:'p.price ASC', price_desc:'p.price DESC' };
  const orderBy = sortMap[sort] || 'p.created_at DESC';
  const countRes = await pool.query(`SELECT COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id=c.id ${where}`, values);
  const total = parseInt(countRes.rows[0].count);
  const offset = (parseInt(page) - 1) * parseInt(limit);
  values.push(parseInt(limit), offset);
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p LEFT JOIN categories c ON p.category_id=c.id ${where} ORDER BY ${orderBy} LIMIT $${values.length-1} OFFSET $${values.length}`,
    values
  );
  res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), products: rows });
};

export const getFeatured = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.is_active=true AND p.is_featured=true ORDER BY p.sold_count DESC LIMIT 8`
  );
  res.json({ success: true, products: rows });
};

export const getProductBySlug = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.slug=$1 AND p.is_active=true`,
    [req.params.slug]
  );
  if (!rows[0]) return res.status(404).json({ success: false, message: 'Product not found' });
  const { rows: related } = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.category_id=$1 AND p.id!=$2 AND p.is_active=true ORDER BY p.rating DESC LIMIT 4`,
    [rows[0].category_id, rows[0].id]
  );
  res.json({ success: true, product: { ...rows[0], related } });
};
