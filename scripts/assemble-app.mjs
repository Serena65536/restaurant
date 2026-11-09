// Assembles the React Native app directory from the community template package.
// The RN CLI could not be used directly: it shells out to `npm init -y` with
// piped stdio, which the Windows sandbox rejects (spawn EPERM). Doing the same
// work here keeps the result byte-for-byte predictable.
import fs from 'node:fs';
import path from 'node:path';

const TEMPLATE = 'D:\\restaurant\\.cache\\tpl\\package\\template';
const DEST = 'D:\\restaurant\\app';

const PROJECT_NAME = 'RestaurantApp';
const DISPLAY_NAME = '饭店点餐';
const BUNDLE_ID = 'com.restaurant.ordering';

const SKIP = new Set(['ios', 'Gemfile', '_bundle']);
const RENAME = {
  '_gitignore': '.gitignore',
  '_eslintrc.js': '.eslintrc.js',
  '_prettierrc.js': '.prettierrc.js',
  '_watchmanconfig': '.watchmanconfig',
};
const TEXT_EXT = new Set([
  '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.gradle', '.xml', '.kt', '.java',
  '.properties', '.md', '.txt', '.pro', '.yml', '.yaml', '.bat', '.sh',
]);

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, RENAME[entry.name] || entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function walk(dir, fn) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, fn);
    else fn(full);
  }
}

if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true, force: true });
}
copyTree(TEMPLATE, DEST);

// Move the Java/Kotlin package folder to match the new bundle id.
const oldPkgDir = path.join(DEST, 'android', 'app', 'src', 'main', 'java', 'com', 'helloworld');
const newPkgDir = path.join(DEST, 'android', 'app', 'src', 'main', 'java', 'com', 'restaurant', 'ordering');
if (fs.existsSync(oldPkgDir)) {
  fs.mkdirSync(path.dirname(newPkgDir), { recursive: true });
  fs.renameSync(oldPkgDir, newPkgDir);
  try { fs.rmdirSync(path.join(DEST, 'android', 'app', 'src', 'main', 'java', 'com', 'helloworld')); } catch {}
}

let touched = 0;
walk(DEST, (file) => {
  if (!TEXT_EXT.has(path.extname(file))) return;
  const before = fs.readFileSync(file, 'utf8');
  let after = before
    .replaceAll(BUNDLE_ID === 'com.restaurant.ordering' ? 'com.helloworld' : BUNDLE_ID, BUNDLE_ID)
    .replaceAll('HelloWorld', PROJECT_NAME);
  if (after !== before) {
    fs.writeFileSync(file, after);
    touched += 1;
  }
});

// Launcher label + display name (Chinese is fine here, files are UTF-8).
const appJsonPath = path.join(DEST, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
appJson.name = PROJECT_NAME;
appJson.displayName = DISPLAY_NAME;
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

const stringsPath = path.join(DEST, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
if (fs.existsSync(stringsPath)) {
  const xml = fs.readFileSync(stringsPath, 'utf8').replace(/>[^<]*<\/string>/, `>${DISPLAY_NAME}</string>`);
  fs.writeFileSync(stringsPath, xml);
}

// Point Gradle at the local SDK so builds do not depend on ANDROID_HOME being exported.
const localProps = path.join(DEST, 'android', 'local.properties');
fs.writeFileSync(localProps, 'sdk.dir=D:/restaurant/.toolchain/android-sdk\n');

console.log(`assembled ${DEST}; rewrote ${touched} files`);
