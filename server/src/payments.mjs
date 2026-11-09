import express from 'express';
import crypto from 'node:crypto';
import { db } from './db.mjs';
import { requireCustomer } from './orders.mjs';

const CHANNELS = new Set(['wechat', 'alipay', 'mock']);

function orderTotalCents(orderId) {
  const row = db
    .prepare('SELECT COALESCE(SUM(price_snapshot * quantity), 0) AS total FROM order_items WHERE order_id = ?')
    .get(orderId);
  return Number(row?.total ?? 0);
}

function paymentView(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    channel: row.channel,
    amountCents: row.amount_cents,
    outTradeNo: row.out_trade_no,
    tradeNo: row.trade_no,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

function ownPayment(paymentId, userId) {
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
  if (!row) {
    return { error: 404 };
  }
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(row.order_id);
  if (!order || order.user_id !== userId) {
    return { error: 403 };
  }
  return { payment: row, order };
}

/** 幂等：把支付单置为成功、订单置为已结账；重复调用不会重复记账。 */
function settle(payment, order) {
  if (payment.status === 'SUCCESS') {
    return;
  }
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.prepare("UPDATE payments SET status = 'SUCCESS', paid_at = ? WHERE id = ?").run(now, payment.id);
  db.prepare("UPDATE orders SET status = 'PAID', paid_at = ?, updated_at = ? WHERE id = ?").run(
    now,
    now,
    order.id,
  );
}

export function createPaymentsRouter() {
  const router = express.Router();

  // 发起支付：只建支付单，不碰订单状态（等回调确认）
  router.post('/payments', requireCustomer, (req, res) => {
    const orderId = Number(req.body?.orderId);
    const channel = String(req.body?.channel || 'mock');
    if (!CHANNELS.has(channel)) {
      res.status(400).json({ error: 'bad_request', message: '不支持的支付方式' });
      return;
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      res.status(404).json({ error: 'not_found', message: '订单不存在' });
      return;
    }
    if (order.user_id !== req.user.uid) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    if (order.status === 'PAID') {
      res.status(409).json({ error: 'already_paid', message: '这单已经结过账了' });
      return;
    }
    if (order.status !== 'OPEN') {
      res.status(409).json({ error: 'not_open', message: '订单状态不能付款' });
      return;
    }

    const amountCents = orderTotalCents(orderId);
    if (amountCents <= 0) {
      res.status(400).json({ error: 'bad_request', message: '订单金额为 0，不能支付' });
      return;
    }

    const outTradeNo = `${order.order_no}-${crypto.randomBytes(4).toString('hex')}`;
    const info = db
      .prepare(
        "INSERT INTO payments (order_id, channel, amount_cents, out_trade_no, status) VALUES (?, ?, ?, ?, 'PENDING')",
      )
      .run(orderId, channel, amountCents, outTradeNo);

    const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(Number(info.lastInsertRowid));
    res.status(201).json({
      payment: paymentView(row),
      // 真实接入时这里返回调起支付的参数；现在告诉前端走模拟收银台
      mode: 'mock',
      payHint: channel === 'alipay' ? '模拟支付宝收银台' : '模拟微信收银台',
    });
  });

  // 查支付状态（前端轮询用）
  router.get('/payments/:id', requireCustomer, (req, res) => {
    const { payment, error } = ownPayment(Number(req.params.id), req.user.uid);
    if (error) {
      res.status(error).json({ error: error === 404 ? 'not_found' : 'forbidden' });
      return;
    }
    res.json({ payment: paymentView(payment) });
  });

  // 模拟支付平台回调：真实接入后由微信/支付宝的 notify 替换，验签后再调 settle
  router.post('/payments/:id/confirm', requireCustomer, (req, res) => {
    const { payment, order, error } = ownPayment(Number(req.params.id), req.user.uid);
    if (error) {
      res.status(error).json({ error: error === 404 ? 'not_found' : 'forbidden' });
      return;
    }

    settle(payment, order);
    const fresh = db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id);
    const freshOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
    res.json({
      payment: paymentView(fresh),
      order: { id: freshOrder.id, orderNo: freshOrder.order_no, status: freshOrder.status, paidAt: freshOrder.paid_at },
    });
  });

  return router;
}
