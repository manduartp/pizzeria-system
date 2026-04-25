// ══════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════
const socket = io();
let cart = [];
let activeOrders = [];
let currentCategory = 'pizzas';
let modalData = null;
let selectedExtras = [];
let editingOrderId = null;  // null = new order, number = editing

// ══════════════════════════════════════════════
//  DOM REFERENCES
// ══════════════════════════════════════════════
const menuGrid = document.getElementById('menu-grid');
const currentItemsEl = document.getElementById('current-items');
const orderTotalEl = document.getElementById('order-total');
const btnSend = document.getElementById('btn-send-order');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const activeOrdersList = document.getElementById('active-orders-list');
const builderTitle = document.getElementById('builder-title');
const cartTitle = document.getElementById('cart-title');

// Form fields
const clientNameInput = document.getElementById('client-name');
const clientPhoneInput = document.getElementById('client-phone');
const deliveryAddressInput = document.getElementById('delivery-address');
const deliveryFeeInput = document.getElementById('delivery-fee');
const orderNotesInput = document.getElementById('order-notes');

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

// Ticket modal
const ticketModal = document.getElementById('ticket-modal');
const ticketBody = document.getElementById('ticket-body');

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
function peso(n) { return '$' + n; }

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
      <div class="item-price">${peso(item.price)}</div>
    </div>
  `).join('');

  menuGrid.querySelectorAll('.menu-item').forEach(el => {
    el.addEventListener('click', () => handleMenuItemClick(el));
  });
}

function handleMenuItemClick(el) {
  const id = el.dataset.id;
  const category = el.dataset.category;

  if (category === 'pizzas') {
    const pizza = MENU.pizzas.find(p => p.id === id);
    openPizzaModal(pizza);
  } else {
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
  const isCustom = pizza.id === 'personalizada';

  modalPizzaName.textContent = pizza.name;
  modalPizzaPrice.textContent = peso(pizza.price);
  modOrilla.checked = false;
  qtyValue.textContent = '1';
  itemNotes.value = '';

  // Custom price section
  const customPriceSection = document.getElementById('custom-price-section');
  const customPriceInput = document.getElementById('custom-price');
  if (isCustom) {
    customPriceSection.classList.remove('hidden');
    customPriceInput.value = '';
  } else {
    customPriceSection.classList.add('hidden');
  }

  // Extras section — hide for custom pizza
  const extrasSection = document.querySelector('.extras-section');
  if (isCustom) {
    extrasSection.classList.add('hidden');
  } else {
    extrasSection.classList.remove('hidden');
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
  }

  pizzaModal.classList.remove('hidden');
}

function updateModalPrice() {
  if (!modalData) return;
  const isCustom = modalData.id === 'personalizada';
  const qty = parseInt(qtyValue.textContent);

  if (isCustom) {
    const customPrice = parseFloat(document.getElementById('custom-price').value) || 0;
    const orilla = modOrilla.checked ? MENU.modifiers[0].price : 0;
    const total = (customPrice + orilla) * qty;
    modalPizzaPrice.textContent = peso(total);
  } else {
    const base = modalData.price;
    const orilla = modOrilla.checked ? MENU.modifiers[0].price : 0;
    const extras = selectedExtras.length * MENU.extraIngredients.price;
    const total = (base + orilla + extras) * qty;
    modalPizzaPrice.textContent = peso(total);
  }
}

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

modOrilla.addEventListener('change', updateModalPrice);

document.getElementById('custom-price').addEventListener('input', updateModalPrice);

document.getElementById('modal-cancel').addEventListener('click', () => {
  pizzaModal.classList.add('hidden');
  modalData = null;
});

document.getElementById('modal-add').addEventListener('click', () => {
  if (!modalData) return;

  const isCustom = modalData.id === 'personalizada';
  const qty = parseInt(qtyValue.textContent);
  const modifiers = modOrilla.checked ? ['Orilla de Queso'] : [];
  const extras = isCustom ? [] : [...selectedExtras];

  let basePrice;
  if (isCustom) {
    basePrice = parseFloat(document.getElementById('custom-price').value) || 0;
    if (basePrice <= 0) {
      alert('Ingresa un precio para la pizza personalizada.');
      return;
    }
  } else {
    basePrice = modalData.price;
  }

  const unitPrice = basePrice
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
          <span class="cart-item-price">${peso(item.price)}</span>
          <button class="cart-item-remove" data-index="${i}">✕</button>
        </div>
      `;
    }).join('');

    btnSend.disabled = false;

    currentItemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        removeFromCart(parseInt(btn.dataset.index));
      });
    });
  }

  orderTotalEl.textContent = peso(getCartTotal());
}

// ══════════════════════════════════════════════
//  TEXT BUILDERS (the core of the new approach)
// ══════════════════════════════════════════════

// Kitchen sees ONLY food items — no address, no client, no price
function buildKitchenText() {
  return cart.map(item => {
    let text = `${item.quantity}x ${item.name}`;
    if (item.modifiers.length) text += ` c/${item.modifiers.join(', ')}`;
    if (item.extras.length) text += ` +${item.extras.join(', ')}`;
    if (item.notes) text += ` (${item.notes})`;
    return text;
  }).join(', ');
}

// Display text = full order for DB storage and ticket generation
function buildDisplayText() {
  const lines = cart.map(item => {
    let line = `${item.quantity}x ${item.name}`;
    if (item.modifiers.length) line += ` c/${item.modifiers.join(', ')}`;
    if (item.extras.length) line += ` +${item.extras.join(', ')}`;
    if (item.notes) line += ` (${item.notes})`;
    line += ` — ${peso(item.price)}`;
    return line;
  });
  return lines.join('\n');
}

// ══════════════════════════════════════════════
//  SEND / EDIT ORDER
// ══════════════════════════════════════════════
btnSend.addEventListener('click', async () => {
  if (cart.length === 0) return;

  const delivery_fee = parseFloat(deliveryFeeInput.value) || 0;

  // Confirm if delivery fee is 0
  if (delivery_fee === 0) {
    if (!confirm('El costo de envío es \$0. ¿Continuar?')) return;
  }

  const kitchen_text = buildKitchenText();
  const display_text = buildDisplayText();
  const total = getCartTotal();
  const client_name = clientNameInput.value.trim();
  const client_phone = clientPhoneInput.value.trim();
  const delivery_address = deliveryAddressInput.value.trim();
  const notes = orderNotesInput.value.trim();

  btnSend.disabled = true;
  btnSend.textContent = 'Enviando...';

  try {
    let response;

    if (editingOrderId) {
      response = await fetch(`/api/orders/${editingOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kitchen_text, display_text, total,
          client_name, client_phone, delivery_address, delivery_fee, notes
        })
      });
    } else {
      response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kitchen_text, display_text, total,
          client_name, client_phone, delivery_address, delivery_fee, notes
        })
      });
    }

    if (!response.ok) throw new Error('Server error');

    const result = await response.json();
    console.log('Order #' + result.id + (editingOrderId ? ' updated' : ' created'));

    clearForm();

    btnSend.textContent = editingOrderId ? '✅ ¡Actualizado!' : '✅ ¡Enviado!';
    editingOrderId = null;
    updateBuilderMode();

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
//  EDIT MODE
// ══════════════════════════════════════════════
function enterEditMode(order) {
  editingOrderId = order.id;
  cart = parseDisplayText(order.display_text);
  clientNameInput.value = order.client_name || '';
  clientPhoneInput.value = order.client_phone || '';
  deliveryAddressInput.value = order.delivery_address || '';
  deliveryFeeInput.value = order.delivery_fee || '';
  orderNotesInput.value = order.notes || '';
  renderCart();
  updateBuilderMode();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function parseDisplayText(text) {
  if (!text) return [];
  return text.split('\n').map(line => {
    // Format: "2x Hawaiana c/Orilla de Queso +Champiñones (bien cocida) — \$510"
    const priceMatch = line.match(/— \$(\d+)$/);
    const price = priceMatch ? parseInt(priceMatch[1]) : 0;
    const withoutPrice = line.replace(/\s*— \$\d+$/, '');

    const qtyMatch = withoutPrice.match(/^(\d+)x\s+/);
    const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;
    let rest = withoutPrice.replace(/^\d+x\s+/, '');

    // Extract notes in parentheses
    const notesMatch = rest.match(/\s*\(([^)]+)\)\s*$/);
    const notes = notesMatch ? notesMatch[1] : '';
    rest = rest.replace(/\s*\([^)]+\)\s*$/, '');

    // Extract extras after +
    const extrasMatch = rest.match(/\s*\+(.+)$/);
    const extras = extrasMatch
      ? extrasMatch[1].split(',').map(e => e.trim())
      : [];
    rest = rest.replace(/\s*\+.+$/, '');

    // Extract modifiers after c/
    const modMatch = rest.match(/\s*c\/(.+)$/);
    const modifiers = modMatch
      ? modMatch[1].split(',').map(m => m.trim())
      : [];
    rest = rest.replace(/\s*c\/.+$/, '');

    const name = rest.trim();
    const unitPrice = quantity > 0 ? Math.round(price / quantity) : price;

    return { name, quantity, price, unitPrice, modifiers, extras, notes };
  });
}

function updateBuilderMode() {
  if (editingOrderId) {
    builderTitle.textContent = `Editando Pedido #${editingOrderId}`;
    cartTitle.textContent = `Editando #${editingOrderId}`;
    btnSend.textContent = '💾 Guardar Cambios';
    btnCancelEdit.classList.remove('hidden');
  } else {
    builderTitle.textContent = 'Nuevo Pedido';
    cartTitle.textContent = 'Pedido Actual';
    btnSend.textContent = 'Enviar a Cocina 🔥';
    btnCancelEdit.classList.add('hidden');
  }
}

btnCancelEdit.addEventListener('click', () => {
  editingOrderId = null;
  clearForm();
  updateBuilderMode();
});

function clearForm() {
  cart = [];
  renderCart();
  clientNameInput.value = '';
  clientPhoneInput.value = '';
  deliveryAddressInput.value = '';
  deliveryFeeInput.value = '';
  orderNotesInput.value = '';
}

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
    const timeStr = formatTime(order.created_at);
    const modified = order.modified_at ? ' (Modificado)' : '';
    const fee = order.delivery_fee ? order.delivery_fee : 0;
    const grandTotal = order.total + fee;

    return `
      <div class="active-order-card" id="active-order-${order.id}">
        <div class="active-order-header">
          <span class="active-order-id">#${order.id} — ${timeStr}${modified}</span>
          <span class="active-order-total">${peso(grandTotal)}</span>
        </div>
        <div class="active-order-items">${order.display_text.replace(/\n/g, '<br>')}</div>
        ${order.client_name
          ? `<div class="active-order-detail">👤 ${order.client_name}</div>`
          : ''}
        ${order.client_phone
          ? '<div class="active-order-detail">📞 ' + order.client_phone + '</div>'
          : ''}
        ${order.delivery_address
          ? `<div class="active-order-detail">📍 ${order.delivery_address}</div>`
          : ''}
        ${fee > 0
          ? `<div class="active-order-detail">🚗 Envío: ${peso(fee)}</div>`
          : ''}
        ${order.notes
          ? `<div class="active-order-detail">📝 ${order.notes}</div>`
          : ''}
        <div class="active-order-actions">
          <button class="btn-edit" data-id="${order.id}">✏️ Editar</button>
          <button class="btn-ticket" data-id="${order.id}">🧾 Ticket</button>
          <button class="btn-complete" data-id="${order.id}">✅ Completar</button>
          <button class="btn-cancel-order" data-id="${order.id}">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  }).join('');

  // Edit handlers
  activeOrdersList.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const order = activeOrders.find(o => o.id === parseInt(btn.dataset.id));
      if (order) enterEditMode(order);
    });
  });

  // Ticket handlers
  activeOrdersList.querySelectorAll('.btn-ticket').forEach(btn => {
    btn.addEventListener('click', () => {
      const order = activeOrders.find(o => o.id === parseInt(btn.dataset.id));
      if (order) showTicket(order);
    });
  });

  // Complete handlers
  activeOrdersList.querySelectorAll('.btn-complete').forEach(btn => {
    btn.addEventListener('click', () => {
      completeOrder(parseInt(btn.dataset.id));
    });
  });

    // Cancel handlers
  activeOrdersList.querySelectorAll('.btn-cancel-order').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Cancelar este pedido?')) return;
      const id = parseInt(btn.dataset.id);
      try {
        const res = await fetch(`/api/orders/${id}/cancel`, { method: 'PATCH' });
        if (!res.ok) throw new Error();
        if (editingOrderId === id) {
          editingOrderId = null;
          clearForm();
          updateBuilderMode();
        }
      } catch (err) {
        alert('Error al cancelar el pedido.');
      }
    });
  });
}

async function completeOrder(id) {
  const btn = activeOrdersList.querySelector(`.btn-complete[data-id="${id}"]`);
  if (btn) {
    btn.textContent = 'Completando...';
    btn.disabled = true;
  }

  try {
    const response = await fetch(`/api/orders/${id}/complete`, {
      method: 'PATCH'
    });
    if (!response.ok) throw new Error('Server error');

    // If we were editing this order, exit edit mode
    if (editingOrderId === id) {
      editingOrderId = null;
      clearForm();
      updateBuilderMode();
    }

  } catch (err) {
    console.error('Failed to complete order:', err);
    alert('Error al completar el pedido.');
    if (btn) {
      btn.textContent = '✅ Completar';
      btn.disabled = false;
    }
  }
}

// ══════════════════════════════════════════════
//  TICKET
// ══════════════════════════════════════════════
function showTicket(order) {
  const fee = order.delivery_fee || 0;
  const grandTotal = order.total + fee;
  const timeStr = formatTime(order.created_at);
  const dateStr = new Date(order.created_at).toLocaleDateString('es-MX');

  const itemLines = order.display_text.split('\n').map(line =>
    `<div class="ticket-line">${line}</div>`
  ).join('');

  ticketBody.innerHTML = `
    <div class="ticket">
      <div class="ticket-header">
        <strong style="font-size: 20px;">Joselo's Pizza</strong><br>
        ¡Nuestra especialidad es la calidad!
      </div>
      <div class="ticket-divider">─────────────────────────</div>
      <div class="ticket-info">
        Pedido #${order.id}<br>
        ${dateStr} — ${timeStr}
      </div>
      ${order.client_name
        ? `<div class="ticket-info">👤 ${order.client_name}</div>` : ''}
      ${order.client_phone
        ? '<div class="ticket-info">📞 ' + order.client_phone + '</div>' : ''}
      ${order.delivery_address
        ? `<div class="ticket-info">📍 ${order.delivery_address}</div>` : ''}
      <div class="ticket-divider">─────────────────────────</div>
      ${itemLines}
      <div class="ticket-divider">─────────────────────────</div>
      ${fee > 0
        ? `<div class="ticket-line">Envío — ${peso(fee)}</div>` : ''}
      <div class="ticket-total">TOTAL: ${peso(grandTotal)}</div>
      ${order.notes
        ? `<div class="ticket-divider">─────────────────────────</div>
           <div class="ticket-notes">📝 ${order.notes}</div>` : ''}
      <div class="ticket-divider">─────────────────────────</div>
      <div class="ticket-footer">¡Gracias por su preferencia!</div>
    </div>
  `;

  ticketModal.classList.remove('hidden');
}

// ══════════════════════════════════════════════
//  THERMAL PRINTER — ESC/POS + WebUSB
// ══════════════════════════════════════════════

// ESC/POS command constants
const ESC = 0x1B;
const GS  = 0x1D;
const ESCPOS = {
  INIT:        [ESC, 0x40],                // Initialize printer
  CODEPAGE_1252: [ESC, 0x74, 0x10],        // Windows-1252 (Spanish chars)
  CENTER:      [ESC, 0x61, 0x01],
  LEFT:        [ESC, 0x61, 0x00],
  RIGHT:       [ESC, 0x61, 0x02],
  BOLD_ON:     [ESC, 0x45, 0x01],
  BOLD_OFF:    [ESC, 0x45, 0x00],
  DOUBLE:      [GS, 0x21, 0x11],           // Double width + height
  WIDE:        [GS, 0x21, 0x10],           // Double width only
  TALL:        [GS, 0x21, 0x01],           // Double height only
  NORMAL:      [GS, 0x21, 0x00],           // Normal size
  LF:          [0x0A],                      // Line feed
  FEED:        [ESC, 0x64, 0x04],          // Feed 4 lines
  CUT:         [GS, 0x56, 0x01],           // Partial cut
};

const LINE_WIDTH = 32; // characters per line on 58mm paper

// Printer state
let printerDevice = null;
let printerEndpoint = null;

// Convert string to Latin-1 bytes (supports Spanish characters)
function textBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes.push(code < 256 ? code : 0x3F); // '?' for unsupported
  }
  return bytes;
}

// Helper: line of dashes
function divider() {
  return [...textBytes('-'.repeat(LINE_WIDTH)), ...ESCPOS.LF];
}

// Helper: text line with automatic word wrapping
function textLine(str) {
  const bytes = [];
  const words = str.split(' ');
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > LINE_WIDTH) {
      bytes.push(...textBytes(currentLine.trimEnd()));
      bytes.push(...ESCPOS.LF);
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }

  if (currentLine.trim().length > 0) {
    bytes.push(...textBytes(currentLine.trimEnd()));
    bytes.push(...ESCPOS.LF);
  }

  return bytes;
}

// Build the full ESC/POS ticket for an order
function buildTicketBytes(order) {
  const fee = order.delivery_fee || 0;
  const grandTotal = order.total + fee;
  const timeStr = formatTime(order.created_at);
  const dateStr = new Date(order.created_at).toLocaleDateString('es-MX');

  let b = [];

  // ── Initialize ──
  b.push(...ESCPOS.INIT);
  b.push(...ESCPOS.CODEPAGE_1252);

  // ── Header ──
  b.push(...ESCPOS.CENTER);
  b.push(...ESCPOS.DOUBLE);
  b.push(...ESCPOS.BOLD_ON);
  b.push(...textBytes("Joselo's Pizza"));
  b.push(...ESCPOS.LF);
  b.push(...ESCPOS.NORMAL);
  b.push(...ESCPOS.BOLD_OFF);
  b.push(...textBytes("Nuestra especialidad"));
  b.push(...ESCPOS.LF);
  b.push(...textBytes("es la calidad!"));
  b.push(...ESCPOS.LF);

  // ── Order info ──
  b.push(...divider());
  b.push(...ESCPOS.BOLD_ON);
  b.push(...textBytes(`Pedido #${order.id}`));
  b.push(...ESCPOS.LF);
  b.push(...ESCPOS.BOLD_OFF);
  b.push(...textBytes(`${dateStr} - ${timeStr}`));
  b.push(...ESCPOS.LF);

  // ── Client info ──
  b.push(...ESCPOS.LEFT);
  if (order.client_name) {
    b.push(...textLine(`Cliente: ${order.client_name}`));
  }
  if (order.client_phone) {
    b.push(...textLine(`Tel: ${order.client_phone}`));
  }
  if (order.delivery_address) {
    b.push(...textLine(`Dir: ${order.delivery_address}`));
  }

  // ── Items ──
  b.push(...divider());
  const items = order.display_text.split('\n');
  for (const item of items) {
    b.push(...textLine(item));
  }

  // ── Totals ──
  b.push(...divider());
  if (fee > 0) {
    b.push(...textBytes(`Envio: 
$$
{fee}`));
    b.push(...ESCPOS.LF);
  }

  b.push(...ESCPOS.CENTER);
  b.push(...ESCPOS.DOUBLE);
  b.push(...ESCPOS.BOLD_ON);
  b.push(...textBytes(`TOTAL:
$$
{grandTotal}`));
  b.push(...ESCPOS.LF);
  b.push(...ESCPOS.NORMAL);
  b.push(...ESCPOS.BOLD_OFF);

  // ── Notes ──
  if (order.notes) {
    b.push(...ESCPOS.LEFT);
    b.push(...divider());
    b.push(...textLine(`Nota: ${order.notes}`));
  }

  // ── Footer ──
  b.push(...ESCPOS.CENTER);
  b.push(...divider());
  b.push(...textBytes("Gracias por su preferencia!"));
  b.push(...ESCPOS.LF);

  // ── Feed and cut ──
  b.push(...ESCPOS.FEED);
  b.push(...ESCPOS.CUT);

  return new Uint8Array(b);
}

// ── WebUSB Connection ──

async function connectPrinter() {
  try {
    const device = await navigator.usb.requestDevice({
      filters: [] // Show all USB devices so user can pick the printer
    });

    await device.open();

    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // Find the bulk OUT endpoint
    let targetInterface = null;
    let targetEndpoint = null;

    for (const iface of device.configuration.interfaces) {
      for (const ep of iface.alternate.endpoints) {
        if (ep.direction === 'out' && ep.type === 'bulk') {
          targetInterface = iface.interfaceNumber;
          targetEndpoint = ep.endpointNumber;
          break;
        }
      }
      if (targetEndpoint !== null) break;
    }

    if (targetEndpoint === null) {
      throw new Error('No se encontro un endpoint de impresion');
    }

    await device.claimInterface(targetInterface);

    printerDevice = device;
    printerEndpoint = targetEndpoint;
    updatePrinterStatus(true);

    console.log('🖨️ Printer connected:', device.productName);

  } catch (err) {
    console.error('Printer connection failed:', err);
    if (err.name !== 'NotFoundError') {
      alert('Error al conectar impresora: ' + err.message);
    }
  }
}

async function disconnectPrinter() {
  if (printerDevice) {
    try {
      await printerDevice.close();
    } catch (e) { /* ignore */ }
    printerDevice = null;
    printerEndpoint = null;
    updatePrinterStatus(false);
    console.log('🖨️ Printer disconnected');
  }
}

async function sendToPrinter(data) {
  if (!printerDevice || printerEndpoint === null) {
    alert('Impresora no conectada. Haz clic en "Conectar Impresora".');
    return false;
  }

  try {
    await printerDevice.transferOut(printerEndpoint, data);
    return true;
  } catch (err) {
    console.error('Print failed:', err);
    alert('Error al imprimir. Intenta reconectar la impresora.');
    printerDevice = null;
    printerEndpoint = null;
    updatePrinterStatus(false);
    return false;
  }
}

function updatePrinterStatus(connected) {
  const statusEl = document.getElementById('printer-status');
  const btnEl = document.getElementById('btn-connect-printer');

  if (connected) {
    statusEl.textContent = '● Conectada';
    statusEl.className = 'printer-status connected';
    btnEl.textContent = '⏏️ Desconectar Impresora';
  } else {
    statusEl.textContent = '● Desconectada';
    statusEl.className = 'printer-status disconnected';
    btnEl.textContent = '🔌 Conectar Impresora';
  }
}

// ── Button handlers ──

document.getElementById('btn-connect-printer').addEventListener('click', () => {
  if (printerDevice) {
    disconnectPrinter();
  } else {
    connectPrinter();
  }
});

// This replaces the old ticket-print handler
document.getElementById('ticket-print').addEventListener('click', async () => {
  // Find the order that's currently showing in the ticket modal
  const orderIdMatch = ticketBody.innerHTML.match(/Pedido #(\d+)/);
  if (!orderIdMatch) return;

  const orderId = parseInt(orderIdMatch[1]);
  const order = activeOrders.find(o => o.id === orderId);

  if (!order) {
    // Try fetching from the displayed ticket data as fallback
    alert('No se encontro el pedido en ordenes activas.');
    return;
  }

  const ticketData = buildTicketBytes(order);
  const success = await sendToPrinter(ticketData);

  if (success) {
    const btn = document.getElementById('ticket-print');
    btn.textContent = '✅ Impreso';
    setTimeout(() => { btn.textContent = '🖨️ Imprimir'; }, 1500);
  }
});

document.getElementById('ticket-close').addEventListener('click', () => {
  ticketModal.classList.add('hidden');
});

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit'
  });
}

// ══════════════════════════════════════════════
//  DAY SUMMARY + HISTORY + WEEKLY
// ══════════════════════════════════════════════
document.getElementById('btn-summary').addEventListener('click', () => {
  document.querySelectorAll('.summary-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.summary-tab[data-view="today"]').classList.add('active');
  summaryModal.classList.remove('hidden');
  loadSummaryView('today');
});

document.querySelectorAll('.summary-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.summary-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadSummaryView(tab.dataset.view);
  });
});

async function loadSummaryView(view) {
  try {
    if (view === 'today') {
      const res = await fetch('/api/orders/summary/today');
      const data = await res.json();
      summaryContent.innerHTML = `
        <div class="summary-stats">
          <div class="stat-card">
            <div class="stat-value">${data.total_orders}</div>
            <div class="stat-label">Pedidos Totales</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${peso(data.total_sales)}</div>
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
          <div class="stat-card stat-cancelled">
            <div class="stat-value">${data.cancelled}</div>
            <div class="stat-label">Cancelados</div>
          </div>
        </div>
      `;

    } else if (view === 'history') {
      const res = await fetch('/api/orders/history/today');
      const orders = await res.json();

      if (orders.length === 0) {
        summaryContent.innerHTML = '<p class="empty-cart">No hay pedidos completados hoy.</p>';
        return;
      }

      summaryContent.innerHTML = orders.map(order => {
        const fee = order.delivery_fee || 0;
        const grand = order.total + fee;
        const time = formatTime(order.created_at);
        return `
          <div class="history-card history-card-clickable" data-order-id="${order.id}">
            <div class="history-header">
              <strong>#${order.id} — ${time}</strong>
              <span>${peso(grand)}</span>
            </div>
            <div class="history-items">${order.display_text.replace(/\n/g, '<br>')}</div>
            ${order.client_name ? '<div class="history-detail">👤 ' + order.client_name + '</div>' : ''}
            ${order.client_phone ? '<div class="history-detail">📞 ' + order.client_phone + '</div>' : ''}
            ${order.delivery_address ? '<div class="history-detail">📍 ' + order.delivery_address + '</div>' : ''}
            ${fee > 0 ? '<div class="history-detail">🚗 Envío: ' + peso(fee) + '</div>' : ''}
          </div>
        `;
      }).join('');

      // Store orders for ticket lookup
      summaryContent._orders = orders;

      summaryContent.querySelectorAll('.history-card-clickable').forEach(card => {
        card.addEventListener('click', () => {
          const order = summaryContent._orders.find(o => o.id === parseInt(card.dataset.orderId));
          if (order) showTicket(order);
        });
      });

    } else if (view === 'week') {
      const res = await fetch('/api/orders/summary/week/current');
      const days = await res.json();

      if (days.length === 0) {
        summaryContent.innerHTML = '<p class="empty-cart">No hay datos esta semana.</p>';
        return;
      }

      const weekTotal = days.reduce((s, d) => s + d.total_sales, 0);
      const weekOrders = days.reduce((s, d) => s + d.total_orders, 0);

      summaryContent.innerHTML = `
        <div class="week-totals">
          <strong>Semana:</strong> ${weekOrders} pedidos · ${peso(weekTotal)}
        </div>
        <table class="week-table">
          <thead>
            <tr>
              <th>Fecha</th><th>Pedidos</th><th>Venta</th><th>Cancelados</th>
            </tr>
          </thead>
          <tbody>
            ${days.map(d => `
              <tr class="week-row-clickable" data-date="${d.date}">
                <td>${d.date}</td>
                <td>${d.total_orders}</td>
                <td>${peso(d.total_sales)}</td>
                <td>${d.cancelled}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      summaryContent.querySelectorAll('.week-row-clickable').forEach(row => {
        row.addEventListener('click', () => {
          loadDayDetail(row.dataset.date);
        });
      });
    }
  } catch (err) {
    console.error('Failed to load summary:', err);
    summaryContent.innerHTML = '<p class="empty-cart">Error al cargar datos.</p>';
  }
}

async function loadDayDetail(date) {
  try {
    const res = await fetch(`/api/orders/history/${date}`);
    const orders = await res.json();

    let html = `
      <button class="btn-back-week">← Volver a Semana</button>
      <h4 style="margin-bottom:12px;">Pedidos del ${date}</h4>
    `;

    if (orders.length === 0) {
      html += '<p class="empty-cart">No hay pedidos completados este día.</p>';
    } else {
      html += orders.map(order => {
        const fee = order.delivery_fee || 0;
        const grand = order.total + fee;
        const time = formatTime(order.created_at);
        return `
          <div class="history-card history-card-clickable" data-order-id="${order.id}">
            <div class="history-header">
              <strong>#${order.id} — ${time}</strong>
              <span>${peso(grand)}</span>
            </div>
            <div class="history-items">${order.display_text.replace(/\n/g, '<br>')}</div>
            ${order.client_name ? '<div class="history-detail">👤 ' + order.client_name + '</div>' : ''}
            ${order.client_phone ? '<div class="history-detail">📞 ' + order.client_phone + '</div>' : ''}
            ${order.delivery_address ? '<div class="history-detail">📍 ' + order.delivery_address + '</div>' : ''}
            ${fee > 0 ? '<div class="history-detail">🚗 Envío: ' + peso(fee) + '</div>' : ''}
          </div>
        `;
      }).join('');
    }

    summaryContent.innerHTML = html;

    summaryContent._dayOrders = orders;

    summaryContent.querySelectorAll('.history-card-clickable').forEach(card => {
      card.addEventListener('click', () => {
        const order = summaryContent._dayOrders.find(o => o.id === parseInt(card.dataset.orderId));
        if (order) showTicket(order);
      });
    });

    summaryContent.querySelector('.btn-back-week').addEventListener('click', () => {
      loadSummaryView('week');
    });

  } catch (err) {
    console.error('Failed to load day detail:', err);
    summaryContent.innerHTML = '<p class="empty-cart">Error al cargar datos.</p>';
  }
}

document.getElementById('summary-close').addEventListener('click', () => {
  summaryModal.classList.add('hidden');
});

// ══════════════════════════════════════════════
//  SOCKET EVENTS
// ══════════════════════════════════════════════
socket.on('orders:all', (orders) => {
  activeOrders = orders;
  renderActiveOrders();
});

socket.on('order:new', (order) => {
  if (!activeOrders.find(o => o.id === order.id)) {
    activeOrders.push(order);
    renderActiveOrders();
  }
});

socket.on('order:updated', (updated) => {
  delete updated.kitchen_changed;
  const idx = activeOrders.findIndex(o => o.id === updated.id);
  if (idx !== -1) {
    activeOrders[idx] = updated;
  } else {
    activeOrders.push(updated);
  }
  renderActiveOrders();
});

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

socket.on('order:cancelled', ({ id }) => {
  activeOrders = activeOrders.filter(o => o.id !== id);
  renderActiveOrders();
});

socket.on('connect', () => console.log('🟢 Connected'));
socket.on('disconnect', () => console.log('🔴 Disconnected'));

// ══════════════════════════════════════════════
//  ADMIN — MENU EDITOR
// ══════════════════════════════════════════════
const adminModal = document.getElementById('admin-modal');
const menuEditor = document.getElementById('menu-editor');

document.getElementById('btn-admin').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();
    menuEditor.value = data.content;
    adminModal.classList.remove('hidden');
  } catch (err) {
    alert('Error al cargar el menú.');
  }
});

document.getElementById('admin-cancel').addEventListener('click', () => {
  adminModal.classList.add('hidden');
});

document.getElementById('admin-save').addEventListener('click', async () => {
  const content = menuEditor.value;

  // Basic syntax check — try to evaluate it
  try {
    new Function(content + '\n; return MENU;')();
  } catch (err) {
    if (!confirm('⚠️ Posible error de sintaxis:\n' + err.message + '\n\n¿Guardar de todos modos?')) {
      return;
    }
  }

  try {
    const res = await fetch('/api/menu', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    if (!res.ok) throw new Error();

    alert('✅ Menú guardado. La página se recargará.');
    adminModal.classList.add('hidden');
    location.reload();

  } catch (err) {
    alert('Error al guardar el menú.');
  }
});

summaryModal.addEventListener('click', (e) => {
  if (e.target === summaryModal) {
    summaryModal.classList.add('hidden');
  }
});

ticketModal.addEventListener('click', (e) => {
  if (e.target === ticketModal) {
    ticketModal.classList.add('hidden');
  }
});

// ══════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════
renderMenu();
renderCart();
updateBuilderMode();