import fs from 'node:fs';
import path from 'node:path';

// RN 的 SafeAreaView 在 Android 上是空实现，targetSdk 35 又强制边到边，
// 顶部内容会顶到状态栏。统一换成 react-native-safe-area-context 的版本。
const files = [
  'AdminHomeScreen.tsx',
  'DishEditScreen.tsx',
  'DishListScreen.tsx',
  'MenuScreen.tsx',
  'OwnerLoginScreen.tsx',
];

const dir = 'D:\\restaurant\\app\\src\\screens';
const IMPORT_LINE = "import {SafeAreaView} from 'react-native-safe-area-context';\n";

for (const name of files) {
  const file = path.join(dir, name);
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes("from 'react-native-safe-area-context'")) {
    console.log(`${name}: already migrated`);
    continue;
  }

  // 1) 从 react-native 的具名导入里去掉 SafeAreaView
  src = src.replace(/(\n\s*)SafeAreaView,(\s*\n)/, '$1$2');

  // 2) 在 react-native 导入块结束后追加新导入
  const marker = "} from 'react-native';\n";
  const idx = src.indexOf(marker);
  if (idx === -1) {
    console.log(`${name}: could not find react-native import`);
    continue;
  }
  const insertAt = idx + marker.length;
  src = src.slice(0, insertAt) + IMPORT_LINE + src.slice(insertAt);

  fs.writeFileSync(file, src);
  console.log(`${name}: migrated`);
}
