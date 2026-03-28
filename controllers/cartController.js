import { pool } from '../config/db.js';

const getCartItems = (userId) => pool.query(
  `SELECT ci.id, ci.quantity, ci.product_id, p.name, p.price, p.compare_price, p.images, p.stock_quantity, p.slug, p.brand, c.name AS category_name
   FROM cart_items ci JOIN products p ON ci.product_id=p.id LEFT JOIN categories c ON p.category_id=c.id WHERE ci.user_id=$1 ORDER BY ci.created_at DESC`,
  [userId]
);

export const getCart = async (req, res) => {
  const { rows } = await getCartItems(req.user.id);
  res.json({ success: true, items: rows });
};

export const addToCart = async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  if (!product_id) return res.status(400).json({ success: false, message: 'product_id required' });
  const { rows: pRows } = await pool.query('SELECT stock_quantity FROM products WHERE id=$1 AND is_active=true', [product_id]);
  if (!pRows[0]) return res.status(404).json({ success: false, message: 'Product not found' });
  if (pRows[0].stock_quantity < 1) return res.status(400).json({ success: false, message: 'Out of stock' });
  await pool.query(
    `INSERT INTO cart_items (user_id,product_id,quantity) VALUES ($1,$2,$3) ON CONFLICT (user_id,product_id) DO UPDATE SET quantity=cart_items.quantity+$3, updated_at=NOW()`,
    [req.user.id, product_id, parseInt(quantity)]
  );
  const { rows } = await getCartItems(req.user.id);
  res.json({ success: true, items: rows });
};

export const updateCartItem = async (req, res) => {
  const qty = parseInt(req.body.quantity);
  if (qty <= 0) {
    await pool.query('DELETE FROM cart_items WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  } else {
    await pool.query('UPDATE cart_items SET quantity=$1,updated_at=NOW() WHERE id=$2 AND user_id=$3', [qty, req.params.id, req.user.id]);
  }
  const { rows } = await getCartItems(req.user.id);
  res.json({ success: true, items: rows });
};

export const removeCartItem = async (req, res) => {
  await pool.query('DELETE FROM cart_items WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  const { rows } = await getCartItems(req.user.id);
  res.json({ success: true, items: rows });
};

export const clearCart = async (req, res) => {
  await pool.query('DELETE FROM cart_items WHERE user_id=$1', [req.user.id]);
  res.json({ success: true, items: [] });
};
