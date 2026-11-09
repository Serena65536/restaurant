import { db, migrate, isEmpty } from './db.mjs';
import { seed } from './seed.mjs';
import { createApp } from './app.mjs';

const PORT = Number(process.env.PORT || 8080);
// 监听所有网卡：同一 WiFi 的手机可以直接用 http://电脑IP:8080，
// 比走 Cloudflare 隧道快得多（隧道从本机绕到海外边缘，实测只有十几 KB/s）。
// 外网访问仍然走 Cloudflare Tunnel。
const HOST = process.env.HOST || '0.0.0.0';

migrate();
const hadData = !isEmpty();
seed();
if (!hadData) console.log('数据库为空，已自动写入示例数据');

const app = createApp();
const server = app.listen(PORT, HOST, () => {
  console.log(`restaurant-server 已启动: http://${HOST}:${PORT}`);
  console.log(`健康检查: http://${HOST}:${PORT}/api/health`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n收到 ${sig}，正在关闭...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
