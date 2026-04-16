// ── CONNECT TO SERVER ──
const socket = io();

// ── DOM ELEMENTS ──
const container = document.getElementById('orders-container');
const orderCountEl = document.getElementById('order-count');

// ── STATE ──
let orders = [];
let audioEnabled = false;

// ── AUDIO SETUP ──
// Browsers require a user gesture before playing audio.
// First click/tap anywhere enables notification sounds.
document.addEventListener('click', () => {
  if (!audioEnabled) {
    audioEnabled = true;
    console.log('🔊 Audio enabled');
  }
}, { once: true });

function playNotificationSound() {
  if (!audioEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 830;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Audio not available, no problem
  }
}

// ── HELPERS ──
function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ── RENDER ──
function createOrderCard(order) {
  const itemsHtml = order.items.map(item => {
    let detailsHtml = '';

    // Show modifiers like Orilla de Queso
    if (item.modifiers && item.modifiers.length > 0) {
      detailsHtml += `<div class="item-details">+ ${item.modifiers.join(', ')}</div>`;
    }

    // Show extra ingredients
    if (item.extras && item.extras.length > 0) {
      detailsHtml += `<div class="item-details">+ ${item.extras.join(', ')}</div>`;
    }

    return `
      <div class="order-item">
        <span class="quantity">${item.quantity}x</span>
        <span class="item-name">${item.name}</span>
      </div>
      ${detailsHtml}
    `;
  }).join('');

  const notesHtml = order.notes
    ? `<div class="order-notes">${order.notes}</div>`
    : '';

  const addressHtml = order.delivery_address
    ? `<div class="order-address">${order.delivery_address}</div>`
    : '';

  return `
    <div class="order-card" id="order-${order.id}">
      <div class="order-header">
        <span class="order-number">#${order.id}</span>
        <span class="order-time">${formatTime(order.created_at)}</span>
      </div>
      ${itemsHtml}
      ${notesHtml}
      ${addressHtml}
    </div>
  `;
}

function renderOrders() {
  if (orders.length === 0) {
    container.innerHTML =
      '<p class="empty-message">Sin pedidos pendientes — ¡todo tranquilo!</p>';
  } else {
    container.innerHTML = orders.map(createOrderCard).join('');
  }

  const count = orders.length;
  orderCountEl.textContent = `${count} pedido${count !== 1 ? 's' : ''}`;
}

// ── SOCKET EVENTS ──

// Receive all pending orders on connect
socket.on('orders:all', (allOrders) => {
  orders = allOrders;
  renderOrders();
  console.log(`📋 Loaded ${orders.length} pending orders`);
});

// New order comes in
socket.on('order:new', (order) => {
  orders.push(order);
  renderOrders();
  playNotificationSound();
  console.log(`🆕 New order #${order.id}`);
});

// Order completed, remove from display
socket.on('order:completed', ({ id }) => {
  const card = document.getElementById(`order-${id}`);
  if (card) {
    card.classList.add('completing');
    setTimeout(() => {
      orders = orders.filter(o => o.id !== id);
      renderOrders();
    }, 500); // Wait for fade-out animation
  } else {
    orders = orders.filter(o => o.id !== id);
    renderOrders();
  }
  console.log(`✅ Order #${id} completed`);
});

// ── CONNECTION STATUS ──
function createStatusIndicator() {
  const el = document.createElement('div');
  el.className = 'connection-status connected';
  el.textContent = '🟢 Conectado';
  document.body.appendChild(el);
  return el;
}

const statusEl = createStatusIndicator();

socket.on('connect', () => {
  statusEl.className = 'connection-status connected';
  statusEl.textContent = '🟢 Conectado';
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  statusEl.className = 'connection-status disconnected';
  statusEl.textContent = '🔴 Desconectado';
  console.log('Disconnected from server');
});