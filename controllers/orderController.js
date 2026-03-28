import { pool } from '../config/db.js';

export const getOrders = async (req, res) => {
  const { rows: orders } = await pool.query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  for (const order of orders) {
    const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_id=$1', [order.id]);
    order.items = items;
  }
  res.json({ success: true, orders });
};

export const createOrder = async (req, res) => {
  const { items, shipping_address, payment_method, notes } = req.body;
  if (!items?.length) return res.status(400).json({ success: false, message: 'Order must have items' });
  if (!shipping_address?.address_line1 || !shipping_address?.city || !shipping_address?.state)
    return res.status(400).json({ success: false, message: 'Complete shipping address required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let subtotal = 0;
    const resolved = [];
    for (const item of items) {
      const { rows } = await client.query('SELECT * FROM products WHERE id=$1 AND is_active=true FOR UPDATE', [item.product_id]);
      const product = rows[0];
      if (!product) throw Object.assign(new Error(`Product not found`), { statusCode: 404 });
      if (product.stock_quantity < item.quantity) throw Object.assign(new Error(`Insufficient stock for "${product.name}"`), { statusCode: 400 });
      subtotal += parseFloat(product.price) * item.quantity;
      resolved.push({ product, quantity: item.quantity });
    }
    const shipping_fee = subtotal >= 50000 ? 0 : 2500;
    const total_amount = subtotal + shipping_fee;
    const order_number = 'TS' + Date.now().toString().slice(-8).toUpperCase();
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (order_number,user_id,subtotal,shipping_fee,total_amount,shipping_address,payment_method,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [order_number, req.user.id, subtotal, shipping_fee, total_amount, JSON.stringify(shipping_address), payment_method || 'bank_transfer', notes || null]
    );
    const order = orderRows[0];
    for (const { product, quantity } of resolved) {
      await client.query(
        `INSERT INTO order_items (order_id,product_id,product_name,product_image,quantity,unit_price,total_price) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [order.id, product.id, product.name, product.images?.[0]?.url || '', quantity, product.price, parseFloat(product.price) * quantity]
      );
      await client.query('UPDATE products SET stock_quantity=stock_quantity-$1,sold_count=sold_count+$1 WHERE id=$2', [quantity, product.id]);
    }
    await client.query('DELETE FROM cart_items WHERE user_id=$1', [req.user.id]);
    await client.query('COMMIT');
    res.status(201).json({ success: true, order });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
