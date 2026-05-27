const express = require('express');
const db = require('../database');

module.exports = function (io) {
  const router = express.Router();

  // ─── CREATE ORDER ───
  router.post('/', (req, res) => {
    try {
      const { kitchen_text, display_text, total, delivery_fee,
              client_name, client_phone, delivery_address, notes } = req.body;

      if (!kitchen_text || !kitchen_text.trim()) {
        return res.status(400).json({ error: 'Order must have kitchen_text' });
      }

      const order = db.prepare(`
        INSERT INTO orders 
          (kitchen_text, display_text, total, delivery_fee,
           client_name, client_phone, delivery_address, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
      `).run(
        kitchen_text.trim(),
        (display_text || kitchen_text).trim(),
        total || 0,
        delivery_fee || 0,
        client_name || '',
        client_phone || '',
        delivery_address || '',
        notes || ''
      );

      const created = db.prepare('SELECT * FROM orders WHERE id = ?')
        .get(order.lastInsertRowid);

      // Determine if this is a new client
      let isNewClient = false;
      if (created.client_phone) {
        const prev = db.prepare(
          "SELECT COUNT(*) as c FROM orders WHERE client_phone = ? AND id != ? AND status != 'cancelled'"
        ).get(created.client_phone, created.id);
        isNewClient = prev.c === 0;
      }
      created.is_new_client = isNewClient;

      io.emit('order:new', created);
      console.log('New order #' + created.id + ' — $' + created.total);
      res.status(201).json(created);

    } catch (err) {
      console.error('Error creating order:', err);
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  // ─── EDIT ORDER (only if pending) ───
  router.patch('/:id', (req, res) => {
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?')
        .get(req.params.id);

      if (!order) return res.status(404).json({ error: 'Not found' });
      if (order.status !== 'pending') {
        return res.status(400).json({ error: 'Cannot edit completed order' });
      }

      const allowed = ['kitchen_text', 'display_text', 'total',
        'delivery_fee', 'client_name', 'client_phone',
        'delivery_address', 'notes'];
      const updates = [];
      const values = [];

      for (const field of allowed) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(req.body[field]);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      // Only mark as modified if food items changed
      const kitchenChanged = req.body.kitchen_text !== undefined
        && req.body.kitchen_text !== order.kitchen_text;

      if (kitchenChanged) {
        updates.push("modified_at = datetime('now','localtime')");
      }

      values.push(req.params.id);

      db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`)
        .run(...values);

      const updated = db.prepare('SELECT * FROM orders WHERE id = ?')
        .get(req.params.id);

      // Recompute new client flag (phone may have changed)
      let isNewClient = false;
      if (updated.client_phone) {
        const prev = db.prepare(
          "SELECT COUNT(*) as c FROM orders WHERE client_phone = ? AND id != ? AND status != 'cancelled'"
        ).get(updated.client_phone, updated.id);
        isNewClient = prev.c === 0;
      }
      updated.is_new_client = isNewClient;

      // Tell clients whether kitchen needs to react
      io.emit('order:updated', { ...updated, kitchen_changed: kitchenChanged });
      res.json(updated);

    } catch (err) {
      console.error('Error editing order:', err);
      res.status(500).json({ error: 'Failed to edit order' });
    }
  });

  // ─── COMPLETE ORDER ───
  router.patch('/:id/complete', (req, res) => {
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?')
        .get(req.params.id);
      if (!order) return res.status(404).json({ error: 'Not found' });

      db.prepare(`
        UPDATE orders 
        SET status = 'completed', completed_at = datetime('now','localtime')
        WHERE id = ?
      `).run(req.params.id);

      io.emit('order:completed', { id: parseInt(req.params.id) });
      console.log(`✅ Order #${req.params.id} completed`);
      res.json({ success: true });

    } catch (err) {
      console.error('Error completing order:', err);
      res.status(500).json({ error: 'Failed to complete order' });
    }
  });

    // ─── CANCEL ORDER ───
  router.patch('/:id/cancel', (req, res) => {
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?')
        .get(req.params.id);
      if (!order) return res.status(404).json({ error: 'Not found' });
      if (order.status !== 'pending') {
        return res.status(400).json({ error: 'Cannot cancel non-pending order' });
      }

      db.prepare(`
        UPDATE orders 
        SET status = 'cancelled', completed_at = datetime('now','localtime')
        WHERE id = ?
      `).run(req.params.id);

      io.emit('order:cancelled', { id: parseInt(req.params.id) });
      console.log(`❌ Order #${req.params.id} cancelled`);
      res.json({ success: true });

    } catch (err) {
      console.error('Error cancelling order:', err);
      res.status(500).json({ error: 'Failed to cancel order' });
    }
  });

  // ─── GET PENDING ORDERS ───
  router.get('/', (req, res) => {
    const orders = db.prepare(
      "SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at ASC"
    ).all();
    res.json(orders);
  });

  // ─── SUMMARIES ───
  router.get('/summary/today', (req, res) => {
    const summary = db.prepare(`
      SELECT 
        COUNT(CASE WHEN status != 'cancelled' THEN 1 END) as total_orders,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total + delivery_fee ELSE 0 END), 0) as total_sales,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        (SELECT COUNT(*) FROM (
          SELECT client_phone FROM orders
          WHERE DATE(created_at) = DATE('now','localtime')
            AND status = 'completed' AND client_phone != ''
            AND client_phone NOT IN (
              SELECT client_phone FROM orders
              WHERE DATE(created_at) < DATE('now','localtime') AND status != 'cancelled'
            )
          GROUP BY client_phone
        )) as new_clients
      FROM orders WHERE DATE(created_at) = DATE('now','localtime')
    `).get();
    res.json(summary);
  });

  router.get('/summary/:date', (req, res) => {
    const summary = db.prepare(`
      SELECT 
        COUNT(CASE WHEN status != 'cancelled' THEN 1 END) as total_orders,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total + delivery_fee ELSE 0 END), 0) as total_sales,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        (SELECT COUNT(*) FROM (
          SELECT client_phone FROM orders
          WHERE DATE(created_at) = ? AND status = 'completed' AND client_phone != ''
            AND client_phone NOT IN (
              SELECT client_phone FROM orders
              WHERE DATE(created_at) < ? AND status != 'cancelled'
            )
          GROUP BY client_phone
        )) as new_clients
      FROM orders WHERE DATE(created_at) = ?
    `).get(req.params.date, req.params.date, req.params.date);
    res.json(summary);
  });

  // ─── COMPLETED ORDERS TODAY ───
  router.get('/history/today', (req, res) => {
    const orders = db.prepare(`
      SELECT * FROM orders 
      WHERE DATE(created_at) = DATE('now','localtime') AND status = 'completed'
      ORDER BY created_at ASC
    `).all();
    res.json(orders);
  });

  // ─── COMPLETED ORDERS FOR A DATE ───
  router.get('/history/:date', (req, res) => {
    const orders = db.prepare(`
      SELECT * FROM orders 
      WHERE DATE(created_at) = ? AND status = 'completed'
      ORDER BY created_at ASC
    `).all(req.params.date);
    res.json(orders);
  });

  // ─── WEEKLY SUMMARY ───
  router.get('/summary/week/current', (req, res) => {
    const days = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(CASE WHEN status != 'cancelled' THEN 1 END) as total_orders,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total + delivery_fee ELSE 0 END), 0) as total_sales,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM orders 
      WHERE DATE(created_at) >= DATE('now','localtime','-6 days')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) DESC
    `).all();
    res.json(days);
  });

  // ─── LAST ORDER BY PHONE (for autofill) ───
  router.get('/last-by-phone/:phone', (req, res) => {
    try {
      const order = db.prepare(`
        SELECT client_name, client_phone, delivery_address, notes
        FROM orders
        WHERE client_phone = ? AND status != 'cancelled'
        ORDER BY created_at DESC
        LIMIT 1
      `).get(req.params.phone);

      if (!order) return res.json({ found: false });
      res.json({ found: true, data: order });
    } catch (err) {
      console.error('Error looking up phone:', err);
      res.status(500).json({ error: 'Failed to look up phone' });
    }
  });

  // ─── ORDER HISTORY BY PHONE (search) ───
  router.get('/history/by-phone/:phone', (req, res) => {
    try {
      const orders = db.prepare(`
        SELECT * FROM orders
        WHERE client_phone = ?
        ORDER BY created_at DESC
      `).all(req.params.phone);
      res.json(orders);
    } catch (err) {
      console.error('Error searching by phone:', err);
      res.status(500).json({ error: 'Failed to search orders' });
    }
  });

  return router;
};