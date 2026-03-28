import { pool } from '../config/db.js';

export const getCategories = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.*, COUNT(p.id)::int AS product_count FROM categories c LEFT JOIN products p ON p.category_id=c.id AND p.is_active=true WHERE c.is_active=true GROUP BY c.id ORDER BY c.sort_order`
  );
  res.json({ success: true, categories: rows });
};

export const getWishlist = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT wi.id,wi.product_id,wi.created_at,p.name,p.price,p.compare_price,p.images,p.slug,p.rating,p.stock_quantity,p.brand FROM wishlist_items wi JOIN products p ON wi.product_id=p.id WHERE wi.user_id=$1 ORDER BY wi.created_at DESC`,
    [req.user.id]
  );
  res.json({ success: true, items: rows });
};

export const addToWishlist = async (req, res) => {
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ success: false, message: 'product_id required' });
  await pool.query('INSERT INTO wishlist_items (user_id,product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, product_id]);
  res.status(201).json({ success: true, message: 'Added to wishlist' });
};

export const removeFromWishlist = async (req, res) => {
  await pool.query('DELETE FROM wishlist_items WHERE user_id=$1 AND product_id=$2', [req.user.id, req.params.productId]);
  res.json({ success: true, message: 'Removed from wishlist' });
};
