const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
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

// API routes
const orderRoutes = require('./routes/orders');
app.use('/api/orders', orderRoutes(io));

// Socket.io connections
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send all pending orders when a client connects
  const orders = db
    .prepare("SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at ASC")
    .all();

  orders.forEach(order => {
    order.items = JSON.parse(order.items);
  });

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