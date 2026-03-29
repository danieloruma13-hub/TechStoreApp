import { pool } from '../config/db.js';

export const getStats = async (req, res) => {
  try {
    const [products, orders, users, revenue] = await Promise.all([
      // Explicit aliases ensure the driver maps the keys correctly
      pool.query('SELECT COUNT(*)::int AS count FROM products WHERE is_active=true'),
      pool.query('SELECT COUNT(*)::int AS count FROM orders'),
      pool.query('SELECT COUNT(*)::int AS count FROM users'),
      pool.query("SELECT COALESCE(SUM(total_amount), 0)::float AS total FROM orders WHERE payment_status='paid'"),
    ]);

    const recentOrders = await pool.query(`
      SELECT o.*, u.full_name, u.email 
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      ORDER BY o.created_at DESC 
      LIMIT 5
    `);

    const topProducts = await pool.query(`
      SELECT p.name, p.sold_count, p.price, p.images, p.slug 
      FROM products p 
      ORDER BY p.sold_count DESC 
      LIMIT 5
    `);

    res.json({
      success: true,
      stats: { 
        products: products.rows[0]?.count || 0, 
        orders: orders.rows[0]?.count || 0, 
        users: users.rows[0]?.count || 0, 
        revenue: revenue.rows[0]?.total || 0 
      },
      recentOrders: recentOrders.rows,
      topProducts: topProducts.rows,
    });
  } catch (error) {
    console.error('Stats Error:', error);
    res.status(500).json({ success: false, message: 'Server Error fetching stats' });
  }
};

export const adminGetProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    const values = [];
    let where = 'WHERE 1=1';

    if (search) { 
      values.push(`%${search}%`); 
      where += ` AND (p.name ILIKE $${values.length} OR p.brand ILIKE $${values.length})`; 
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM products p ${where}`, values);
    
    values.push(parseInt(limit), parseInt(offset));
    const { rows } = await pool.query(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      ${where} 
      ORDER BY p.created_at DESC 
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `, values);

    res.json({ 
      success: true, 
      total: countRes.rows[0]?.count || 0, 
      pages: Math.ceil((countRes.rows[0]?.count || 0) / limit), 
      page: parseInt(page), 
      products: rows 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminCreateProduct = async (req, res) => {
  const { name, slug, description, short_description, price, compare_price, sku, stock_quantity, category_id, brand, model, specs, images, tags, is_featured, is_new, is_active } = req.body;
  
  if (!name || !price) return res.status(400).json({ success: false, message: 'Name and price are required' });
  
  const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  
  try {
    const { rows } = await pool.query(
      `INSERT INTO products (name, slug, description, short_description, price, compare_price, sku, stock_quantity, category_id, brand, model, specs, images, tags, is_featured, is_new, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
       RETURNING *`,
      [name, finalSlug, description || null, short_description || null, price, compare_price || null, sku || null, stock_quantity || 0, category_id || null, brand || null, model || null, JSON.stringify(specs || {}), JSON.stringify(images || []), tags || [], !!is_featured, !!is_new, is_active !== undefined ? !!is_active : true]
    );
    res.status(201).json({ success: true, product: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminUpdateProduct = async (req, res) => {
  const { name, slug, description, short_description, price, compare_price, sku, stock_quantity, category_id, brand, model, specs, images, tags, is_featured, is_new, is_active } = req.body;
  
  try {
    const { rows } = await pool.query(
      `UPDATE products SET name=$1, slug=$2, description=$3, short_description=$4, price=$5, compare_price=$6, sku=$7, stock_quantity=$8, category_id=$9, brand=$10, model=$11, specs=$12, images=$13, tags=$14, is_featured=$15, is_new=$16, is_active=$17, updated_at=NOW() 
       WHERE id=$18 RETURNING *`,
      [name, slug, description || null, short_description || null, price, compare_price || null, sku || null, stock_quantity || 0, category_id || null, brand || null, model || null, JSON.stringify(specs || {}), JSON.stringify(images || []), tags || [], !!is_featured, !!is_new, !!is_active, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminDeleteProduct = async (req, res) => {
  try {
    await pool.query('UPDATE products SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Product deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminGetOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    const values = [];
    let where = 'WHERE 1=1';
    
    if (status) { values.push(status); where += ` AND o.status=$${values.length}`; }
    
    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM orders o ${where}`, values);
    
    values.push(parseInt(limit), parseInt(offset));
    const { rows } = await pool.query(`
      SELECT o.*, u.full_name, u.email, u.phone 
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      ${where} 
      ORDER BY o.created_at DESC 
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `, values);

    for (const order of rows) {
      const items = await pool.query('SELECT * FROM order_items WHERE order_id=$1', [order.id]);
      order.items = items.rows;
    }
    
    res.json({ 
      success: true, 
      total: countRes.rows[0]?.count || 0, 
      pages: Math.ceil((countRes.rows[0]?.count || 0) / limit), 
      orders: rows 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminUpdateOrderStatus = async (req, res) => {
  const { status, payment_status } = req.body;
  const updates = []; const values = [];
  
  if (status) { values.push(status); updates.push(`status=$${values.length}`); }
  if (payment_status) { values.push(payment_status); updates.push(`payment_status=$${values.length}`); }
  
  if (!updates.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
  
  values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE orders SET ${updates.join(',')}, updated_at=NOW() WHERE id=$${values.length} RETURNING *`, values);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminGetUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    const values = [];
    let where = 'WHERE 1=1';

    if (search) { 
      values.push(`%${search}%`); 
      where += ` AND (full_name ILIKE $${values.length} OR email ILIKE $${values.length})`; 
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM users ${where}`, values);
    
    values.push(parseInt(limit), parseInt(offset));
    const { rows } = await pool.query(`
      SELECT id, full_name, email, phone, role, created_at 
      FROM users ${where} 
      ORDER BY created_at DESC 
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `, values);

    res.json({ 
      success: true, 
      total: countRes.rows[0]?.count || 0, 
      pages: Math.ceil((countRes.rows[0]?.count || 0) / limit), 
      users: rows 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminUpdateUserRole = async (req, res) => {
  const { role } = req.body;
  if (!['customer', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
  
  try {
    const { rows } = await pool.query('UPDATE users SET role=$1 WHERE id=$2 RETURNING id, email, full_name, role', [role, req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminGetCategories = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COUNT(p.id)::int AS product_count 
      FROM categories c 
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true 
      GROUP BY c.id 
      ORDER BY c.sort_order
    `);
    res.json({ success: true, categories: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminCreateCategory = async (req, res) => {
  const { name, slug, description, icon, sort_order } = req.body;
  if (!name || !slug) return res.status(400).json({ success: false, message: 'Name and slug required' });
  
  try {
    const { rows } = await pool.query('INSERT INTO categories (name, slug, description, icon, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *', [name, slug, description || null, icon || null, sort_order || 0]);
    res.status(201).json({ success: true, category: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminUpdateCategory = async (req, res) => {
  const { name, slug, description, icon, sort_order, is_active } = req.body;
  try {
    const { rows } = await pool.query(`UPDATE categories SET name=$1, slug=$2, description=$3, icon=$4, sort_order=$5, is_active=$6 WHERE id=$7 RETURNING *`, [name, slug, description || null, icon || null, sort_order || 0, !!is_active, req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, category: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- SITE SETTINGS ---
export const getSettings = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM site_settings');
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await pool.query(
        'INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()',
        [key, value]
      );
    }
    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- BANNERS ---
export const getBanners = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM banners ORDER BY sort_order ASC');
    res.json({ success: true, banners: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBanner = async (req, res) => {
  const { title, subtitle, image_url, link, sort_order } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO banners (title, subtitle, image_url, link, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [title, subtitle || null, image_url || null, link || null, sort_order || 0]
    );
    res.status(201).json({ success: true, banner: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBanner = async (req, res) => {
  const { title, subtitle, image_url, link, is_active, sort_order } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE banners SET title=$1, subtitle=$2, image_url=$3, link=$4, is_active=$5, sort_order=$6 WHERE id=$7 RETURNING *',
      [title, subtitle || null, image_url || null, link || null, !!is_active, sort_order || 0, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, banner: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteBanner = async (req, res) => {
  try {
    await pool.query('DELETE FROM banners WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Banner deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCharts = async (req, res) => {
  try {
    const revenueByDay = await pool.query(`
      SELECT DATE(created_at) as date, 
             COALESCE(SUM(total_amount),0)::float as revenue,
             COUNT(*)::int as orders
      FROM orders 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at) 
      ORDER BY date ASC
    `);

    const ordersByStatus = await pool.query(`
      SELECT status, COUNT(*)::int as count 
      FROM orders 
      GROUP BY status
    `);

    const topProducts = await pool.query(`
      SELECT name, sold_count, price
      FROM products 
      WHERE is_active = true
      ORDER BY sold_count DESC 
      LIMIT 6
    `);

    const usersByDay = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*)::int as count
      FROM users
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    res.json({
      success: true,
      revenueByDay: revenueByDay.rows,
      ordersByStatus: ordersByStatus.rows,
      topProducts: topProducts.rows,
      usersByDay: usersByDay.rows,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
