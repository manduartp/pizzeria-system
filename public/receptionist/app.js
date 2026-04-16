// ══════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════
const socket = io();
let cart = [];
let activeOrders = [];
let currentCategory = 'pizzas';
let modalData = null;       // pizza currently being customized
let selectedExtras = [];    // extras selected in modal

// ══════════════════════════════════════════════
//  DOM REFERENCES
// ══════════════════════════════════════════════
const menuGrid = document.getElementById('menu-grid');
const currentItemsEl = document.getElementById('current-items');
const orderTotalEl = document.getElementById('order-total');
const btnSend = document.getElementById('btn-send-order');
const activeOrdersList = document.getElementById('active-orders-list');

// Pizza modal
const pizzaModal = document.getElementById('pizza-modal');
const modalPizzaName = document.getElementById('modal-pizza-name');
const modalPizzaPrice = document.getElementById('modal-pizza-price');
const modOrilla = document.getElementById('mod-orilla');
const extrasGrid = document.getElementById('extras-grid');
const qtyValue = document.getElementById('qty-value');
const itemNotes = document.getElementById('item-notes');

// Summary modal
const summaryModal = document.getElementById('summary-modal');
const summaryContent = document.getElementById('summary-content');


// ══════════════════════════════════════════════
//  CATEGORY TABS
// ══════════════════════════════════════════════
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentCategory = tab.dataset.category;
    renderMenu();
  });
});


// ══════════════════════════════════════════════
//  MENU RENDERING
// ══════════════════════════════════════════════
function renderMenu() {
  const items = MENU[currentCategory] || [];

  menuGrid.innerHTML = items.map(item => `
    <div class="menu-item" data-id="${item.id}" data-category="${currentCategory}">
      <div class="item-name">${item.name}</div>
      <div class="item-price">
$$
{item.price}</div>
    </div>
  `).join('');

  // Attach click handlers
  menuGrid.querySelectorAll('.menu-item').forEach(el => {
    el.addEventListener('click', () => handleMenuItemClick(el));
  });
}

function handleMenuItemClick(el) {
  const id = el.dataset.id;
  const category = el.dataset.category;

  if (category === 'pizzas') {
    // Pizzas open the customization modal
    const pizza = MENU.pizzas.find(p => p.id === id);
    openPizzaModal(pizza);
  } else {
    // Everything else goes straight to cart
    const item = MENU[category].find(i => i.id === id);
    addToCart({
      name: item.name,
      quantity: 1,
      price: item.price,
      unitPrice: item.price,
      modifiers: [],
      extras: [],
      notes: ''
    });
  }
}


// ══════════════════════════════════════════════
//  PIZZA CUSTOMIZATION MODAL
// ══════════════════════════════════════════════
function openPizzaModal(pizza) {
  modalData = pizza;
  selectedExtras = [];

  // Reset modal fields
  modalPizzaName.textContent = pizza.name;
  modalPizzaPrice.textContent = `
$$
{pizza.price}`;
  modOrilla.checked = false;
  qtyValue.textContent = '1';
  itemNotes.value = '';

  // Render extra ingredient buttons
  extrasGrid.innerHTML = MENU.extraIngredients.options.map(name => `
    <button class="extra-btn" data-name="${name}">${name}</button>
  `).join('');

  extrasGrid.querySelectorAll('.extra-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      const name = btn.dataset.name;
      if (selectedExtras.includes(name)) {
        selectedExtras = selectedExtras.filter(e => e !== name);
      } else {
        selectedExtras.push(name);
      }
      updateModalPrice();
    });
  });

  pizzaModal.classList.remove('hidden');
}

function updateModalPrice() {
  if (!modalData) return;
  const qty = parseInt(qtyValue.textContent);
  const base = modalData.price;
  const orilla = modOrilla.checked ? MENU.modifiers[0].price : 0;
  const extras = selectedExtras.length * MENU.extraIngredients.price;
  const total = (base + orilla + extras) * qty;
  modalPizzaPrice.textContent = `
$$
{total}`;
}

// Quantity controls
document.getElementById('qty-minus').addEventListener('click', () => {
  const current = parseInt(qtyValue.textContent);
  if (current > 1) {
    qtyValue.textContent = current - 1;
    updateModalPrice();
  }
});

document.getElementById('qty-plus').addEventListener('click', () => {
  const current = parseInt(qtyValue.textContent);
  qtyValue.textContent = current + 1;
  updateModalPrice();
});

// Orilla checkbox updates price
modOrilla.addEventListener('change', updateModalPrice);

// Cancel modal
document.getElementById('modal-cancel').addEventListener('click', () => {
  pizzaModal.classList.add('hidden');
  modalData = null;
});

// Add pizza to cart from modal
document.getElementById('modal-add').addEventListener('click', () => {
  if (!modalData) return;

  const qty = parseInt(qtyValue.textContent);
  const modifiers = modOrilla.checked ? ['Orilla de Queso'] : [];
  const extras = [...selectedExtras];
  const unitPrice = modalData.price
    + (modOrilla.checked ? MENU.modifiers[0].price : 0)
    + (extras.length * MENU.extraIngredients.price);

  addToCart({
    name: modalData.name,
    quantity: qty,
    price: unitPrice * qty,
    unitPrice: unitPrice,
    modifiers,
    extras,
    notes: itemNotes.value.trim()
  });

  pizzaModal.classList.add('hidden');
  modalData = null;
});


// ══════════════════════════════════════════════
//  CART MANAGEMENT
// ══════════════════════════════════════════════
function addToCart(item) {
  cart.push(item);
  renderCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + item.price, 0);
}

function renderCart() {
  if (cart.length === 0) {
    currentItemsEl.innerHTML = '<p class="empty-cart">Agrega productos del menú</p>';
    btnSend.disabled = true;
  } else {
    currentItemsEl.innerHTML = cart.map((item, i) => {
      // Build detail strings
      const details = [];
      if (item.modifiers.length) details.push(item.modifiers.join(', '));
      if (item.extras.length) details.push('+ ' + item.extras.join(', '));
      if (item.notes) details.push('📝 ' + item.notes);

      return `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-name">${item.quantity}x ${item.name}</div>
            ${details.length
              ? `<div class="cart-item-details">${details.join(' | ')}</div>`
              : ''}
          </div>
          <span class="cart-item-price">
$$
{item.price}</span>
          <button class="cart-item-remove" data-index="${i}">✕</button>
        </div>
      `;
    }).join('');

    btnSend.disabled = false;

    // Attach remove handlers
    currentItemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        removeFromCart(parseInt(btn.dataset.index));
      });
    });
  }

  orderTotalEl.textContent = `$${getCartTotal()}`;
}


// ══════════════════════════════════════════════
//  SEND ORDER TO SERVER
// ══════════════════════════════════════════════
btnSend.addEventListener('click', async () => {
  if (cart.length === 0) return;

  const address = document.getElementById('delivery-address').value.trim();
  const notes = document.getElementById('order-notes').value.trim();

  const order = {
    items: cart.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      unitPrice: item.unitPrice,
      modifiers: item.modifiers,
      extras: item.extras,
      notes: item.notes
    })),
    total: getCartTotal(),
    delivery_address: address,
    notes: notes
  };

  // Disable button while sending
  btnSend.disabled = true;
  btnSend.textContent = 'Enviando...';

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });

    if (!response.ok) {
      throw new Error('Server error');
    }

    const created = await response.json();
    console.log(`📋 Order #${created.id} sent!`);

    // Clear the cart and form
    cart = [];
    renderCart();
    document.getElementById('delivery-address').value = '';
    document.getElementById('order-notes').value = '';

    // Brief success feedback
    btnSend.textContent = '✅ ¡Enviado!';
    setTimeout(() => {
      btnSend.textContent = 'Enviar a Cocina 🔥';
    }, 1500);

  } catch (err) {
    console.error('Failed to send order:', err);
    alert('Error al enviar el pedido. Verifica la conexión.');
    btnSend.disabled = false;
    btnSend.textContent = 'Enviar a Cocina 🔥';
  }
});


// ══════════════════════════════════════════════
//  ACTIVE ORDERS
// ══════════════════════════════════════════════
function renderActiveOrders() {
  if (activeOrders.length === 0) {
    activeOrdersList.innerHTML =
      '<p class="empty-cart">No hay pedidos activos</p>';
    return;
  }

  activeOrdersList.innerHTML = activeOrders.map(order => {
    const itemsSummary = order.items.map(item =>
      `${item.quantity}x ${item.name}`
    ).join(', ');

    const timeStr = formatTime(order.created_at);

    return `
      <div class="active-order-card" id="active-order-${order.id}">
        <div class="active-order-header">
          <span class="active-order-id">#${order.id} — ${timeStr}</span>
          <span class="active-order-total">
$$
{order.total}</span>
        </div>
        <div class="active-order-items">${itemsSummary}</div>
        ${order.delivery_address
          ? `<div class="active-order-items">📍 ${order.delivery_address}</div>`
          : ''}
        ${order.notes
          ? `<div class="active-order-items">📝 ${order.notes}</div>`
          : ''}
        <button class="btn-complete" data-id="${order.id}">
          ✅ Marcar Completado
        </button>
      </div>
    `;
  }).join('');

  // Attach complete handlers
  activeOrdersList.querySelectorAll('.btn-complete').forEach(btn => {
    btn.addEventListener('click', () => {
      completeOrder(parseInt(btn.dataset.id));
    });
  });
}

async function completeOrder(id) {
  // Optimistic: immediately change button text
  const btn = activeOrdersList.querySelector(`[data-id="${id}"]`);
  if (btn) {
    btn.textContent = 'Completando...';
    btn.disabled = true;
  }

  try {
    const response = await fetch(`/api/orders/${id}/complete`, {
      method: 'PATCH'
    });

    if (!response.ok) {
      throw new Error('Server error');
    }

    console.log(`✅ Order #${id} completed`);
    // The socket event will handle removal from the list

  } catch (err) {
    console.error('Failed to complete order:', err);
    alert('Error al completar el pedido.');
    if (btn) {
      btn.textContent = '✅ Marcar Completado';
      btn.disabled = false;
    }
  }
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });
}


// ══════════════════════════════════════════════
//  DAY SUMMARY
// ══════════════════════════════════════════════
document.getElementById('btn-summary').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/orders/summary/today');
    const data = await response.json();

    summaryContent.innerHTML = `
      <div class="summary-stats">
        <div class="stat-card">
          <div class="stat-value">${data.total_orders}</div>
          <div class="stat-label">Pedidos Totales</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">
$$
{data.total_sales}</div>
          <div class="stat-label">Venta Total</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.completed}</div>
          <div class="stat-label">Completados</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.pending}</div>
          <div class="stat-label">Pendientes</div>
        </div>
      </div>
    `;

    summaryModal.classList.remove('hidden');

  } catch (err) {
    console.error('Failed to load summary:', err);
    alert('Error al cargar el resumen.');
  }
});

document.getElementById('summary-close').addEventListener('click', () => {
  summaryModal.classList.add('hidden');
});


// ══════════════════════════════════════════════
//  SOCKET EVENTS
// ══════════════════════════════════════════════

// On connect, receive all pending orders
socket.on('orders:all', (orders) => {
  activeOrders = orders;
  renderActiveOrders();
  console.log(`📋 Loaded ${orders.length} active orders`);
});

// New order created (could be from this client or another)
socket.on('order:new', (order) => {
  // Avoid duplicates
  if (!activeOrders.find(o => o.id === order.id)) {
    activeOrders.push(order);
    renderActiveOrders();
  }
});

// Order completed
socket.on('order:completed', ({ id }) => {
  const card = document.getElementById(`active-order-${id}`);
  if (card) {
    card.style.opacity = '0.5';
    card.style.transition = 'opacity 0.3s';
    setTimeout(() => {
      activeOrders = activeOrders.filter(o => o.id !== id);
      renderActiveOrders();
    }, 300);
  } else {
    activeOrders = activeOrders.filter(o => o.id !== id);
    renderActiveOrders();
  }
});

// Connection status
socket.on('connect', () => {
  console.log('🟢 Connected to server');
});

socket.on('disconnect', () => {
  console.log('🔴 Disconnected from server');
});


// ══════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════
renderMenu();
renderCart();