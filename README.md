# 🍕 Joselo's Pizza — Order Management System

A real-time order management system for a small pizzeria. The receptionist creates orders on a web UI, and the kitchen sees them instantly on a separate airport-style display. Built with **Node.js, Express, Socket.io, and SQLite** — no frameworks on the frontend, no external services needed.

Runs on a **Raspberry Pi 3B** (Raspberry Pi OS Lite), connected via Ethernet, PM2-managed. Accessible from any device on the local WiFi network.

---

## How It Works

```
Receptionist (laptop/phone/tablet)     Kitchen (tablet/kiosk/TV)
Opens /receptionist                    Opens /kitchen
        │                                      │
        │  1. Pick items, fill client data     │
        │  2. Click "Enviar a Cocina"          │
        │         │                            │
        │         ▼                            │
        │    ┌─────────────┐                   │
        │    │   SERVER    │ ── Socket.io ──►  │
        │    │ Node.js     │   real-time       │
        │    │ SQLite      │   update          │
        │    └─────────────┘                   │
        │         │                            │
        │         ▼                            │
        │  3. Order saved in DB                │ 3. Order appears on screen
        │  4. Can edit/cancel/complete         │    with flash + sound
        │  5. Print ticket via WebUSB          │
```

All devices connect to the same server over the local network.

---

## Tech Stack

| Technology         | What It Does                                |
|--------------------|---------------------------------------------|
| **Node.js 22+**    | Runs the server (JavaScript backend)        |
| **Express 5.x**    | Web framework — serves pages and API routes |
| **Socket.io 4.x**  | Real-time communication (server ↔ clients)  |
| **SQLite**         | Database — stores all orders in a local file|
| **better-sqlite3** | Node.js library to interact with SQLite     |
| **Vanilla HTML/CSS/JS** | Frontend — no frameworks, no build step |
| **PM2**            | (Pi only) Process manager, auto-start on boot|

---

## Key Design Principle: The Server is a "Dumb Pipe"

The server **never parses order content**. It stores and relays **plain strings**:

```
Receptionist builds text → Server stores it as-is → Kitchen displays it raw
```

This means:
- **Menu changes never require server modifications** — edit `shared/menu.js` from the admin UI (⚙️ button), refresh the browser
- **No JSON.parse crashes** — the database contains readable text, not serialized objects
- **Kitchen display is trivial** — just renders a string, no transformation needed
- **Tickets print what you see** — `display_text` goes directly to the thermal printer

---

## Project Structure

```
pizzeria-system/
│
├── server/                          ← BACKEND (Node.js)
│   ├── index.js                     ← Express server, Socket.io setup, menu API
│   ├── database.js                  ← SQLite connection + schema creation
│   └── routes/
│       └── orders.js                ← All order API endpoints
│
├── public/                          ← FRONTEND (served to browsers)
│   ├── kitchen/                     ← Kitchen display (read-only)
│   │   ├── index.html               ← Page structure
│   │   ├── style.css                ← Dark blue airport-style theme
│   │   ├── app.js                   ← Socket listeners, flash alerts, clock
│   │   └── notification.mp3         ← Sound played on new order
│   │
│   └── receptionist/                ← Receptionist panel (order creation)
│       ├── index.html               ← Layout: menu, forms, cart, modals
│       ├── style.css                ← Light theme, responsive
│       └── app.js                   ← Cart, text builders, autofill, tickets, printer
│
├── shared/
│   └── menu.js                      ← Menu data (prices, items, categories)
│
├── pizzeria.db                      ← SQLite database (auto-created, gitignored)
├── package.json                     ← Project config and dependencies
├── .gitignore                       ← node_modules/, *.db
└── README.md                        ← This file
```

---

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  kitchen_text    TEXT NOT NULL,         -- food items only (shown to kitchen)
  display_text    TEXT NOT NULL,         -- full order with prices (for tickets)
  total           REAL NOT NULL,         -- sum of item prices
  delivery_fee    REAL DEFAULT 0,        -- delivery charge
  client_name     TEXT DEFAULT '',       -- customer name
  client_phone    TEXT DEFAULT '',       -- customer phone (10 digits)
  delivery_address TEXT DEFAULT '',      -- delivery address
  notes           TEXT DEFAULT '',       -- general order notes
  status          TEXT DEFAULT 'pending',-- pending | completed | cancelled
  modified_at     TEXT,                  -- set only when kitchen_text changes
  created_at      TEXT,                  -- auto-set on insert
  completed_at    TEXT                   -- set when completed or cancelled
);
```

Database uses **WAL journal mode** for concurrent read performance.

All dates stored with `datetime('now','localtime')` — the server's timezone is used.

---

## API Reference

All endpoints are relative to `http://<server>:3000`.

### Order Endpoints (`/api/orders`)

| Method | URL                              | What It Does                     |
|--------|----------------------------------|----------------------------------|
| POST   | `/api/orders`                    | Create a new order               |
| GET    | `/api/orders`                    | Get all pending orders           |
| PATCH  | `/api/orders/:id`                | Edit an order (pending only)     |
| PATCH  | `/api/orders/:id/complete`       | Mark order as completed          |
| PATCH  | `/api/orders/:id/cancel`         | Cancel an order (pending only)   |
| GET    | `/api/orders/last-by-phone/:phone` | Last order by phone (for autofill)|
| GET    | `/api/orders/summary/today`      | Today's sales summary            |
| GET    | `/api/orders/summary/:date`      | Summary for a specific date      |
| GET    | `/api/orders/summary/week/current`| Last 7 days breakdown           |
| GET    | `/api/orders/history/today`      | Completed orders today           |
| GET    | `/api/orders/history/:date`      | Completed orders for a date      |

### Menu File API (`/api/menu`)

| Method | URL        | What It Does                        |
|--------|------------|-------------------------------------|
| GET    | `/api/menu`| Read `shared/menu.js` raw content   |
| PUT    | `/api/menu`| Write new content to `shared/menu.js`|

Accessible from the ⚙️ button on the receptionist UI. No server restart needed — just reload the browser.

### POST /api/orders — Request Body

```json
{
  "kitchen_text": "2x Hawaiana c/Orilla de Queso +Champiñones, 1x Pan Ajo",
  "display_text": "2x Hawaiana c/Orilla de Queso +Champiñones — $510\n1x Pan Ajo — $30",
  "total": 540,
  "delivery_fee": 30,
  "client_name": "Juan Pérez",
  "client_phone": "5512345678",
  "delivery_address": "Calle Reforma 123",
  "notes": "Tocar el timbre"
}
```

### GET /api/orders/last-by-phone/:phone — Response

```json
{
  "found": true,
  "data": {
    "client_name": "Juan Pérez",
    "client_phone": "5512345678",
    "delivery_address": "Calle Reforma 123",
    "notes": "Tocar el timbre"
  }
}
```

If no order is found: `{ "found": false }`.

---

## Socket Events Reference

| Event              | Direction         | Data                              | When                           |
|--------------------|-------------------|-----------------------------------|--------------------------------|
| `orders:all`       | Server → Client   | Array of pending orders           | Client first connects          |
| `order:new`        | Server → Client   | Full order object                 | New order created              |
| `order:updated`    | Server → Client   | Order + `kitchen_changed` boolean | Order edited                   |
| `order:completed`  | Server → Client   | `{ id: number }`                  | Order marked as completed      |
| `order:cancelled`  | Server → Client   | `{ id: number }`                  | Order cancelled                |

Kitchen display reacts to each event:
- `order:new` → plays notification sound, flashes screen
- `order:updated` → flashes only if `kitchen_changed` is true
- `order:completed` → removes order card instantly
- `order:cancelled` → shows strikethrough for 60 seconds, then removes

---

## Text Format Convention

All order content is stored as **plain strings** in two columns:

```
kitchen_text: "2x Hawaiana c/Orilla de Queso +Champiñones, 1x Pan Ajo"

display_text: "2x Hawaiana c/Orilla de Queso +Champiñones — $510
               1x Pan Ajo — $30"
```

**Format rules:**
- `Nx` = quantity and item name
- `c/` = modifiers (e.g., `c/Orilla de Queso`)
- `+` = extra ingredients (e.g., `+Champiñones, +Pepperoni`)
- `(...)` = per-item notes (e.g., `(bien cocida)`)
- `— $NNN` = total price for that line (display_text only)
- Items separated by `, ` (kitchen_text) or `\n` (display_text)

**Why plain text instead of JSON?**
- Menu changes can't corrupt old orders
- Kitchen display reads directly with zero parsing
- Tickets print `display_text` as-is
- The `parseDisplayText()` function reconstructs cart items from this format when editing

---

## Receptionist Layout Guide

```
┌───────────────────────────────────┬──────────────────────────────┐
│  LEFT PANEL (~75%)               │  RIGHT SIDEBAR (~25%)        │
│                                   │                              │
│  ── Nuevo Pedido ──               │  👤 Datos del Cliente        │
│  [🍕][🧄][🥤][⭐]  tabs          │  ─────────────────────────   │
│  ┌────┬────┬────┬────┐           │  📞 Phone (autofill at 10)  │
│  │ .. │ .. │ .. │ .. │  menu     │  👤 Name                    │
│  │ .. │ .. │ .. │ .. │  grid     │  📍 Address                 │
│  └────┴────┴────┴────┘           │  🚗 Envío 💰               │
│                                   │  📝 Notes (auto-grows)      │
│  ── 📋 Pedidos Activos ──        ├──────────────────────────────┤
│  ┌──────────────────────┬──────┐  │  🛒 Pedido Actual           │
│  │ #id — name — time    │ ✏️  │  │  ────────────────────────  │
│  │   $total    $775     │ 🧾  │  │  Nx item ........... $XXX ✕ │
│  │ Items comma-sep      │ ✅  │  │  (cart fills space)         │
│  │ 📱 · 📍 · 📝 info   │     │  │  Subtotal:         $XXX     │
│  ├──────────────────────┴──────┤  │  Envío:             $XX    │← fee > $0
│  │ (more cards stacked below)  │  │  Total:             $XXX   │
│  └─────────────────────────────┘  │  [Enviar a Cocina 🔥]      │← pinned bottom
│                                   │  [✕ Cancelar Edición]      │← edit mode
│                                   │  [🗑️ Eliminar Pedido]      │← edit mode
└───────────────────────────────────┴──────────────────────────────┘
```

The layout is fully responsive — below 768px it stacks vertically: menu → client → cart → orders.

---

## Key Features

### 🍕 Order Creation
- 4 category tabs: Pizzas, Pan con Ajo, Bebidas, Especiales
- Pizza customization modal: modifiers (Orilla de Queso +$60), extra ingredients (+$30 each, 9 options)
- "Personalizada" pizza: custom price input, no extras section
- Promo items ($0 price) in sides and beverages
- Cart deduplication: same item + modifiers + extras + notes → merged (e.g., "3x Té de Litro")
- Cart partial removal: ✕ decrements quantity by 1, removes entirely only at 0

### 🔄 Real-time Updates
- Orders appear on kitchen display instantly via Socket.io
- Order updates flash the kitchen screen if food items changed
- Order cancellations show strikethrough on kitchen for 60 seconds
- Counter shows "X pendientes · Y completados" on kitchen display

### ✏️ Order Editing
- Click "Editar" on any pending order to load it back into the form
- Food changes trigger `modified_at` timestamp and "(Modificado)" label
- Client data fields (name, phone, address, notes) don't trigger modification flag
- Cancel edit restores previous form state

### 📞 Phone Autofill
- Type 10 digits in the phone field → fetches last order from that number
- Gray preview: name, address, and notes appear in italic gray
- Click 📥 button or press Enter to confirm (values become editable)
- Click/tab outside the phone field to dismiss (restores previous values)

### 🧾 Ticket Printing
- Thermal printer via WebUSB + ESC/POS (Chrome/Chromium only)
- Connect printer via "🔌 Conectar Impresora" button
- Ticket shows: header, order #, date, client info, items with prices, total, notes
- "🧾 Ticket" button on any active order or from history view
- Past orders now print correctly (fix: uses saved order reference, not activeOrders[])

### ⚙️ Admin Menu Editor
- ⚙️ button in the header bar opens a raw menu.js editor
- Syntax check before saving (eval in sandbox)
- No server restart needed — browser reload picks up changes
- Accessible without SSH or terminal access

### 📊 Day Summary
- Tabs: Today / Order History / Weekly
- Today shows: total orders, total sales, completed, pending, cancelled
- History shows each completed order with ticket access
- Weekly shows 7-day breakdown with day-by-day drill-down
- Cancelled orders excluded from sales totals

### ✅ Confirmation Modals
All destructive/confirm actions use a styled modal instead of native `confirm()`:
| Action | Icon | Confirm Button |
|--------|------|---------------|
| Complete order | ✅ | Green |
| Cancel/delete order | 🗑️ | Red |
| $0 delivery fee | 🚗 | Default red |

### 🖥️ Kitchen Display
- Dark blue airport-style theme with alternating row stripes
- Columns: # (order number) | HORA (time) | PEDIDO (food items)
- Screen flash effect on new/updated/cancelled orders
- Audio notification (`notification.mp3`) on new orders
- Live clock, connection status indicator
- Wake Lock API keeps screen on (no kiosk app needed, but recommended)
- Silent video fallback was removed (kiosk app handles screen-on better)

### 📱 Responsive
- Desktop: two-column layout (menu left, client+cart right)
- Mobile: stacks vertically below 768px
- Receptionist is rarely used on mobile; kitchen is always on a dedicated display

---

## File-by-File Guide

### `server/database.js`
- Opens (or creates) `pizzeria.db` in the project root
- WAL journal mode enabled
- Creates the `orders` table if it doesn't exist
- Exports the Database instance

### `server/index.js`
- Express server + Socket.io setup
- Serves static files: `/shared`, `/kitchen`, `/receptionist`
- Default redirect: `/` → `/receptionist`
- Menu file API: `GET /api/menu`, `PUT /api/menu`
- Loads order routes with `io` instance for socket broadcasts
- Listens on port 3000, all network interfaces (`0.0.0.0`)

### `server/routes/orders.js`
- All order CRUD endpoints
- Summary queries exclude cancelled orders from sales totals
- Socket events emitted on create/edit/complete/cancel
- `modified_at` is set only when `kitchen_text` changes (food items)
- `GET /last-by-phone/:phone` — read-only, returns latest non-cancelled order
- Two summary query versions: `/summary/today` (uses `DATE('now','localtime')`) and `/summary/:date` (parameter)

### `shared/menu.js`
- Menu data object with categories, modifiers, extra ingredients
- Dual export pattern: works in Node.js (`module.exports`) and browser (global `MENU`)
- Editing an item name or price here + browser refresh = instant menu update

### `public/kitchen/app.js`
- Connects to Socket.io
- Maintains an `orders[]` array for pending orders
- Handles `orders:all`, `order:new`, `order:updated`, `order:completed`, `order:cancelled`
- Screen flash effect (2s pulsing overlay) and notification sound
- Wake Lock API to prevent screen dimming
- Connection status indicator (green/red badge)
- Clock update every second

### `public/receptionist/app.js`
- **~1400 lines** — the largest file. All receptionist logic.
- Key sections: State, Autofill, Category Tabs, Menu Rendering, Pizza Modal,
  Cart Management, Text Builders, Send/Edit Order, Active Orders,
  Ticket/Printer, Summary/History/Weekly, Socket Events, Admin Menu Editor
- `buildKitchenText()` — plain food items, no prices
- `buildDisplayText()` — same items + prices per line
- `parseDisplayText()` — regex-based reconstruction from display_text format
- `renderActiveOrders()` — renders compact 3-row cards with vertical button panel
- `addToCart()` — deduplicates matching items (same name/modifiers/extras/notes)
- `removeFromCart()` — decrements qty by 1, removes at 0
- ESC/POS printer code via WebUSB (~300 lines)

---

## Setup & Installation

### Prerequisites
- Node.js 18+ (tested on 22.x)
- npm (comes with Node.js)
- Git

### Local Development
```bash
# 1. Clone
git clone https://github.com/your-username/pizzeria-system.git
cd pizzeria-system

# 2. Install dependencies (all local, nothing global)
npm install

# 3. Start with auto-restart on file changes
npm run dev

# 4. Open in browser
#    Receptionist: http://localhost:3000/receptionist
#    Kitchen:      http://localhost:3000/kitchen
```

### Production (Raspberry Pi)
```bash
# 1. Install Node.js on Pi
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Clone and install
git clone https://github.com/your-username/pizzeria-system.git
cd pizzeria-system
npm install

# 3. Install PM2 and configure
npm install -g pm2
pm2 start server/index.js --name pizzeria
pm2 save
sudo pm2 startup

# 4. Set static IP (edit /etc/dhcpcd.conf)
#    interface eth0
#    static ip_address=192.168.1.100/24
#    static routers=192.168.1.1
```

### Access from Other Devices on the Same WiFi
```
http://192.168.1.100:3000/kitchen       # Kitchen display
http://192.168.1.100:3000/receptionist  # Receptionist panel
```

### npm Scripts
| Command | What it does |
|---------|-------------|
| `npm start` | Start server (production — no auto-restart) |
| `npm run dev` | Start with `--watch` (auto-restart on file changes) |

---

## Common Tasks

### Add a New Pizza
Edit `shared/menu.js`:
```javascript
pizzas: [
  // ... existing pizzas ...
  { id: 'new_pizza', name: 'Nueva Pizza', price: 200 },
]
```
Refresh the browser. That's it — no server restart.

### Change a Price
Edit `shared/menu.js`, find the item, change the `price` value. Refresh the browser.

### Add a New Beverage
```javascript
beverages: [
  // ... existing beverages ...
  { id: 'new_drink', name: 'Nueva Bebida', price: 25 },
]
```

### Change the Menu from the Browser
Click the ⚙️ button in the header, edit the raw JS, click "Guardar y Recargar".

### Check Orders in the Database Directly
```bash
sqlite3 pizzeria.db "SELECT id, client_name, status, total FROM orders ORDER BY id DESC LIMIT 10;"
```

### Reset All Orders (Start Fresh)
```bash
rm pizzeria.db
npm run dev
# Database is recreated automatically
```

### Back Up the Database
```bash
cp pizzeria.db pizzeria-backup-$(date +%Y%m%d).db
```

---

## Order Object Shape

```javascript
{
  id: 1,                              // Auto-assigned by database
  kitchen_text: "2x Hawaiana c/Queso", // Food items only (for kitchen display)
  display_text: "2x Hawaiana c/Queso — $510\n1x Pan Ajo — $30",  // With prices (for tickets)
  total: 540,                          // Sum of item prices
  delivery_fee: 30,                    // Delivery charge
  client_name: "Juan Pérez",           // Customer name
  client_phone: "5512345678",          // Customer phone
  delivery_address: "Calle 123",       // Delivery address
  notes: "Tocar el timbre",            // Order notes
  status: "pending",                   // pending | completed | cancelled
  modified_at: null,                   // Set when kitchen_text changes
  created_at: "2024-01-15 19:32:00",   // Auto-set by database
  completed_at: null                   // Set when completed or cancelled
}
```

---

## Troubleshooting

### "Cannot connect from another device"
- Make sure both devices are on the **same WiFi network**
- Use the server's **local IP**, not `localhost`
- Check if a firewall is blocking port 3000

### "Kitchen display says Desconectado"
- The server might not be running — check the terminal / `pm2 status`
- Connection auto-reconnects when the server is back

### "Orders aren't appearing on kitchen display"
- Open browser console (F12) and check for errors
- Make sure the kitchen page is at `/kitchen`, not just the HTML file
- Verify Socket.io is connected (console logs)

### "npm install fails for better-sqlite3"
better-sqlite3 compiles native code. On Raspberry Pi it takes 2–3 minutes.
```bash
# On Mac
xcode-select --install

# On Linux (Debian/Ubuntu)
sudo apt install build-essential python3

# On Windows
npm install --global windows-build-tools
```

### "Autofill isn't working"
- Phone number must be exactly 10 digits (non-digits are stripped)
- Only non-cancelled orders are searched
- The phone number must match exactly as stored in the database

### "Past orders won't print"
This was a known bug (fixed in commit `0805ce8`). The ticket print handler now uses a saved order reference instead of searching `activeOrders[]`. If you still have issues, make sure `showTicket()` is being called before clicking print.

### "Database errors on startup"
- Delete `pizzeria.db` and restart — it will be recreated
- Make sure better-sqlite3 installed correctly:
  ```bash
  npm rebuild better-sqlite3
  ```

---

## Git Log (Notable Commits)

| Commit | Description |
|--------|-------------|
| `7dd621e` | Initial: menu data, database schema |
| `54d6aad` | Express server, Socket.io, API routes |
| `5fb541a` | Kitchen display with real-time updates |
| `74a0c15` | Receptionist panel HTML+CSS |
| `e57fbad` | Complete receptionist: orders, cart, summary |
| `f854c7f` | SQLite temp files gitignore |
| `aab129a` | Notes, recipes, fixed daily/weekly summaries |
| `7801184` | POS printer, 24h time, keep-alive |
| `1266a4a` | Fixed printing text |
| `e7c1e20` | Added notification sound |
| `2b51c98` | Bigger order numbers |
| `0805ce8` | **Fix past-ticket print bug, removed dead code** |
| `403aed4` | **Phone autofill** |
| `a229b9f` | Fix escaped dollar signs |
| `baf1fcb` | **Layout redesign: client fields to sidebar** |
| `f840fbc` | **Active orders moved to left panel** |
| `c825014` | Compact cards, cart dedup, notes auto-grow |
| `07a7b82` | Vertical button panel with colors |
| `ef86e4b` | Delete button moved to edit panel |
| `d842bd4` | **Styled confirmation modals** |
| `02250a2` | Admin button to header bar |
| `1af3351` | Cart partial removal (decrement qty) |
| `d7953fe` | Real-time delivery fee in totals, name/phone swap |
