const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());

// Static files
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
app.use('/kitchen', express.static(path.join(__dirname, '..', 'public', 'kitchen')));
app.use('/receptionist', express.static(path.join(__dirname, '..', 'public', 'receptionist')));

// Default redirect
app.get('/', (req, res) => res.redirect('/receptionist'));

// Menu API
const menuPath = path.join(__dirname, '..', 'shared', 'menu.js');

// Read menu file
app.get('/api/menu', (req, res) => {
  try {
    const content = fs.readFileSync(menuPath, 'utf-8');
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read menu' });
  }
});

// Write menu file
app.put('/api/menu', (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'No content' });
    fs.writeFileSync(menuPath, content, 'utf-8');
    console.log('📝 Menu updated from admin UI');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write menu' });
  }
});

// API routes
const orderRoutes = require('./routes/orders');
app.use('/api/orders', orderRoutes(io));

// Socket.io connections
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  const orders = db
    .prepare("SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at ASC")
    .all();

  // No more JSON.parse — data is already plain strings
  socket.emit('orders:all', orders);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server on all network interfaces (important for LAN access)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log(`  🍕 Pizzeria server running`);
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Kitchen:  http://localhost:${PORT}/kitchen`);
  console.log(`  Orders:   http://localhost:${PORT}/receptionist`);
  console.log('='.repeat(50));
  console.log('  Waiting for connections...');
});