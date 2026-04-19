New updated joselos readme

# Pizzeria Order Management System — Project Context

## What This Is
A real-time order management system for a small pizzeria running
on a Raspberry Pi 3B. Receptionist creates orders on a web UI,
kitchen sees them instantly on a separate airport-style display.
Any device on the local network can access either interface.

## Deployment
- Runs on Raspberry Pi 3B (Raspberry Pi OS Lite)
- Connected via Ethernet to local modem/router
- Static IP: 192.168.1.100 (configured in /etc/dhcpcd.conf)
- PM2 auto-starts the server on boot (survives power outages)
- PM2 process name: "pizzeria"
- No SSH/restart needed for menu changes (editable from UI)

## Tech Stack
- Node.js 20 + Express + Socket.io + SQLite (better-sqlite3)
- Vanilla HTML/CSS/JS frontend (no frameworks)
- PM2 for process management

## Architecture

Pi (192.168.1.100:3000) = always-on server
├── /receptionist = order creation, editing, tickets, admin
├── /kitchen = read-only display, real-time via Socket.io
└── SQLite DB stores all orders as plain text strings

text


## Key Design Principle
The server is a "dumb pipe" — it stores and relays plain strings.
ALL menu intelligence lives in the receptionist frontend only.
The server never parses order content. This means menu changes
(adding items, changing prices) never require server modifications.

## File Structure

~/pizzeria-system/
├── server/
│ ├── index.js ← Express + Socket.io + menu file API
│ ├── database.js ← SQLite setup + schema
│ └── routes/orders.js ← All API endpoints
├── public/
│ ├── kitchen/
│ │ ├── index.html ← Airport-style display
│ │ ├── app.js ← Socket listeners, flash alerts
│ │ └── style.css ← Dark blue theme, large fonts
│ └── receptionist/
│ ├── index.html ← Order builder, modals, admin
│ ├── app.js ← Cart, text builders, edit mode, tickets
│ └── style.css ← Full responsive styles
├── shared/
│ └── menu.js ← Menu data (prices, items, categories)
├── pizzeria.db ← SQLite database (auto-created)
└── package.json

text


## Database Schema
```sql
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kitchen_text TEXT NOT NULL,      -- food items only (shown to kitchen)
  display_text TEXT NOT NULL,      -- full order with prices (for tickets)
  total REAL NOT NULL,
  delivery_fee REAL DEFAULT 0,
  client_name TEXT DEFAULT '',
  client_phone TEXT DEFAULT '',
  delivery_address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',   -- pending | completed | cancelled
  modified_at TEXT,                -- set only when kitchen_text changes
  created_at TEXT,
  completed_at TEXT
)

API Endpoints (server/routes/orders.js)

    POST /api/orders — create order
    PATCH /api/orders/:id — edit order (only if pending)
    PATCH /api/orders/:id/complete — mark completed (freezes order)
    PATCH /api/orders/:id/cancel — mark cancelled
    GET /api/orders — all pending orders
    GET /api/orders/summary/today — today's totals
    GET /api/orders/summary/:date — specific date totals
    GET /api/orders/summary/week/current — last 7 days breakdown
    GET /api/orders/history/:date — completed orders for a date

Menu File API (server/index.js)

    GET /api/menu — reads shared/menu.js raw content
    PUT /api/menu — writes new content to shared/menu.js
    Accessible from ⚙️ admin button on receptionist UI
    No server restart needed — browser reload picks up changes

Socket.io Events

    order:new → new order (kitchen flashes screen)
    order:updated → order edited (kitchen flashes ONLY if food changed)
    order:completed → removed from kitchen display
    order:cancelled → shown as strikethrough for 60s, then removed
    orders:all → all pending orders (sent on client connect)

Data Flow

text

Receptionist cart[] (rich objects)
  ├→ buildKitchenText()  → "2x Hawaiana c/Orilla +Champiñones"
  ├→ buildDisplayText()  → same + prices per line
  └→ buildTicket()       → formatted receipt with header/totals

Server receives strings → stores as-is → emits to clients
Kitchen receives kitchen_text → displays in rows

Text Format Convention

    kitchen_text: "2x Hawaiana c/Orilla de Queso +Champiñones, 1x Pan Ajo"
    display_text: "2x Hawaiana c/Orilla de Queso +Champiñones — $510\n1x Pan Ajo — $30"
    These formats are parsed back into cart items during order editing
    using parseDisplayText() which splits on \n and extracts via regex

Key Features

    ✅ Real-time order creation and kitchen display
    ✅ Order editing (only while pending, "(Modificado)" label if food changed)
    ✅ Order cancellation (kitchen shows strikethrough for 60s)
    ✅ Ticket/receipt generation with print support
    ✅ Client info: name, phone, address, delivery fee
    ✅ Pizza customization modal (orilla de queso, extra ingredients)
    ✅ "Personalizada" pizza with editable price, no extras section
    ✅ Promo items (price $0) in sides and beverages
    ✅ Day summary with tabs: Today / Order History / Weekly
    ✅ Cancelled orders excluded from sales totals
    ✅ $0 delivery fee confirmation prompt
    ✅ Admin menu editor (⚙️ button, no restart needed)
    ✅ Kitchen screen flash on new/updated/cancelled orders
    ✅ Kitchen counter shows pending + completed today

Menu Structure (shared/menu.js)

Categories: pizzas, sides, beverages, specials
Modifiers: Orilla de Queso (+$60)
Extra Ingredients: $30 each (9 options)
"Personalizada" pizza: custom price, no extras section
Promo items: $0 variants in sides and beverages
Format: { id: 'unique_id', name: 'Display Name', price: NUMBER }
Kitchen Display

    Airport-style dark blue theme with alternating row stripes
    Columns: # (order number) | HORA (time) | PEDIDO (kitchen_text)
    Long text wraps to wider rows (no horizontal scrolling)
    Modified orders: purple tint + "(Modificado)" prefix
    Cancelled orders: red background + strikethrough text (60s)
    Screen flash effect (2s, multiple pulses) on events
    Header shows clock + "X pendientes · Y completados"

Important Technical Notes

    All dates stored with datetime('now','localtime') in SQLite
    Frontend date queries must use local time (not toISOString/UTC)
    peso() helper function used for all price display (avoids $$
    template literal issues in chat-based code transfer)
    menu.js uses dual export pattern (works in both Node and browser)
    better-sqlite3 compiled natively on Pi (takes 2-3 min)
    Database uses WAL journal mode for concurrent read performance
