import express from 'express';
import { db } from './db.mjs';
import { verifyToken } from './auth.mjs';

export function requireCustomer(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verifyToken(token);
  if (!payload || !payload.uid) {
    res.status(401).json({ error: 'unauthorized', message: '请先登录' });
    return;
  }
  req.user = payload;
  next();
}

/**
 * 订单号：4 位随机数（1000-9999），保证不与库里已有的订单号重复，
 * 这样顾客报号、店主看单都短。库里 4 位用光时自动退到更长的号。
 */
function nextOrderNo() {
  const taken = new Set(
    db
      .prepare('SELECT order_no FROM orders')
      .all()
      .map((row) => String(row.order_no)),
  );

  for (let i = 0; i < 300; i += 1) {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    if (!taken.has(code)) {
      return code;
    }
  }
  for (let i = 0; i < 500; i += 1) {
    const code = String(10000 + Math.floor(Math.random() * 90000));
    if (!taken.has(code)) {
      return code;
    }
  }
  return String(Date.now()).slice(-8);
}

function orderDetail(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return null;
  }
  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id')
    .all(orderId);
  const totalCents = items.reduce((sum, it) => sum + it.price_snapshot * it.quantity, 0);
  return {
    id: order.id,
    orderNo: order.order_no,
    status: order.status,
    totalCents,
    tableNo: order.table_no,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    paidAt: order.paid_at,
    items: items.map((it) => ({
      id: it.id,
      dishId: it.dish_id,
      name: it.name_snapshot,
      image: it.image_snapshot,
      priceCents: it.price_snapshot,
      quantity: it.quantity,
      amountCents: it.price_snapshot * it.quantity,
    })),
  };
}

/** 校验菜品是否可点，返回归一化后的行和总价。 */
function priceItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: '请先选菜' };
  }
  const merged = new Map();
  for (const item of rawItems) {
    const dishId = Number(item?.dishId);
    const qty = Number(item?.qty);
    if (!Number.isInteger(dishId) || !Number.isInteger(qty) || qty <= 0) {
      return { error: '菜品数量不对' };
    }
    merged.set(dishId, (merged.get(dishId) ?? 0) + qty);
  }

  const rows = [];
  for (const [dishId, qty] of merged) {
    const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(dishId);
    if (!dish) {
      return { error: `菜品 ${dishId} 不存在` };
    }
    if (!dish.available || dish.sold_out) {
      return { error: `「${dish.name}」已经不能点了` };
    }
    rows.push({ dish, qty });
  }
  return { rows };
}

function openOrderFor(userId) {
  return db
    .prepare("SELECT id FROM orders WHERE user_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1")
    .get(userId);
}

function appendItems(orderId, rows) {
  const insert = db.prepare(
    `INSERT INTO order_items (order_id, dish_id, name_snapshot, price_snapshot, image_snapshot, quantity)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const { dish, qty } of rows) {
    const existing = db
      .prepare('SELECT * FROM order_items WHERE order_id = ? AND dish_id = ? AND price_snapshot = ?')
      .get(orderId, dish.id, dish.price_cents);
    if (existing) {
      db.prepare('UPDATE order_items SET quantity = quantity + ? WHERE id = ?').run(qty, existing.id);
    } else {
      insert.run(orderId, dish.id, dish.name, dish.price_cents, dish.image, qty);
    }
  }
  const detail = orderDetail(orderId);
  db.prepare('UPDATE orders SET total_cents = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    detail.totalCents,
    orderId,
  );
}

export function createOrdersRouter() {
  const router = express.Router();

  // 当前未结算订单（加菜 / 退出后按手机号恢复都靠它）
  router.get('/orders/open', requireCustomer, (req, res) => {
    const row = openOrderFor(req.user.uid);
    res.json({ order: row ? orderDetail(row.id) : null });
  });

  router.get('/orders/:id', requireCustomer, (req, res) => {
    const order = orderDetail(Number(req.params.id));
    if (!order) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const owner = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(order.id);
    if (owner?.user_id !== req.user.uid) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    res.json({ order });
  });

  // 下单：没有未结算订单就新建（生成订单号），有就当作加菜追加
  router.post('/orders', requireCustomer, (req, res) => {
    const priced = priceItems(req.body?.items);
    if (priced.error) {
      res.status(400).json({ error: 'bad_request', message: priced.error });
      return;
    }

    const existing = openOrderFor(req.user.uid);
    if (existing) {
      appendItems(existing.id, priced.rows);
      res.json({ order: orderDetail(existing.id), appended: true });
      return;
    }

    const orderNo = nextOrderNo();
    const info = db
      .prepare(
        "INSERT INTO orders (order_no, user_id, phone, table_no, status, total_cents) VALUES (?, ?, ?, ?, 'OPEN', 0)",
      )
      .run(orderNo, req.user.uid, req.user.phone, String(req.body?.tableNo || ''));
    const orderId = Number(info.lastInsertRowid);
    appendItems(orderId, priced.rows);
    res.status(201).json({ order: orderDetail(orderId), appended: false });
  });

  // 给指定订单加菜
  router.post('/orders/:id/items', requireCustomer, (req, res) => {
    const orderId = Number(req.params.id);
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (row.user_id !== req.user.uid) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    if (row.status !== 'OPEN') {
      res.status(409).json({ error: 'not_open', message: '这单已经结账了' });
      return;
    }
    const priced = priceItems(req.body?.items);
    if (priced.error) {
      res.status(400).json({ error: 'bad_request', message: priced.error });
      return;
    }
    appendItems(orderId, priced.rows);
    res.json({ order: orderDetail(orderId) });
  });

  return router;
}
