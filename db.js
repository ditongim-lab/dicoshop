const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.resolve(process.cwd(), 'data.sqlite');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  description TEXT,
  image TEXT,
  stock INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guild_config (
  guild_id TEXT PRIMARY KEY,
  ticket_log_channel TEXT,
  ticket_admin_role TEXT,
  ticket_category TEXT,
  log_channel TEXT,
  charge_account TEXT,
  honeypot_channel TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS charge_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS event_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  admin_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  product_id INTEGER,
  product_name TEXT,
  price INTEGER,
  created_at INTEGER NOT NULL
);
`);

// ─────────────────────────────
// 유저 / 포인트
// ─────────────────────────────
function ensureUser(guildId, userId) {
  db.prepare(
    `INSERT INTO users (guild_id, user_id, points) VALUES (?, ?, 0)
     ON CONFLICT(guild_id, user_id) DO NOTHING`
  ).run(guildId, userId);
}

function getPoints(guildId, userId) {
  ensureUser(guildId, userId);
  const row = db.prepare(`SELECT points FROM users WHERE guild_id = ? AND user_id = ?`).get(guildId, userId);
  return row ? row.points : 0;
}

function addPoints(guildId, userId, amount) {
  ensureUser(guildId, userId);
  db.prepare(`UPDATE users SET points = points + ? WHERE guild_id = ? AND user_id = ?`).run(amount, guildId, userId);
  return getPoints(guildId, userId);
}

function subtractPoints(guildId, userId, amount) {
  return addPoints(guildId, userId, -amount);
}

// ─────────────────────────────
// 상품
// ─────────────────────────────
function addProduct(guildId, { name, price, description, image, stock }) {
  const info = db
    .prepare(
      `INSERT INTO products (guild_id, name, price, description, image, stock)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(guildId, name, price, description || '', image || null, stock);
  return info.lastInsertRowid;
}

function getProducts(guildId) {
  return db.prepare(`SELECT * FROM products WHERE guild_id = ? ORDER BY id ASC`).all(guildId);
}

function getProductByName(guildId, name) {
  return db.prepare(`SELECT * FROM products WHERE guild_id = ? AND name = ?`).get(guildId, name);
}

function getProductById(id) {
  return db.prepare(`SELECT * FROM products WHERE id = ?`).get(id);
}

function deleteProduct(guildId, name) {
  const info = db.prepare(`DELETE FROM products WHERE guild_id = ? AND name = ?`).run(guildId, name);
  return info.changes > 0;
}

function decrementStock(productId, amount = 1) {
  db.prepare(`UPDATE products SET stock = stock - ? WHERE id = ?`).run(amount, productId);
}

// ─────────────────────────────
// 서버 설정
// ─────────────────────────────
function getConfig(guildId) {
  let row = db.prepare(`SELECT * FROM guild_config WHERE guild_id = ?`).get(guildId);
  if (!row) {
    db.prepare(`INSERT INTO guild_config (guild_id) VALUES (?)`).run(guildId);
    row = db.prepare(`SELECT * FROM guild_config WHERE guild_id = ?`).get(guildId);
  }
  return row;
}

function updateConfig(guildId, fields) {
  getConfig(guildId); // 행 존재 보장
  const keys = Object.keys(fields);
  if (keys.length === 0) return getConfig(guildId);
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  db.prepare(`UPDATE guild_config SET ${setClause} WHERE guild_id = ?`).run(...values, guildId);
  return getConfig(guildId);
}

// ─────────────────────────────
// 티켓
// ─────────────────────────────
function createTicketRecord(guildId, channelId, userId) {
  const info = db
    .prepare(`INSERT INTO tickets (guild_id, channel_id, user_id, status, created_at) VALUES (?, ?, ?, 'open', ?)`)
    .run(guildId, channelId, userId, Date.now());
  return info.lastInsertRowid;
}

function getTicketByChannel(channelId) {
  return db.prepare(`SELECT * FROM tickets WHERE channel_id = ?`).get(channelId);
}

function closeTicketRecord(channelId) {
  db.prepare(`UPDATE tickets SET status = 'closed' WHERE channel_id = ?`).run(channelId);
}

function getOpenTicketByUser(guildId, userId) {
  return db
    .prepare(`SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'`)
    .get(guildId, userId);
}

// ─────────────────────────────
// 충전 요청
// ─────────────────────────────
function createChargeRequest(guildId, userId, amount) {
  const info = db
    .prepare(
      `INSERT INTO charge_requests (guild_id, user_id, amount, status, created_at) VALUES (?, ?, ?, 'pending', ?)`
    )
    .run(guildId, userId, amount, Date.now());
  return info.lastInsertRowid;
}

function setChargeRequestMessage(id, messageId) {
  db.prepare(`UPDATE charge_requests SET message_id = ? WHERE id = ?`).run(messageId, id);
}

function getChargeRequest(id) {
  return db.prepare(`SELECT * FROM charge_requests WHERE id = ?`).get(id);
}

function updateChargeRequestStatus(id, status) {
  db.prepare(`UPDATE charge_requests SET status = ? WHERE id = ?`).run(status, id);
}

// ─────────────────────────────
// 이벤트 지급 로그
// ─────────────────────────────
function addEventLog(guildId, userId, amount, reason, adminId) {
  db.prepare(
    `INSERT INTO event_logs (guild_id, user_id, amount, reason, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(guildId, userId, amount, reason || '', adminId, Date.now());
}

// ─────────────────────────────
// 구매 로그
// ─────────────────────────────
function addPurchaseLog(guildId, userId, productId, productName, price) {
  db.prepare(
    `INSERT INTO purchase_logs (guild_id, user_id, product_id, product_name, price, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(guildId, userId, productId, productName, price, Date.now());
}

module.exports = {
  db,
  ensureUser,
  getPoints,
  addPoints,
  subtractPoints,
  addProduct,
  getProducts,
  getProductByName,
  getProductById,
  deleteProduct,
  decrementStock,
  getConfig,
  updateConfig,
  createTicketRecord,
  getTicketByChannel,
  closeTicketRecord,
  getOpenTicketByUser,
  createChargeRequest,
  setChargeRequestMessage,
  getChargeRequest,
  updateChargeRequestStatus,
  addEventLog,
  addPurchaseLog,
};
