# 🍕 Pizzeria Order Management System

A real-time order management system for a small pizzeria. The receptionist
creates orders from a web interface, and the kitchen sees them instantly
on a separate display. Built with Node.js, Express, Socket.io, and SQLite.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [File-by-File Guide](#file-by-file-guide)
- [Setup & Installation](#setup--installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Socket Events Reference](#socket-events-reference)
- [Data Shapes](#data-shapes)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

---

## How It Works

```
Receptionist (laptop/phone)          Kitchen (tablet/phone/TV)
Opens /receptionist                  Opens /kitchen
        │                                    │
        │  1. Creates order                  │
        │  2. Clicks "Enviar a Cocina"       │
        │         │                          │
        │         ▼                          │
        │    ┌─────────┐                     │
        │    │ SERVER  │ ── Socket.io ──►    │
        │    │ Node.js │    real-time        │
        │    │ SQLite  │    update           │
        │    └─────────┘                     │
        │         │                          │
        │         ▼                          │
        │  3. Order saved in database        │ 3. Order appears on screen
        │                                    │    with audio notification
        │  4. Receptionist marks complete    │
        │         │                          │
        │         ▼                          │
        │  5. Server updates database        │ 5. Order fades out
```

All devices connect to the same server over the local WiFi network.
The server can run on a laptop, Raspberry Pi, or any computer.

---

## Tech Stack

| Technology       | What It Does                                  |
|-----------------|-----------------------------------------------|
| **Node.js**      | Runs the server (JavaScript on the backend)  |
| **Express**      | Web framework — serves pages and API routes  |
| **Socket.io**    | Real-time communication (server ↔ clients)   |
| **SQLite**       | Database — stores all orders in a local file |
| **better-sqlite3** | Node.js library to interact with SQLite   |
| **HTML/CSS/JS**  | Frontend — what you see in the browser       |

---

## Project Structure

```
pizzeria-system/
│
├── server/                    ← BACKEND (Node.js)
│   ├── index.js               ← Main server file (starts everything)
│   ├── database.js            ← Database connection and table creation
│   └── routes/
│       └── orders.js          ← API endpoints for orders
│
├── public/                    ← FRONTEND (served to browsers)
│   ├── kitchen/               ← Kitchen display page
│   │   ├── index.html         ← HTML structure
│   │   ├── style.css          ← Visual styling
│   │   └── app.js             ← Logic (receives orders, renders them)
│   │
│   └── receptionist/          ← Receptionist panel page
│       ├── index.html         ← HTML structure
│       ├── style.css          ← Visual styling
│       └── app.js             ← Logic (creates orders, manages cart)
│
├── shared/                    ← SHARED between server and frontend
│   └── menu.js                ← Pizza menu, prices, ingredients
│
├── pizzeria.db                ← SQLite database file (auto-created)
├── package.json               ← Project config and dependencies
├── package-lock.json          ← Exact dependency versions
├── .gitignore                 ← Files Git should ignore
└── README.md                  ← This file
```

---

## File-by-File Guide

### `server/index.js` — The Heart of the System

**What it does:**
- Creates the Express web server
- Sets up Socket.io for real-time communication
- Serves the frontend files (kitchen and receptionist pages)
- Connects the API routes
- Starts listening on port 3000

**When to edit:**
- Adding new pages (e.g., a delivery driver view)
- Changing the port number
- Adding new Socket.io event logic

**Key concepts:**
```javascript
// Express serves static files from folders
app.use('/kitchen', express.static('public/kitchen'));
// This means: when someone visits /kitchen, serve files from public/kitchen/

// Socket.io listens for connections
io.on('connection', (socket) => { ... });
// Every time a browser opens the page, this fires

// The server listens on 0.0.0.0 (all network interfaces)
// This is what allows OTHER devices on the WiFi to connect
server.listen(PORT, '0.0.0.0');
```

---

### `server/database.js` — Data Storage

**What it does:**
- Opens (or creates) the SQLite database file `pizzeria.db`
- Creates the `orders` table if it doesn't exist
- Exports the database connection for other files to use

**When to edit:**
- Adding new tables (e.g., customers, ingredients)
- Changing the database schema (adding columns)

**Key concepts:**
```javascript
// SQLite stores everything in a single file
const db = new Database('pizzeria.db');

// WAL mode = better performance when reading and writing at the same time
db.pragma('journal_mode = WAL');

// CREATE TABLE IF NOT EXISTS = safe to run every time the server starts
// It won't delete existing data
```

**The orders table:**
```
┌──────────────────┬──────────┬───────────────────────────────┐
│ Column           │ Type     │ Description                   │
├──────────────────┼──────────┼───────────────────────────────┤
│ id               │ INTEGER  │ Auto-incrementing unique ID   │
│ items            │ TEXT     │ JSON string of order items    │
│ total            │ REAL     │ Total price                   │
│ status           │ TEXT     │ "pending" or "completed"      │
│ notes            │ TEXT     │ General order notes            │
│ delivery_address │ TEXT     │ Delivery address              │
│ created_at       │ TEXT     │ When the order was created    │
│ completed_at     │ TEXT     │ When it was marked done       │
└──────────────────┴──────────┴───────────────────────────────┘
```

---

### `server/routes/orders.js` — API Endpoints

**What it does:**
- Defines all the URL endpoints the frontend can call
- Handles creating orders, completing orders, and summaries
- Emits Socket.io events to notify other clients

**When to edit:**
- Adding new features (e.g., delete order, edit order)
- Changing how summaries are calculated
- Adding new API endpoints

**Endpoints:**

| Method | URL                          | What It Does                    |
|--------|------------------------------|---------------------------------|
| POST   | `/api/orders`                | Create a new order              |
| GET    | `/api/orders`                | Get all pending orders          |
| PATCH  | `/api/orders/:id/complete`   | Mark an order as completed      |
| GET    | `/api/orders/summary/today`  | Get today's sales summary       |
| GET    | `/api/orders/summary/:date`  | Get summary for a specific date |

**Key concepts:**
```javascript
// The function receives `io` (Socket.io) so it can broadcast events
module.exports = function(io) { ... }

// When an order is created, it tells ALL connected browsers:
io.emit('order:new', order);

// :id in the URL is a parameter
// PATCH /api/orders/5/complete → req.params.id = "5"
```

---

### `shared/menu.js` — Menu Data

**What it does:**
- Defines ALL menu items, categories, prices, and options
- Used by BOTH the server and the frontend

**When to edit:**
- Prices change
- New pizzas, beverages, or sides are added
- Ingredients list changes

**Key concept:**
```javascript
// This file works in Node.js AND in the browser
// The if-block at the bottom handles both:
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MENU;   // Node.js
}
// In the browser, MENU is just a global variable
```

**To add a new pizza:**
```javascript
// Find the pizzas array and add:
{ id: 'new_pizza', name: 'Pizza Nueva', price: 200 },
```

**To add a new beverage:**
```javascript
// Find the beverages array and add:
{ id: 'refresco', name: 'Refresco 600ml', price: 25 },
```

---

### `public/kitchen/index.html` — Kitchen Page Structure

**What it does:**
- Defines the HTML layout for the kitchen display
- Loads the CSS, Socket.io library, menu data, and app.js

**When to edit:**
- Changing the page title or header
- Adding new sections to the display

**Key concept:**
```html
<!-- Socket.io provides this file automatically from the server -->
<script src="/socket.io/socket.io.js"></script>

<!-- Menu data is loaded from the shared folder -->
<script src="/shared/menu.js"></script>
```

---

### `public/kitchen/style.css` — Kitchen Visual Design

**What it does:**
- All visual styling for the kitchen display
- Dark theme (easy to read in a kitchen environment)
- Animations for new orders appearing and completed orders fading out

**When to edit:**
- Changing colors, fonts, or sizes
- Making text bigger for a distant TV screen
- Adjusting the card layout

**Useful customizations:**
```css
/* Make text bigger for a TV far from the cook */
.order-item { font-size: 1.5rem; }

/* Change the accent color */
/* Replace #e94560 everywhere with your preferred color */
```

---

### `public/kitchen/app.js` — Kitchen Logic

**What it does:**
- Connects to the server via Socket.io
- Listens for new orders and completed orders
- Renders order cards on screen
- Plays a notification sound when a new order arrives
- Shows connection status (green = connected, red = disconnected)

**When to edit:**
- Changing how orders are displayed
- Modifying the notification sound
- Adding new information to order cards

**Key concepts:**
```javascript
// Connect to server (auto-detects the URL)
const socket = io();

// Listen for events from the server
socket.on('order:new', (order) => { ... });      // New order arrived
socket.on('order:completed', ({ id }) => { ... }); // Order done
socket.on('orders:all', (orders) => { ... });     // All pending (on load)

// The audio notification uses the Web Audio API
// No sound file needed — it generates a beep programmatically
```

**Data flow:**
```
Server emits event → Socket.io delivers it → app.js receives it
→ Updates the `orders` array → Calls renderOrders() → Screen updates
```

---

### `public/receptionist/index.html` — Receptionist Page Structure

**What it does:**
- Layout with two main areas:
  - LEFT: Menu grid + category tabs + order details
  - RIGHT: Cart (current order) + active orders list
- Pizza customization modal
- Day summary modal

**When to edit:**
- Changing the layout structure
- Adding new input fields (e.g., customer name, phone)
- Adding new sections

---

### `public/receptionist/style.css` — Receptionist Visual Design

**What it does:**
- Light theme for the receptionist (easier to read in a bright environment)
- Responsive layout (works on laptop and phone)
- Modal styling for pizza customization and summary
- Button styles, grid layouts, cart styling

**When to edit:**
- Changing colors or branding
- Adjusting button sizes for easier tapping
- Fixing layout on specific screen sizes

**Responsive breakpoint:**
```css
/* Below 768px: switches from side-by-side to stacked layout */
@media (max-width: 768px) { ... }
```

---

### `public/receptionist/app.js` — Receptionist Logic

**This is the largest and most complex file.** It handles:

| Section            | What It Does                                    |
|--------------------|-------------------------------------------------|
| **State**          | Variables that track the cart, active orders     |
| **Category Tabs**  | Switching between Pizzas, Sides, Beverages      |
| **Menu Rendering** | Shows menu items as clickable buttons            |
| **Pizza Modal**    | Customization with extras, modifiers, quantity   |
| **Cart**           | Add/remove items, calculate total, render list   |
| **Send Order**     | POST to server, clear cart, show success         |
| **Active Orders**  | Display pending orders, mark as complete         |
| **Summary**        | Fetch and display daily totals                   |
| **Socket Events**  | Real-time updates for new/completed orders       |
| **Initialization** | Renders menu and cart on page load               |

**When to edit:**
- Fixing bugs in order creation
- Adding new features (customer selection, printing)
- Changing the order flow

**Key data flow:**
```
User taps pizza → Modal opens → User customizes → Adds to cart
  → User taps "Enviar" → fetch POST /api/orders → Server saves
  → Server emits socket event → Kitchen display updates
  → Cart clears → Order appears in "Pedidos Activos"
```

---

### `pizzeria.db` — The Database File

**What it is:**
- A single file containing ALL order data
- Created automatically when the server first starts
- NOT tracked by Git (listed in .gitignore)

**Where it lives:** Root of the project

**To back it up:** Simply copy the file somewhere safe

**To reset everything:** Delete the file and restart the server

**To inspect the data:** Use any SQLite viewer, or from the terminal:
```bash
# Install sqlite3 command line tool if needed
sqlite3 pizzeria.db

# See all orders
SELECT * FROM orders;

# See today's orders
SELECT * FROM orders WHERE DATE(created_at) = DATE('now', 'localtime');

# Exit
.quit
```

---

### `package.json` — Project Configuration

**What it does:**
- Lists project dependencies (Express, Socket.io, better-sqlite3)
- Defines scripts (`npm start`, `npm run dev`)

**Key scripts:**
```bash
npm start    # Runs the server normally
npm run dev  # Runs with auto-restart on file changes (Node 18+)
```

---

### `.gitignore` — Files Git Should Ignore

**Contents:**
```
node_modules/    ← Dependencies (huge, downloaded via npm install)
*.db             ← Database files (contain local data, not code)
```

---

## Setup & Installation

### Prerequisites
- Node.js 18+ installed
- npm (comes with Node.js)
- Git

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/pizzeria-system.git
cd pizzeria-system

# 2. Install dependencies
npm install

# 3. Start the server
npm run dev

# 4. Open in browser
# Receptionist: http://localhost:3000/receptionist
# Kitchen:      http://localhost:3000/kitchen
```

### Access from Other Devices on the Same WiFi

1. Find your computer's local IP:
   ```bash
   # Mac/Linux
   ifconfig | grep "inet "

   # Windows
   ipconfig
   ```
   Look for something like `192.168.1.XX`

2. On the other device's browser, go to:
   ```
   http://192.168.1.XX:3000/kitchen
   ```

---

## Usage

### Creating an Order
1. Open `/receptionist` on your device
2. Select a category (Pizzas, Pan con Ajo, etc.)
3. Tap a menu item
4. For pizzas: customize in the modal, then "Agregar al Pedido"
5. For other items: they add directly to the cart
6. Optionally add delivery address and notes
7. Tap "Enviar a Cocina 🔥"

### Completing an Order
1. On the receptionist panel, find the order in "Pedidos Activos"
2. Tap "✅ Marcar Completado"
3. The order disappears from both the receptionist and kitchen display

### Viewing Day Summary
1. Tap "📊 Resumen del Día" in the header
2. Shows total orders, total sales, completed, and pending

---

## API Reference

All endpoints are relative to `http://localhost:3000`

### Create Order
```
POST /api/orders
Content-Type: application/json

Body:
{
  "items": [
    {
      "name": "Hawaiana",
      "quantity": 1,
      "price": 195,
      "unitPrice": 195,
      "modifiers": [],
      "extras": [],
      "notes": ""
    }
  ],
  "total": 195,
  "delivery_address": "Calle Reforma 123",
  "notes": "Tocar el timbre"
}

Response: 201 Created → the full order object with id
```

### Get Pending Orders
```
GET /api/orders
Response: 200 → array of pending orders
```

### Complete Order
```
PATCH /api/orders/:id/complete
Response: 200 → { "success": true }
```

### Today's Summary
```
GET /api/orders/summary/today
Response: 200 → { total_orders, total_sales, completed, pending }
```

### Summary by Date
```
GET /api/orders/summary/YYYY-MM-DD
Response: 200 → { total_orders, total_sales, completed, pending }
```

---

## Socket Events Reference

### Server → All Clients

| Event              | Data                    | When                          |
|--------------------|------------------------|-------------------------------|
| `orders:all`       | Array of pending orders | Client first connects         |
| `order:new`        | Full order object       | New order created             |
| `order:completed`  | `{ id: number }`        | Order marked as completed     |

### How to Listen (in any frontend JS file)

```javascript
const socket = io();

socket.on('orders:all', (orders) => {
  // orders = array of order objects
});

socket.on('order:new', (order) => {
  // order = single order object
});

socket.on('order:completed', ({ id }) => {
  // id = number, the completed order's ID
});
```

---

## Data Shapes

### Order Object
```javascript
{
  id: 1,                              // Auto-assigned by database
  items: [                            // Array of items in the order
    {
      name: "Hawaiana",               // Display name
      quantity: 2,                     // How many
      price: 570,                      // Total for this line (unitPrice × qty)
      unitPrice: 285,                  // Price per unit with modifiers/extras
      modifiers: ["Orilla de Queso"],  // Applied modifiers
      extras: ["Champiñones"],         // Extra ingredients
      notes: "Bien cocida"            // Per-item notes
    }
  ],
  total: 570,                         // Grand total for the order
  status: "pending",                  // "pending" or "completed"
  notes: "Tocar el timbre",           // General order notes
  delivery_address: "Calle 123",      // Delivery address
  created_at: "2024-01-15 19:32:00",  // Auto-set by database
  completed_at: null                  // Set when completed
}
```

### Menu Item Object
```javascript
{
  id: "hawaiana",    // Unique identifier (used in code)
  name: "Hawaiana",  // Display name (shown in UI)
  price: 195         // Price in pesos
}
```

---

## Common Tasks

### Add a New Pizza
Edit `shared/menu.js`:
```javascript
pizzas: [
  // ... existing pizzas ...
  { id: 'my_new_pizza', name: 'Mi Pizza Nueva', price: 200 },
]
```
Restart the server. Done.

### Change a Price
Edit `shared/menu.js`, find the item, change the `price` value.
Restart the server.

### Add a New Beverage
Edit `shared/menu.js`:
```javascript
beverages: [
  // ... existing ...
  { id: 'refresco', name: 'Refresco 600ml', price: 25 },
]
```

### Add a New Ingredient Option
Edit `shared/menu.js`:
```javascript
extraIngredients: {
  price: 30,
  options: [
    // ... existing ...
    'Nuevo Ingrediente'
  ]
}
```

### Check Orders in the Database Directly
```bash
sqlite3 pizzeria.db "SELECT * FROM orders;"
```

### Reset All Orders (Start Fresh)
```bash
rm pizzeria.db
npm run dev
# Database is recreated automatically
```

---

## Troubleshooting

### "Cannot connect from another device"
- Make sure both devices are on the **same WiFi network**
- Use your computer's **local IP**, not `localhost`
- Check if a firewall is blocking port 3000

### "Kitchen display says Desconectado"
- The server might not be running — check your terminal
- WiFi might be down
- The display will **automatically reconnect** when the server is back

### "Orders aren't appearing on kitchen display"
- Open browser console (F12) and check for errors
- Make sure the kitchen page is at `/kitchen`, not just the HTML file
- Verify Socket.io is connected (check console logs)

### "Database errors on startup"
- Delete `pizzeria.db` and restart — it will be recreated
- Make sure `better-sqlite3` installed correctly:
  ```bash
  npm rebuild better-sqlite3
  ```

### "npm install fails for better-sqlite3"
This package compiles native code. You may need:
```bash
# On Mac
xcode-select --install

# On Linux (Debian/Ubuntu)
sudo apt install build-essential python3

# On Windows
npm install --global windows-build-tools
```
```

---

### Commit

```bash
git add .
git commit -m "Add comprehensive README documentation"
```
