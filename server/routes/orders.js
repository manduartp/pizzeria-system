const express = require('express');
const db = require('../database');

module.exports = function (io) {
  const router = express.Router();

  // ────────────────────────────────────
  // POST /api/orders — Create new order
  // ────────────────────────────────────
  router.post('/', (req, res) => {
    try {
      const { items, total, notes, delivery_address } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Order must have at least one item' });
      }

      const stmt = db.prepare(`
        INSERT INTO orders (items, total, notes, delivery_address, created_at)
        VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
      `);

      const result = stmt.run(
        JSON.stringify(items),
        total || 0,
        notes || '',
        delivery_address || ''
      );

      // Fetch the created order to return it with all fields
      const order = db
        .prepare('SELECT * FROM orders WHERE id = ?')
        .get(result.lastInsertRowid);

      order.items = JSON.parse(order.items);

      // Broadcast to all connected clients (kitchen!)
      io.emit('order:new', order);

      console.log(`📋 New order #${order.id} — $${order.total}`);
      res.status(201).json(order);
    } catch (err) {
      console.error('Error creating order:', err);
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  // ────────────────────────────────────
  // GET /api/orders — All pending orders
  // ────────────────────────────────────
  router.get('/', (req, res) => {
    const orders = db
      .prepare("SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at ASC")
      .all();

    orders.forEach(order => {
      order.items = JSON.parse(order.items);
    });

    res.json(orders);
  });

  // ─────────────────────────────────────────────
  // PATCH /api/orders/:id/complete — Mark as done
  // ─────────────────────────────────────────────
  router.patch('/:id/complete', (req, res) => {
    try {
      const { id } = req.params;

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      db.prepare(`
        UPDATE orders 
        SET status = 'completed', completed_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(id);

      // Broadcast to kitchen to remove from display
      io.emit('order:completed', { id: parseInt(id) });

      console.log(`✅ Order #${id} completed`);
      res.json({ success: true });
    } catch (err) {
      console.error('Error completing order:', err);
      res.status(500).json({ error: 'Failed to complete order' });
    }
  });

  // ──────────────────────────────────────────
  // GET /api/orders/summary/today — Day totals
  // ──────────────────────────────────────────
  router.get('/summary/today', (req, res) => {
    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_sales,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM orders 
      WHERE DATE(created_at) = DATE('now', 'localtime')
    `).get();

    res.json(summary);
  });

  // ──────────────────────────────────────────
  // GET /api/orders/summary/:date — Specific date
  // ──────────────────────────────────────────
  router.get('/summary/:date', (req, res) => {
    const { date } = req.params; // Expected format: YYYY-MM-DD

    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_sales,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM orders 
      WHERE DATE(created_at) = ?
    `).get(date);

    res.json(summary);
  });

  return router;
};