// يولّد أيقونات PWA بصيغة PNG (ألوان صلبة + شكل بسيط) دون مكتبات خارجية.
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, bg, fg) {
  // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let col = bg;
      if (dist <= r) col = fg;
      // شريط أبيض في المنتصف (محاكاة شعار)
      const inside = dist <= r;
      const stripe = inside && Math.abs(dy) < size * 0.06;
      if (stripe) col = [255, 255, 255, 255];
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = col[0];
      raw[o + 1] = col[1];
      raw[o + 2] = col[2];
      raw[o + 3] = col[3];
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.resolve(__dirname, '..', 'public');
const bg = [15, 23, 42, 255]; // slate-900
const fg = [16, 185, 129, 255]; // emerald-500

fs.writeFileSync(path.join(outDir, 'pwa-192.png'), makePng(192, bg, fg));
fs.writeFileSync(path.join(outDir, 'pwa-512.png'), makePng(512, bg, fg));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), makePng(180, bg, fg));
console.log('icons generated');
