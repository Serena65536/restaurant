// M3 冒烟测试：顾客注册/登录 → 下单 → 加菜 → 退出后恢复未结算订单
const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const PHONE = '139' + String(Date.now()).slice(-8);

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
  console.log(`顾客手机号：${PHONE}`);

  console.log('— 登录 / 注册 —');
  const weak = await api('/api/auth/customer-login', {
    method: 'POST',
    body: { phone: '123', password: '1234' },
  });
  check('手机号格式校验', weak.status === 400, weak.json?.message);

  const first = await api('/api/auth/customer-login', {
    method: 'POST',
    body: { phone: PHONE, password: 'pass1234' },
  });
  check('首次登录自动注册', first.status === 200 && first.json.created === true, first.json?.user?.role);
  const token = first.json.token;

  const wrongPwd = await api('/api/auth/customer-login', {
    method: 'POST',
    body: { phone: PHONE, password: 'other' },
  });
  check('密码不对被拒', wrongPwd.status === 401);

  const again = await api('/api/auth/customer-login', {
    method: 'POST',
    body: { phone: PHONE, password: 'pass1234' },
  });
  check('再次登录不会重复注册', again.status === 200 && again.json.created === false);

  console.log('— 菜单取菜 —');
  const menu = await api('/api/menu');
  const dishes = menu.json.categories.flatMap(c => c.dishes).filter(d => d.available);
  check('菜单里有可点菜品', dishes.length >= 2, `${dishes.length} 道`);
  const dishA = dishes[0];
  const dishB = dishes[1];

  console.log('— 下单 —');
  const noToken = await api('/api/orders', { method: 'POST', body: { items: [] } });
  check('未登录下单被拒', noToken.status === 401);

  const empty = await api('/api/orders', { method: 'POST', token, body: { items: [] } });
  check('空购物车被拒', empty.status === 400);

  const created = await api('/api/orders', {
    method: 'POST',
    token,
    body: { items: [{ dishId: dishA.id, qty: 2 }] },
  });
  const order = created.json?.order;
  check(
    '下单成功并生成 4 位订单号',
    created.status === 201 && /^\d{4}$/.test(order?.orderNo ?? ''),
    order?.orderNo,
  );
  check('金额按服务端价格算', order?.totalCents === dishA.priceCents * 2, `${order?.totalCents}`);

  const open = await api('/api/orders/open', { token });
  check('能查到未结算订单', open.json?.order?.id === order.id);

  console.log('— 加菜 —');
  const appended = await api('/api/orders', {
    method: 'POST',
    token,
    body: { items: [{ dishId: dishB.id, qty: 1 }] },
  });
  check('再次下单变成加菜（订单号不变）', appended.json?.order?.orderNo === order.orderNo && appended.json?.appended === true);
  check(
    '加菜后金额累加',
    appended.json?.order?.totalCents === order.totalCents + dishB.priceCents,
    `${appended.json?.order?.totalCents}`,
  );

  const viaItems = await api(`/api/orders/${order.id}/items`, {
    method: 'POST',
    token,
    body: { items: [{ dishId: dishA.id, qty: 1 }] },
  });
  check('订单页加菜接口可用', viaItems.status === 200);
  const mergedItem = viaItems.json.order.items.find(i => i.dishId === dishA.id);
  check('同菜品合并成一行', mergedItem?.quantity === 3, `qty=${mergedItem?.quantity}`);

  console.log('— 恢复与隔离 —');
  const relogin = await api('/api/auth/customer-login', {
    method: 'POST',
    body: { phone: PHONE, password: 'pass1234' },
  });
  const token2 = relogin.json.token;
  const restored = await api('/api/orders/open', { token: token2 });
  check('换个 token（重新登录）也能恢复未结算订单', restored.json?.order?.orderNo === order.orderNo);

  const other = await api('/api/auth/customer-login', {
    method: 'POST',
    body: { phone: '13800000000', password: 'admin123' },
  });
  const otherDetail = await api(`/api/orders/${order.id}`, { token: other.json.token });
  check('别人看不到这单', otherDetail.status === 403);

  const soldOutDish = await api('/api/orders', {
    method: 'POST',
    token,
    body: { items: [{ dishId: 999999, qty: 1 }] },
  });
  check('不存在的菜品被拒', soldOutDish.status === 400, soldOutDish.json?.message);

  console.log('— 订单号唯一性 —');
  const otherPhone = '137' + String(Date.now()).slice(-8);
  const otherLogin = await api('/api/auth/customer-login', {
    method: 'POST',
    body: { phone: otherPhone, password: 'pass1234' },
  });
  const otherOrder = await api('/api/orders', {
    method: 'POST',
    token: otherLogin.json.token,
    body: { items: [{ dishId: dishA.id, qty: 1 }] },
  });
  check(
    '两个顾客的未结算单号不重复',
    otherOrder.status === 201 && otherOrder.json?.order?.orderNo !== order.orderNo,
    `${order.orderNo} vs ${otherOrder.json?.order?.orderNo}`,
  );

  console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
  console.log(`（测试顾客 ${PHONE} 的未结算订单保留在库里，可在 M4 继续用来测结账）`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('测试异常', e);
  process.exit(1);
});
