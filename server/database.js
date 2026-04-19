const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'pizzeria.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kitchen_text TEXT NOT NULL,
    display_text TEXT NOT NULL,
    total REAL NOT NULL,
    delivery_fee REAL DEFAULT 0,
    client_name TEXT DEFAULT '',
    client_phone TEXT DEFAULT '',
    delivery_address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    modified_at TEXT,
    created_at TEXT,
    completed_at TEXT
  )
`);

module.exports = db;