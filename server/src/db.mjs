// 数据访问层：只有这个文件直接接触 SQLite。
// 以后换 MySQL / Postgres 时，改动集中在这里，路由层不用动。
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(import.meta.dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'app.db');
export const db = new DatabaseSync(DB_FILE);

db.exec(`PRAGMA journal_mode = WAL;`);
db.exec(`PRAGMA foreign_keys = ON;`);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  phone         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer',  -- owner | customer
  name          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dishes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  image      TEXT NOT NULL DEFAULT '',       -- /uploads/xxx.jpg 或外链
  price_cents INTEGER NOT NULL,              -- 以「分」为单位，避免浮点误差
  description TEXT NOT NULL DEFAULT '',
  available  INTEGER NOT NULL DEFAULT 1,     -- 是否上架
  sold_out   INTEGER NOT NULL DEFAULT 0,     -- 是否售罄
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no    TEXT NOT NULL UNIQUE,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  phone       TEXT NOT NULL,
  table_no    TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'OPEN',  -- OPEN | PAID | CANCELLED
  total_cents INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at     TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id         INTEGER NOT NULL,
  name_snapshot   TEXT NOT NULL,
  price_snapshot  INTEGER NOT NULL,
  image_snapshot  TEXT NOT NULL DEFAULT '',
  quantity        INTEGER NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id       INTEGER NOT NULL REFERENCES orders(id),
  channel        TEXT NOT NULL,              -- mock | wechat | alipay
  amount_cents   INTEGER NOT NULL,
  out_trade_no   TEXT NOT NULL UNIQUE,
  trade_no       TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | SUCCESS | FAILED
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at        TEXT,
  raw_notify     TEXT NOT NULL DEFAULT ''
);

-- 键值配置：目前用来存「营业额清零时间」
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_phone_status ON orders(phone, status);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
`;

export function migrate() {
  db.exec(SCHEMA);
}

export function isEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM dishes').get();
  return !row || row.n === 0;
}

export default { db, migrate, isEmpty };
