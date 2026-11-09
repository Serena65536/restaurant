import express from 'express';
import path from 'node:path';
import { db } from './db.mjs';
import { createRouter } from './admin.mjs';
import { createOrdersRouter } from './orders.mjs';
import { createPaymentsRouter } from './payments.mjs';

export const DATA_DIR = path.resolve(import.meta.dirname, '..', 'data');

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // 静态图片：文件名随机、内容不变，可以放心长缓存（手机端只下第一次）
  app.use(
    '/uploads',
    express.static(path.join(DATA_DIR, 'uploads'), {
      maxAge: '30d',
      immutable: true,
      etag: true,
    }),
  );

  app.get('/api/health', (req, res) => {
    const row = db.prepare('SELECT COUNT(*) AS n FROM dishes').get();
    res.json({ ok: true, service: 'restaurant-server', dishes: row?.n ?? 0, time: new Date().toISOString() });
  });

  // 顾客点餐页用：按分区分组返回菜品
  app.get('/api/menu', (req, res) => {
    const categories = db
      .prepare('SELECT id, name, sort_order FROM categories WHERE visible = 1 ORDER BY sort_order, id')
      .all();
    const dishes = db
      .prepare('SELECT id, category_id, name, image, price_cents, description, available, sold_out, sort_order FROM dishes ORDER BY sort_order, id')
      .all();

    const grouped = categories.map((c) => ({
      id: c.id,
      name: c.name,
      dishes: dishes
        .filter((d) => d.category_id === c.id)
        .map((d) => ({
          id: d.id,
          name: d.name,
          image: d.image,
          priceCents: d.price_cents,
          description: d.description,
          available: !!d.available && !d.sold_out,
        })),
    }));

    res.json({ categories: grouped });
  });

  app.use('/api', createRouter());
  app.use('/api', createOrdersRouter());
  app.use('/api', createPaymentsRouter());

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'not_found', path: req.originalUrl });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[server error]', err);
    res.status(500).json({ error: 'internal_error', message: String(err?.message || err) });
  });

  return app;
}
