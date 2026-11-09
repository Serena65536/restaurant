// M2 冒烟测试：店主登录 → 分区/菜品 CRUD → 图片上传 → 顾客端菜单同步
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

async function api(path, { method = 'GET', token, body, form } = {}) {
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
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
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

// 1x1 透明 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function main() {
  console.log('— 鉴权 —');
  const bad = await api('/api/admin/categories');
  check('未登录访问管理接口被拒', bad.status === 401, `status=${bad.status}`);

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { phone: '13800000000', password: 'admin123' },
  });
  check('店主登录成功', login.status === 200 && !!login.json?.token, `role=${login.json?.user?.role}`);
  const token = login.json?.token;

  const wrong = await api('/api/auth/login', {
    method: 'POST',
    body: { phone: '13800000000', password: 'wrong' },
  });
  check('错误密码被拒', wrong.status === 401);

  console.log('— 任意手机号也能登录店主 —');
  const freePhone = '133' + String(Date.now()).slice(-8);
  const fresh = await api('/api/auth/login', {
    method: 'POST',
    body: { phone: freePhone, password: 'owner1234' },
  });
  check(
    '新手机号自动成为店主',
    fresh.status === 200 && fresh.json.created === true && fresh.json.user.role === 'owner',
    freePhone,
  );
  const freshAdmin = await api('/api/admin/summary', { token: fresh.json.token });
  check('新店主能访问管理接口', freshAdmin.status === 200);

  const reLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { phone: freePhone, password: 'owner1234' },
  });
  check('同一手机号再次登录不再新建账号', reLogin.status === 200 && reLogin.json.created === false);

  const badPwd = await api('/api/auth/login', {
    method: 'POST',
    body: { phone: freePhone, password: 'nope1234' },
  });
  check('已有账号密码不对仍然拒绝', badPwd.status === 401, badPwd.json?.message);

  const shortPwd = await api('/api/auth/login', {
    method: 'POST',
    body: { phone: '13300000000', password: '12' },
  });
  check('密码太短被拒', shortPwd.status === 400);

  console.log('— 分区 —');
  const before = await api('/api/admin/categories', { token });
  check('读取分区列表', before.status === 200 && before.json.categories.length >= 4, `${before.json?.categories?.length} 个`);

  const created = await api('/api/admin/categories', {
    method: 'POST',
    token,
    body: { name: '冒烟测试区' },
  });
  check('新增分区', created.status === 201, `id=${created.json?.category?.id}`);
  const categoryId = created.json?.category?.id;

  const renamed = await api(`/api/admin/categories/${categoryId}`, {
    method: 'PATCH',
    token,
    body: { name: '冒烟测试区(改)' },
  });
  check('重命名分区', renamed.status === 200);

  console.log('— 菜品 —');
  const dish = await api('/api/admin/dishes', {
    method: 'POST',
    token,
    body: { categoryId, name: '冒烟测试菜', priceCents: 1999, description: '测试用' },
  });
  check('新增菜品', dish.status === 201, `id=${dish.json?.dish?.id}`);
  const dishId = dish.json?.dish?.id;

  const badPrice = await api('/api/admin/dishes', {
    method: 'POST',
    token,
    body: { categoryId, name: '价格非法', priceCents: -5 },
  });
  check('非法价格被拒', badPrice.status === 400);

  console.log('— 图片上传 —');
  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'test.png');
  const up = await api('/api/admin/upload', { method: 'POST', token, form });
  check('上传图片', up.status === 201 && String(up.json?.url).startsWith('/uploads/'), up.json?.url);
  const imageUrl = up.json?.url;

  const imgRes = await fetch(`${BASE}${imageUrl}`);
  check('上传后能访问图片', imgRes.ok, `status=${imgRes.status}`);

  const patched = await api(`/api/admin/dishes/${dishId}`, {
    method: 'PATCH',
    token,
    body: { image: imageUrl, priceCents: 2599, soldOut: true },
  });
  check('改价 / 挂图 / 售罄', patched.status === 200);

  console.log('— 顾客端同步 —');
  const menu1 = await api('/api/menu');
  const cat1 = menu1.json.categories.find((c) => c.id === categoryId);
  const d1 = cat1?.dishes?.[0];
  check('新分区出现在顾客菜单', !!cat1, cat1?.name);
  check('菜品价格已更新', d1?.priceCents === 2599, `${d1?.priceCents}`);
  check('售罄状态同步', d1?.available === false);
  check('图片地址同步', d1?.image === imageUrl, d1?.image);

  const hidden = await api(`/api/admin/categories/${categoryId}`, {
    method: 'PATCH',
    token,
    body: { visible: false },
  });
  const menu2 = await api('/api/menu');
  check(
    '隐藏分区后顾客端看不到',
    hidden.status === 200 && !menu2.json.categories.some((c) => c.id === categoryId),
  );

  console.log('— 清理 —');
  const delBlocked = await api(`/api/admin/categories/${categoryId}`, { method: 'DELETE', token });
  check('分区有菜时拒绝删除', delBlocked.status === 409, delBlocked.json?.message);

  const delDish = await api(`/api/admin/dishes/${dishId}`, { method: 'DELETE', token });
  check('删除菜品', delDish.status === 200);
  const delCat = await api(`/api/admin/categories/${categoryId}`, { method: 'DELETE', token });
  check('删除空分区', delCat.status === 200);

  console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('测试异常', e);
  process.exit(1);
});
