import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { db } from './db.mjs';
import { hashPassword, signToken, verifyPassword, verifyToken } from './auth.mjs';

export const DATA_DIR = path.resolve(import.meta.dirname, '..', 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = MIME_EXT[file.mimetype] || path.extname(file.originalname) || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (String(file.mimetype).startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片'));
    }
  },
});

function requireOwner(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'owner') {
    res.status(401).json({ error: 'unauthorized', message: '请先用店主账号登录' });
    return;
  }
  req.user = payload;
  next();
}

const asCents = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

export function createRouter() {
  const router = express.Router();

  // ---------- 店主登录（和顾客一样：没见过的手机号自动注册成店主） ----------
  router.post('/auth/login', (req, res) => {
    const phone = String(req.body?.phone || '').trim();
    const password = String(req.body?.password || '');
    if (!/^1\d{10}$/.test(phone)) {
      res.status(400).json({ error: 'bad_request', message: '手机号要是 11 位数字' });
      return;
    }
    if (password.length < 4) {
      res.status(400).json({ error: 'bad_request', message: '密码至少 4 位' });
      return;
    }

    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    let created = false;

    if (!user) {
      const info = db
        .prepare("INSERT INTO users (phone, password_hash, role, name) VALUES (?, ?, 'owner', ?)")
        .run(phone, hashPassword(password), '店主');
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
      created = true;
    } else if (!verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'bad_credentials', message: '这个手机号已经注册过，密码不对' });
      return;
    } else if (user.role !== 'owner') {
      // 同一个手机号之前是顾客，现在用正确密码进店主端：给他店主权限
      db.prepare("UPDATE users SET role = 'owner' WHERE id = ?").run(user.id);
      user = { ...user, role: 'owner' };
    }

    const token = signFor(user);
    res.json({ token, user: publicUser(user), created });
  });

  // ---------- 顾客登录（手机号 + 密码，首次自动注册） ----------
  router.post('/auth/customer-login', (req, res) => {
    const phone = String(req.body?.phone || '').trim();
    const password = String(req.body?.password || '');
    if (!/^1\d{10}$/.test(phone)) {
      res.status(400).json({ error: 'bad_request', message: '手机号要是 11 位数字' });
      return;
    }
    if (password.length < 4) {
      res.status(400).json({ error: 'bad_request', message: '密码至少 4 位' });
      return;
    }

    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    let created = false;
    if (!user) {
      const info = db
        .prepare("INSERT INTO users (phone, password_hash, role, name) VALUES (?, ?, 'customer', '')")
        .run(phone, hashPassword(password));
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
      created = true;
    } else if (!verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'bad_credentials', message: '这个手机号已经注册过，密码不对' });
      return;
    }

    const token = signToken({ uid: user.id, phone: user.phone, role: user.role });
    res.json({ token, user: publicUser(user), created });
  });

  // ---------- 经营概况 & 收款流水 ----------
  const REVENUE_SINCE_KEY = 'revenue_reset_at';
  const REVENUE_WATERMARK_KEY = 'revenue_reset_payment_id';

  function revenueSince() {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(REVENUE_SINCE_KEY);
    return row?.value ?? null;
  }

  /**
   * 用「支付流水自增 id 水位线」来判断哪些收款算数：比时间戳可靠，
   * 不受时钟精度、时区、字符串格式影响（同一秒里先收款后清零不会算错）。
   */
  function revenueWatermark() {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(REVENUE_WATERMARK_KEY);
    return Number(row?.value ?? 0);
  }

  function buildSummary() {
    const since = revenueSince();
    const watermark = revenueWatermark();

    const accumulated = db
      .prepare(
        "SELECT COALESCE(SUM(amount_cents), 0) AS cents, COUNT(*) AS n FROM payments WHERE status = 'SUCCESS' AND id > ?",
      )
      .get(watermark);

    const today = db
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) AS cents, COUNT(*) AS n
         FROM payments
         WHERE status = 'SUCCESS' AND date(paid_at, 'localtime') = date('now', 'localtime')`,
      )
      .get();
    const openCount = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'OPEN'").get();
    const todayOrders = db
      .prepare(
        "SELECT COUNT(*) AS n FROM orders WHERE date(created_at, 'localtime') = date('now', 'localtime')",
      )
      .get();

    return {
      revenueCents: Number(accumulated?.cents ?? 0),
      revenueCount: Number(accumulated?.n ?? 0),
      revenueSince: since,
      todayRevenueCents: Number(today?.cents ?? 0),
      todayPaidCount: Number(today?.n ?? 0),
      openOrderCount: Number(openCount?.n ?? 0),
      todayOrderCount: Number(todayOrders?.n ?? 0),
    };
  }

  function recentOrders(limit) {
    const rows = db
      .prepare(
        `SELECT o.id, o.order_no, o.phone, o.status, o.total_cents, o.created_at, o.paid_at,
                (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS item_rows,
                (SELECT SUM(i.quantity) FROM order_items i WHERE i.order_id = o.id) AS item_qty,
                p.channel AS pay_channel, p.status AS pay_status, p.out_trade_no
         FROM orders o
         LEFT JOIN payments p ON p.id = (SELECT MAX(id) FROM payments WHERE order_id = o.id)
         ORDER BY o.id DESC
         LIMIT ?`,
      )
      .all(limit);

    return rows.map((row) => ({
      id: row.id,
      orderNo: row.order_no,
      phone: row.phone,
      status: row.status,
      totalCents: row.total_cents,
      createdAt: row.created_at,
      paidAt: row.paid_at,
      itemRows: Number(row.item_rows ?? 0),
      itemQty: Number(row.item_qty ?? 0),
      payChannel: row.pay_channel,
      payStatus: row.pay_status,
      outTradeNo: row.out_trade_no,
    }));
  }

  router.get('/admin/summary', requireOwner, (req, res) => {
    res.json(buildSummary());
  });

  // 店主首页一次性拿全：分区 + 经营概况 + 最近订单。
  // 少一次往返（隧道/代理下每个往返几百毫秒，能省就省）。
  router.get('/admin/dashboard', requireOwner, (req, res) => {
    const categories = db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM dishes d WHERE d.category_id = c.id) AS dish_count
         FROM categories c ORDER BY c.sort_order, c.id`,
      )
      .all()
      .map(mapCategory);

    res.json({
      categories,
      summary: buildSummary(),
      orders: recentOrders(5),
    });
  });

  // 清零营业额：记一个水位线 + 一个时间戳，历史订单和支付流水一条不动
  router.post('/admin/revenue/reset', requireOwner, (req, res) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const maxId = db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM payments').get();
    const upsert = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );
    upsert.run(REVENUE_SINCE_KEY, now);
    upsert.run(REVENUE_WATERMARK_KEY, String(Number(maxId?.m ?? 0)));
    res.json({ ok: true, revenueSince: now, watermark: Number(maxId?.m ?? 0) });
  });

  router.get('/admin/orders', requireOwner, (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    res.json({ orders: recentOrders(limit) });
  });

  // ---------- 分区 ----------
  router.get('/admin/categories', requireOwner, (req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM dishes d WHERE d.category_id = c.id) AS dish_count
         FROM categories c ORDER BY c.sort_order, c.id`,
      )
      .all();
    res.json({ categories: rows.map(mapCategory) });
  });

  router.post('/admin/categories', requireOwner, (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'bad_request', message: '分区名不能为空' });
      return;
    }
    const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories').get();
    const info = db
      .prepare('INSERT INTO categories (name, sort_order, visible) VALUES (?, ?, 1)')
      .run(name, Number(max.m) + 1);
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(info.lastInsertRowid));
    res.status(201).json({ category: mapCategory({ ...row, dish_count: 0 }) });
  });

  router.patch('/admin/categories/:id', requireOwner, (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const name = req.body?.name === undefined ? row.name : String(req.body.name).trim();
    if (!name) {
      res.status(400).json({ error: 'bad_request', message: '分区名不能为空' });
      return;
    }
    const sortOrder = req.body?.sortOrder === undefined ? row.sort_order : Number(req.body.sortOrder);
    const visible = req.body?.visible === undefined ? row.visible : req.body.visible ? 1 : 0;
    db.prepare('UPDATE categories SET name = ?, sort_order = ?, visible = ? WHERE id = ?').run(
      name,
      sortOrder,
      visible,
      id,
    );
    res.json({ ok: true });
  });

  router.delete('/admin/categories/:id', requireOwner, (req, res) => {
    const id = Number(req.params.id);
    const count = db.prepare('SELECT COUNT(*) AS n FROM dishes WHERE category_id = ?').get(id);
    if (count?.n > 0) {
      res.status(409).json({
        error: 'not_empty',
        message: `这个分区下还有 ${count.n} 道菜，先把菜挪走或删掉`,
      });
      return;
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  // ---------- 菜品 ----------
  router.get('/admin/dishes', requireOwner, (req, res) => {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const rows = categoryId
      ? db
          .prepare('SELECT * FROM dishes WHERE category_id = ? ORDER BY sort_order, id')
          .all(categoryId)
      : db.prepare('SELECT * FROM dishes ORDER BY category_id, sort_order, id').all();
    res.json({ dishes: rows.map(mapDish) });
  });

  router.post('/admin/dishes', requireOwner, (req, res) => {
    const categoryId = Number(req.body?.categoryId);
    const name = String(req.body?.name || '').trim();
    const priceCents = asCents(req.body?.priceCents);
    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
    if (!category) {
      res.status(400).json({ error: 'bad_request', message: '分区不存在' });
      return;
    }
    if (!name) {
      res.status(400).json({ error: 'bad_request', message: '菜名不能为空' });
      return;
    }
    if (priceCents === null) {
      res.status(400).json({ error: 'bad_request', message: '价格不对' });
      return;
    }
    const max = db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM dishes WHERE category_id = ?')
      .get(categoryId);
    const info = db
      .prepare(
        'INSERT INTO dishes (category_id, name, image, price_cents, description, available, sold_out, sort_order) VALUES (?, ?, ?, ?, ?, 1, 0, ?)',
      )
      .run(
        categoryId,
        name,
        String(req.body?.image || ''),
        priceCents,
        String(req.body?.description || ''),
        Number(max.m) + 1,
      );
    const row = db.prepare('SELECT * FROM dishes WHERE id = ?').get(Number(info.lastInsertRowid));
    res.status(201).json({ dish: mapDish(row) });
  });

  router.patch('/admin/dishes/:id', requireOwner, (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM dishes WHERE id = ?').get(id);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const body = req.body || {};
    const next = {
      category_id: body.categoryId === undefined ? row.category_id : Number(body.categoryId),
      name: body.name === undefined ? row.name : String(body.name).trim(),
      image: body.image === undefined ? row.image : String(body.image),
      price_cents: body.priceCents === undefined ? row.price_cents : asCents(body.priceCents),
      description: body.description === undefined ? row.description : String(body.description),
      available: body.available === undefined ? row.available : body.available ? 1 : 0,
      sold_out: body.soldOut === undefined ? row.sold_out : body.soldOut ? 1 : 0,
      sort_order: body.sortOrder === undefined ? row.sort_order : Number(body.sortOrder),
    };
    if (!next.name) {
      res.status(400).json({ error: 'bad_request', message: '菜名不能为空' });
      return;
    }
    if (next.price_cents === null) {
      res.status(400).json({ error: 'bad_request', message: '价格不对' });
      return;
    }
    db.prepare(
      `UPDATE dishes SET category_id = ?, name = ?, image = ?, price_cents = ?, description = ?,
         available = ?, sold_out = ?, sort_order = ? WHERE id = ?`,
    ).run(
      next.category_id,
      next.name,
      next.image,
      next.price_cents,
      next.description,
      next.available,
      next.sold_out,
      next.sort_order,
      id,
    );
    res.json({ ok: true });
  });

  router.delete('/admin/dishes/:id', requireOwner, (req, res) => {
    db.prepare('DELETE FROM dishes WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- 图片上传 ----------
  router.post('/admin/upload', requireOwner, upload.single('file'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'bad_request', message: '没有收到文件' });
      return;
    }

    const originalPath = req.file.path;
    const baseName = path.parse(req.file.filename).name;
    const jpegName = `${baseName}.jpg`;
    const jpegPath = path.join(UPLOAD_DIR, jpegName);
    // 必须写到一个不同的临时文件：上传的本来就是 .jpg 时，输入输出同名 sharp 会直接报
    // "Cannot use same file for input and output"，压缩整个跳过（这正是之前图片没变小的原因）。
    const tmpPath = path.join(UPLOAD_DIR, `${baseName}.opt.jpg`);
    let finalName = req.file.filename;
    let finalSize = fs.statSync(originalPath).size;
    let didCompress = false;

    try {
      await sharp(originalPath)
        .rotate()
        .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 78, mozjpeg: true })
        .toFile(tmpPath);

      finalSize = fs.statSync(tmpPath).size;
      if (originalPath !== jpegPath && fs.existsSync(originalPath)) {
        fs.unlinkSync(originalPath);
      }
      fs.renameSync(tmpPath, jpegPath);
      finalName = jpegName;
      didCompress = true;
    } catch (err) {
      console.error('[upload] 压缩失败，保留原图：', err?.message ?? err);
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      } catch {}
    }

    res.status(201).json({
      url: `/uploads/${finalName}`,
      size: finalSize,
      originalSize: req.file.size,
      compressed: didCompress,
    });
  });

  return router;
}

function signFor(user) {
  return signToken({ uid: user.id, phone: user.phone, role: user.role });
}

function publicUser(row) {
  return { id: row.id, phone: row.phone, role: row.role, name: row.name };
}

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    visible: !!row.visible,
    dishCount: row.dish_count ?? 0,
  };
}

function mapDish(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    image: row.image,
    priceCents: row.price_cents,
    description: row.description,
    available: !!row.available,
    soldOut: !!row.sold_out,
    sortOrder: row.sort_order,
  };
}
