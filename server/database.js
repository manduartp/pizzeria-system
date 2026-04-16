const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'pizzeria.db'));

// Better performance for concurrent reads
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    notes TEXT DEFAULT '',
    delivery_address TEXT DEFAULT '',
    created_at TEXT,
    completed_at TEXT
  )
`);

module.exports = db;