const socket = io();
const container = document.getElementById('orders-container');
const orderCountEl = document.getElementById('order-count');
const clockEl = document.getElementById('clock');

let orders = [];
let completedToday = 0;

// ── KEEP SCREEN AWAKE ──
// Layer 1: Wake Lock API (clean, no DOM)
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        // Re-acquire if released (e.g. tab switch)
        setTimeout(requestWakeLock, 1000);
      });
    }
  } catch (e) { /* silent — fallback video handles it */ }
}

requestWakeLock();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestWakeLock();
});

// Layer 2: Silent video fallback (for devices that ignore Wake Lock)
(function initSilentVideo() {
  const video = document.createElement('video');
  video.src = 'silent.mp4';
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');

  // Completely invisible, no layout impact
  video.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 1px; height: 1px;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
  `;

  document.body.appendChild(video);

  // Autoplay may be blocked — retry on any user interaction
  const tryPlay = () => {
    video.play().catch(() => {});
  };

  tryPlay();
  document.addEventListener('click', tryPlay, { once: true });
  document.addEventListener('touchstart', tryPlay, { once: true });
  document.addEventListener('keydown', tryPlay, { once: true });
})();

// ── CLOCK ──
function updateClock() {
  clockEl.textContent = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}
setInterval(updateClock, 1000);
updateClock();

// ── SCREEN FLASH (no click needed, unlike audio) ──
function flashScreen() {
  const flash = document.createElement('div');
  flash.className = 'screen-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 2000);
}

// ── HELPERS ──
function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

function updateCounter() {
  const pending = orders.filter(o => !o._cancelled).length;
  orderCountEl.textContent = pending + ' pendiente'
    + (pending !== 1 ? 's' : '')
    + ' · ' + completedToday + ' completado'
    + (completedToday !== 1 ? 's' : '');
}

// ── FETCH COMPLETED COUNT ──
async function fetchCompletedCount() {
  try {
    const res = await fetch('/api/orders/summary/today');
    const data = await res.json();
    completedToday = data.completed || 0;
    updateCounter();
  } catch (e) { /* silent */ }
}

// ── RENDER ──
function renderOrders() {
  if (orders.length === 0) {
    container.innerHTML =
      '<p class="empty-message">Sin pedidos pendientes — ¡todo tranquilo!</p>';
  } else {
    container.innerHTML = orders.map(order => {
      const modified = order.modified_at && !order._cancelled
        ? '<span class="modified-label">(Modificado) </span>' : '';
      const cancelled = order._cancelled;
      const rowClass = cancelled ? 'order-row cancelled'
        : order.modified_at ? 'order-row was-modified' : 'order-row';

      return `
        <div class="${rowClass}" id="order-${order.id}">
          <span class="col-num">${order.id}</span>
          <span class="col-time">${formatTime(order.created_at)}</span>
          <span class="col-order">
            ${cancelled
              ? '<span class="cancelled-label">CANCELADO — </span><span class="order-text strikethrough">' + order.kitchen_text + '</span>'
              : '<span class="order-text">' + modified + order.kitchen_text + '</span>'
            }
          </span>
        </div>
      `;
    }).join('');
  }
  updateCounter();
}

// ── SOCKET EVENTS ──
socket.on('orders:all', (allOrders) => {
  orders = allOrders;
  renderOrders();
  fetchCompletedCount();
});

socket.on('order:new', (order) => {
  if (!orders.find(o => o.id === order.id)) {
    orders.push(order);
    renderOrders();
    flashScreen();
  }
});

socket.on('order:updated', (updated) => {
  const kitchenChanged = updated.kitchen_changed;
  delete updated.kitchen_changed;

  const idx = orders.findIndex(o => o.id === updated.id);
  if (idx !== -1) {
    orders[idx] = updated;
    renderOrders();
    if (kitchenChanged) flashScreen();
  }
});

socket.on('order:completed', ({ id }) => {
  orders = orders.filter(o => o.id !== id);
  completedToday++;
  renderOrders();
});

socket.on('order:cancelled', ({ id }) => {
  const idx = orders.findIndex(o => o.id === id);
  if (idx !== -1) {
    orders[idx]._cancelled = true;
    renderOrders();
    flashScreen();
    setTimeout(() => {
      orders = orders.filter(o => o.id !== id);
      renderOrders();
    }, 60000);
  }
});

// ── CONNECTION STATUS ──
const statusEl = document.createElement('div');
statusEl.className = 'connection-status connected';
statusEl.textContent = '🟢 Conectado';
document.body.appendChild(statusEl);

socket.on('connect', () => {
  statusEl.className = 'connection-status connected';
  statusEl.textContent = '🟢 Conectado';
});

socket.on('disconnect', () => {
  statusEl.className = 'connection-status disconnected';
  statusEl.textContent = '🔴 Desconectado';
});