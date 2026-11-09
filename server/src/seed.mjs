import { db, migrate, isEmpty } from './db.mjs';
import { hashPassword } from './auth.mjs';

const OWNER_PHONE = process.env.OWNER_PHONE || '13800000000';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'admin123';

const CATEGORIES = [
  { name: '热菜', dishes: [
    { name: '宫保鸡丁', price: 3800, desc: '鸡腿肉、花生米、干辣椒' },
    { name: '红烧肉', price: 4800, desc: '五花肉慢炖两小时' },
    { name: '清蒸鲈鱼', price: 6800, desc: '现杀鲈鱼，葱姜蒸' },
  ]},
  { name: '凉菜', dishes: [
    { name: '拍黄瓜', price: 1200, desc: '蒜香清爽' },
    { name: '口水鸡', price: 2800, desc: '麻辣鲜香' },
  ]},
  { name: '主食', dishes: [
    { name: '米饭', price: 300, desc: '一碗' },
    { name: '蛋炒饭', price: 1800, desc: '粒粒分明' },
  ]},
  { name: '饮料', dishes: [
    { name: '冰镇酸梅汤', price: 800, desc: '自制，解腻' },
    { name: '可乐', price: 500, desc: '冰的' },
  ]},
];

export function seed() {
  migrate();

  const ownerPhone = OWNER_PHONE;
  const existingOwner = db.prepare('SELECT id FROM users WHERE phone = ?').get(ownerPhone);
  if (!existingOwner) {
    db.prepare('INSERT INTO users (phone, password_hash, role, name) VALUES (?, ?, ?, ?)')
      .run(ownerPhone, hashPassword(OWNER_PASSWORD), 'owner', '店主');
  }

  if (!isEmpty()) {
    console.log('示例数据已存在，跳过菜品初始化');
    return { seeded: false };
  }

  const insertCat = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
  const insertDish = db.prepare(
    'INSERT INTO dishes (category_id, name, price_cents, description, sort_order) VALUES (?, ?, ?, ?, ?)'
  );

  CATEGORIES.forEach((cat, ci) => {
    const catId = Number(insertCat.run(cat.name, ci).lastInsertRowid);
    cat.dishes.forEach((d, di) => {
      insertDish.run(catId, d.name, d.price, d.desc, di);
    });
  });

  console.log(`已写入示例数据：${CATEGORIES.length} 个分区，${CATEGORIES.reduce((n, c) => n + c.dishes.length, 0)} 道菜`);
  return { seeded: true };
}

if (import.meta.filename === process.argv[1]) {
  seed();
  console.log(`店主账号：${OWNER_PHONE} / ${OWNER_PASSWORD}`);
}
