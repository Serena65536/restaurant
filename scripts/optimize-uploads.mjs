// 把已经上传的大图（手机直传的 1-3MB 原图）就地压成 900px 的 JPEG，
// 并把 dishes.image 里指向旧文件的记录改成新文件名。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

// 脚本放在 scripts/ 下，sharp 装在 server/ 里，所以按 server 的位置解析
const require = createRequire('D:\\restaurant\\server\\package.json');
const sharp = require('sharp');

const ROOT = 'D:\\restaurant\\server';
const UPLOAD_DIR = path.join(ROOT, 'data', 'uploads');
const DB_FILE = path.join(ROOT, 'data', 'app.db');

const db = new DatabaseSync(DB_FILE);
const files = fs.readdirSync(UPLOAD_DIR).filter((f) => /\.(png|jpe?g|webp|heic)$/i.test(f));

let changed = 0;
let savedBytes = 0;

for (const name of files) {
  const full = path.join(UPLOAD_DIR, name);
  const before = fs.statSync(full).size;
  if (before < 200 * 1024) {
    continue; // 已经够小
  }

  const jpegName = name.replace(/\.[^.]+$/, '') + '.jpg';
  const jpegPath = path.join(UPLOAD_DIR, jpegName);

  try {
    await sharp(full)
      .rotate()
      .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(jpegPath);

    const after = fs.statSync(jpegPath).size;
    if (after >= before) {
      fs.unlinkSync(jpegPath);
      continue;
    }
    if (jpegName !== name) {
      fs.unlinkSync(full);
    }

    // 把数据库里引用旧文件名的记录改成新名字
    const oldUrl = `/uploads/${name}`;
    const newUrl = `/uploads/${jpegName}`;
    const info = db.prepare('UPDATE dishes SET image = ? WHERE image = ?').run(newUrl, oldUrl);
    const info2 = db.prepare('UPDATE order_items SET image_snapshot = ? WHERE image_snapshot = ?').run(newUrl, oldUrl);

    changed += 1;
    savedBytes += before - after;
    console.log(
      `${name} ${(before / 1024).toFixed(0)}KB -> ${jpegName} ${(after / 1024).toFixed(0)}KB` +
        `（菜品 ${info.changes} 条，历史订单快照 ${info2.changes} 条）`,
    );
  } catch (err) {
    console.log(`${name} 处理失败：${err.message}`);
  }
}

console.log(`\n处理 ${changed} 张，共省下 ${(savedBytes / 1024 / 1024).toFixed(2)} MB`);
