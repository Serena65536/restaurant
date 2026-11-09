// 延迟基准：本地 vs 公网隧道，普通请求 vs 图片上传
const LOCAL = 'http://127.0.0.1:8080';
const PUBLIC = process.env.PUBLIC || 'https://childhood-passengers-romance-stage.trycloudflare.com';

async function timeIt(label, fn) {
  const started = Date.now();
  let ok = false;
  try {
    ok = await fn();
  } catch (e) {
    console.log(`${label.padEnd(34)} FAIL ${e.message}`);
    return;
  }
  console.log(`${label.padEnd(34)} ${Date.now() - started}ms ${ok ? '' : '(!)'}`);
}

async function get(base, path) {
  const res = await fetch(base + path);
  await res.text();
  return res.ok;
}

async function main() {
  console.log('— 本地 —');
  for (let i = 0; i < 3; i += 1) {
    await timeIt(`GET /api/health #${i + 1}`, () => get(LOCAL, '/api/health'));
  }
  await timeIt('GET /api/menu', () => get(LOCAL, '/api/menu'));
  await timeIt('GET /api/admin/categories (无 token)', () => get(LOCAL, '/api/admin/categories'));

  console.log('\n— 公网隧道 —');
  for (let i = 0; i < 3; i += 1) {
    await timeIt(`GET /api/health #${i + 1}`, () => get(PUBLIC, '/api/health'));
  }
  await timeIt('GET /api/menu', () => get(PUBLIC, '/api/menu'));

  console.log('\n— 登录后接口（公网）—');
  let token = '';
  await timeIt('POST /api/auth/login', async () => {
    const res = await fetch(PUBLIC + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '13800000000', password: 'admin123' }),
    });
    const json = await res.json();
    token = json.token;
    return res.ok;
  });
  await timeIt('GET /api/admin/summary', async () => {
    const res = await fetch(PUBLIC + '/api/admin/summary', { headers: { authorization: `Bearer ${token}` } });
    await res.text();
    return res.ok;
  });

  console.log('\n— 图片上传 —');
  for (const sizeKb of [50, 200, 500]) {
    const bytes = Buffer.alloc(sizeKb * 1024);
    // 造一个能过 MIME 检查的“图片”头
    Buffer.from([0x89, 0x50, 0x4e, 0x47]).copy(bytes, 0);
    for (const base of [LOCAL, PUBLIC]) {
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: 'image/png' }), 'bench.png');
      await timeIt(
        `upload ${sizeKb}KB -> ${base === LOCAL ? '本机' : '隧道'}`,
        async () => {
          const res = await fetch(base + '/api/admin/upload', {
            method: 'POST',
            headers: { authorization: `Bearer ${token}` },
            body: form,
          });
          await res.text();
          return res.ok;
        },
      );
    }
  }

  console.log('\n— 图片下载 —');
  const menu = await (await fetch(PUBLIC + '/api/menu')).json();
  const withImage = menu.categories.flatMap(c => c.dishes).find(d => d.image);
  if (withImage) {
    await timeIt('下载菜品图（隧道）', async () => {
      const res = await fetch(PUBLIC + withImage.image);
      const buf = await res.arrayBuffer();
      console.log(`   图片大小 ${(buf.byteLength / 1024).toFixed(0)} KB`);
      return res.ok;
    });
  } else {
    console.log('   菜单里还没有带图的菜');
  }
}

main().catch(e => console.error(e));
