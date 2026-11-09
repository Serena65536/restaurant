import QRCode from 'qrcode';

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node qr.mjs <url> <out.png>');
  process.exit(2);
}

await QRCode.toFile(out, url, { width: 720, margin: 2, errorCorrectionLevel: 'M' });
console.log(`QR -> ${out}`);
