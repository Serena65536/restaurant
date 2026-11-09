import fs from 'node:fs';
import path from 'node:path';

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node download-file.mjs <url> <outfile>');
  process.exit(2);
}

fs.mkdirSync(path.dirname(out), { recursive: true });

const started = Date.now();
const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) {
  console.error(`HTTP ${res.status} for ${url}`);
  process.exit(3);
}
const total = Number(res.headers.get('content-length') || 0);
const fh = fs.createWriteStream(out);
let bytes = 0;
let lastLog = 0;

for await (const chunk of res.body) {
  fh.write(chunk);
  bytes += chunk.length;
  const now = Date.now();
  if (now - lastLog > 3000) {
    lastLog = now;
    const secs = (now - started) / 1000;
    const pct = total ? ((bytes / total) * 100).toFixed(1) + '%' : '?';
    console.log(`${(bytes / 1048576).toFixed(1)}MB / ${(total / 1048576).toFixed(1)}MB ${pct} ${(bytes / 1024 / secs).toFixed(0)}KB/s`);
  }
}
await new Promise((r) => fh.end(r));

const secs = (Date.now() - started) / 1000;
console.log(`DONE ${out} ${(bytes / 1048576).toFixed(1)}MB in ${secs.toFixed(1)}s (${(bytes / 1024 / secs).toFixed(0)}KB/s)`);
