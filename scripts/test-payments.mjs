// M4 冒烟测试：发起支付 → 模拟回调 → 订单变已结账 → 重复回调不重复记账 → 店主流水
const BASE = process.env.BASE || 'http://127.0.0.1:8080';

let pass = 0;
let fail = 0;

function check(name, ok, extra = '') {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`);
  }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function main() {
  console.log('— 准备顾客和订单 —');
  const phone = '136' + String(Date.now()).slice(-8);
  const login = await api('/api/auth/customer-login', {
    method: 'POST',
    body: { phone, password: 'pass1234' },
  });
  const token = login.json.token;

  const menu = await api('/api/menu');
  const dish = menu.json.categories.flatMap(c => c.dishes).find(d => d.available);
  const order = await api('/api/orders', {
    method: 'POST',
    token,
    body: { items: [{ dishId: dish.id, qty: 2 }] },
  });
  const orderId = order.json.order.id;
  const orderNo = order.json.order.orderNo;
  const amount = order.json.order.totalCents;
  console.log(`订单 ${orderNo}，金额 ${amount} 分`);

  console.log('— 发起支付 —');
  const noAuth = await api('/api/payments', { method: 'POST', body: { orderId, channel: 'wechat' } });
  check('未登录不能发起支付', noAuth.status === 401);

  const badChannel = await api('/api/payments', {
    method: 'POST',
    token,
    body: { orderId, channel: 'bitcoin' },
  });
  check('不支持的支付方式被拒', badChannel.status === 400);

  const wechat = await api('/api/payments', {
    method: 'POST',
    token,
    body: { orderId, channel: 'wechat' },
  });
  check('微信支付单创建成功', wechat.status === 201 && wechat.json.mode === 'mock', wechat.json.payment?.outTradeNo);
  check('支付金额与订单一致', wechat.json.payment?.amountCents === amount, `${wechat.json.payment?.amountCents}`);
  const paymentId = wechat.json.payment.id;

  const early = await api(`/api/orders/${orderId}`, { token });
  check('发起支付但没回调时订单仍是未结算', early.json.order.status === 'OPEN');

  console.log('— 支付回调 —');
  const confirmed = await api(`/api/payments/${paymentId}/confirm`, { method: 'POST', token });
  check('回调后支付单成功', confirmed.json.payment?.status === 'SUCCESS');
  check('回调后订单变已结账', confirmed.json.order?.status === 'PAID');

  const orderNow = await api(`/api/orders/${orderId}`, { token });
  check('订单详情显示已结账', orderNow.json.order.status === 'PAID');

  const openGone = await api('/api/orders/open', { token });
  check('未结算订单列表里已经没有它', openGone.json.order === null);

  console.log('— 幂等 —');
  const again = await api(`/api/payments/${paymentId}/confirm`, { method: 'POST', token });
  check('重复回调不会报错', again.status === 200);

  const payAgain = await api('/api/payments', { method: 'POST', token, body: { orderId, channel: 'alipay' } });
  check('已结账订单不能再发起支付', payAgain.status === 409, payAgain.json?.message);

  console.log('— 店主流水 —');
  const owner = await api('/api/auth/login', {
    method: 'POST',
    body: { phone: '13800000000', password: 'admin123' },
  });
  const ownerToken = owner.json.token;

  const summaryBefore = await api('/api/admin/summary', { token: ownerToken });
  check('店主能看经营概况', summaryBefore.status === 200, `今日营业额 ${summaryBefore.json.todayRevenueCents} 分`);

  const orders = await api('/api/admin/orders?limit=5', { token: ownerToken });
  const mine = orders.json.orders.find(o => o.id === orderId);
  check('订单列表能看到这单', !!mine, `状态=${mine?.status} 金额=${mine?.totalCents}`);
  check('订单列表带支付方式', mine?.payChannel === 'wechat');
  check('订单列表带流水号', typeof mine?.outTradeNo === 'string' && mine.outTradeNo.length > 0);

  const totalPaid = orders.json.orders
    .filter(o => o.status === 'PAID')
    .reduce((n, o) => n + o.totalCents, 0);
  check(
    '已结账订单金额被计入',
    summaryBefore.json.todayRevenueCents >= amount,
    `今日营业额 ${summaryBefore.json.todayRevenueCents} ≥ 本单 ${amount}`,
  );

  console.log('— 支付宝通道 —');
  const phone2 = '135' + String(Date.now()).slice(-8);
  const login2 = await api('/api/auth/customer-login', {
    method: 'POST',
    body: { phone: phone2, password: 'pass1234' },
  });
  const order2 = await api('/api/orders', {
    method: 'POST',
    token: login2.json.token,
    body: { items: [{ dishId: dish.id, qty: 1 }] },
  });
  const alipay = await api('/api/payments', {
    method: 'POST',
    token: login2.json.token,
    body: { orderId: order2.json.order.id, channel: 'alipay' },
  });
  check('支付宝通道可用', alipay.status === 201 && alipay.json.payment.channel === 'alipay');
  const alipayDone = await api(`/api/payments/${alipay.json.payment.id}/confirm`, {
    method: 'POST',
    token: login2.json.token,
  });
  check('支付宝支付成功', alipayDone.json.order?.status === 'PAID');

  console.log('— 营业额清零 —');

  // 先清零一次当基线，保证这一节的结果跟历史数据无关
  await api('/api/admin/revenue/reset', { method: 'POST', token: ownerToken });

  async function payNewOrder(qty) {
    const phone = '134' + String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 9));
    const loginRes = await api('/api/auth/customer-login', {
      method: 'POST',
      body: { phone: phone.slice(0, 11), password: 'pass1234' },
    });
    const newOrder = await api('/api/orders', {
      method: 'POST',
      token: loginRes.json.token,
      body: { items: [{ dishId: dish.id, qty }] },
    });
    const pay = await api('/api/payments', {
      method: 'POST',
      token: loginRes.json.token,
      body: { orderId: newOrder.json.order.id, channel: 'wechat' },
    });
    await api(`/api/payments/${pay.json.payment.id}/confirm`, {
      method: 'POST',
      token: loginRes.json.token,
    });
    return newOrder.json.order.totalCents;
  }

  const firstAmount = await payNewOrder(1);
  const s1 = await api('/api/admin/summary', { token: ownerToken });
  check('清零后新付款会计入累计', s1.json.revenueCents === firstAmount, `累计 ${s1.json.revenueCents} 分`);
  const todayBefore = s1.json.todayRevenueCents;

  const reset = await api('/api/admin/revenue/reset', { method: 'POST', token: ownerToken });
  check('清零成功', reset.status === 200 && !!reset.json.revenueSince, reset.json.revenueSince);

  const s2 = await api('/api/admin/summary', { token: ownerToken });
  check('清零后累计营业额归零', s2.json.revenueCents === 0, `${s2.json.revenueCents}`);
  check(
    '清零不影响「今日营收」',
    s2.json.todayRevenueCents === todayBefore,
    `今日仍为 ${s2.json.todayRevenueCents} 分`,
  );

  const history = await api('/api/admin/orders?limit=50', { token: ownerToken });
  check(
    '历史订单与流水一条没删',
    history.json.orders.some(o => o.id === orderId && o.status === 'PAID'),
  );

  const secondAmount = await payNewOrder(2);
  const s3 = await api('/api/admin/summary', { token: ownerToken });
  check(
    '清零后重新开始累计',
    s3.json.revenueCents === secondAmount,
    `累计 ${s3.json.revenueCents} 分`,
  );

  console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('测试异常', e);
  process.exit(1);
});
