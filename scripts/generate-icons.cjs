// يولّد أيقونات PWA بصيغة PNG مطابقة لشعار التطبيق (فقاعة محادثة خضراء)
// دون مكتبات خارجية. التصميم: خلفية emerald كاملة + فقاعة بيضاء + خطان داخليان.
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

// ألوان الهوية (RGBA)
const EMERALD = [16, 185, 129, 255]; // #10b981 emerald-500
const WHITE = [255, 255, 255, 255];

// مضلّع فقاعة المحادثة (مقتبس من مسار Logo.tsx ومُسطّح إلى نقاط)
// viewBox الأصلي 64x64، نحوّله إلى إحداثيات نسبية (0..1) ثم نُكبّره.
const BUBBLE_POINTS = (function () {
  // المسار: M32 12 c-11 0-20 7.5-20 16.7 c0 4.7 2.3 9 6 12.1 L16 52 l11.4-3.2
  //          c1.5.4 3 .6 4.6.6 c11 0 20-7.5 20-16.7 S43 12 32 12z
  // تحليل المنحنيات إلى نقاط (تقريب بسيط كافٍ للأيقونة)
  const pts = [];
  const steps = 12;
  // نقطة البداية
  let cur = [32, 12];
  pts.push([...cur]);
  // c-11 0-20 7.5-20 16.7  (منحنى بيزير مكعب من (32,12) إلى (12,28.7))
  cubic(pts, 32, 12, 32 - 11, 12, 32 - 20, 12 + 7.5, 32 - 20, 12 + 16.7, steps);
  cur = [12, 28.7];
  // c0 4.7 2.3 9 6 12.1  (من (12,28.7) إلى (18,40.8))
  cubic(pts, 12, 28.7, 12, 28.7 + 4.7, 12 + 2.3, 28.7 + 9, 12 + 6, 28.7 + 12.1, steps);
  cur = [18, 40.8];
  // L16 52  (خط مستقيم — ذيل الفقاعة)
  pts.push([16, 52]);
  // l11.4-3.2  (خط مستقيم)
  pts.push([16 + 11.4, 52 - 3.2]);
  cur = [27.4, 48.8];
  // c1.5.4 3 .6 4.6.6  (من (27.4,48.8) إلى (32,49.4))
  cubic(pts, 27.4, 48.8, 27.4 + 1.5, 48.8 + 0.4, 27.4 + 3, 48.8 + 0.6, 27.4 + 4.6, 48.8 + 0.6, steps);
  cur = [32, 49.4];
  // c11 0 20-7.5 20-16.7  (من (32,49.4) إلى (52,32.7))
  cubic(pts, 32, 49.4, 32 + 11, 49.4, 32 + 20, 49.4 - 7.5, 32 + 20, 49.4 - 16.7, steps);
  cur = [52, 32.7];
  // S43 12 32 12  (منحنى بيزير ناعم من (52,32.7) إلى (32,12))
  // نقطة تحكم منعكسة: 2*P3_prev - P2_prev = 2*(52,32.7) - (52,41.9) = (52, 23.5)
  cubic(pts, 52, 32.7, 52, 23.5, 43, 12, 32, 12, steps);
  return pts.map(([x, y]) => [x / 64, y / 64]);
})();

function cubic(out, x0, y0, x1, y1, x2, y2, x3, y3, steps) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
    const y = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
    out.push([x, y]);
  }
}

// اختبار نقطة داخل مضلّع (ray casting)
function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// مضلّع مستطيل مدوّر (للخطوط الداخلية نستخدم مستطيلات بسيطة)
function rectPoly(x0, y0, x1, y1, r) {
  const pts = [];
  const steps = 6;
  // زاوية علوية يسار
  arc(pts, x0 + r, y0 + r, r, Math.PI, 1.5 * Math.PI, steps);
  // زاوية علوية يمين
  arc(pts, x1 - r, y0 + r, r, 1.5 * Math.PI, 2 * Math.PI, steps);
  // زاوية سفلية يمين
  arc(pts, x1 - r, y1 - r, r, 0, 0.5 * Math.PI, steps);
  // زاوية سفلية يسار
  arc(pts, x0 + r, y1 - r, r, 0.5 * Math.PI, Math.PI, steps);
  return pts;
}

function arc(out, cx, cy, r, a0, a1, steps) {
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
}

function makePng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  // تكبير الفقاعة لتملأ ~70% من الأيقونة (داخل منطقة الأمان maskable 80%)
  const scale = size * 0.72;
  const offsetX = (size - scale) / 2;
  const offsetY = (size - scale) / 2;
  const bubble = BUBBLE_POINTS.map(([x, y]) => [offsetX + x * scale, offsetY + y * scale]);

  // الخطان الداخليان (emerald) — نسبيًا لـ 64x64 ثم نُكبّر
  const lineScale = scale / 64;
  const lineThickness = 3.5 * lineScale;
  const line1 = rectPoly(
    offsetX + 24 * lineScale,
    offsetY + 28 * lineScale - lineThickness / 2,
    offsetX + 40 * lineScale,
    offsetY + 28 * lineScale + lineThickness / 2,
    lineThickness / 2,
  );
  const line2 = rectPoly(
    offsetX + 24 * lineScale,
    offsetY + 34 * lineScale - lineThickness / 2,
    offsetX + 36 * lineScale,
    offsetY + 34 * lineScale + lineThickness / 2,
    lineThickness / 2,
  );

  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    for (let x = 0; x < size; x++) {
      let col = EMERALD; // الخلفية: emerald كاملة (maskable-safe)
      if (pointInPolygon(x + 0.5, y + 0.5, bubble)) {
        col = WHITE; // الفقاعة: بيضاء
        // الخطوط الداخلية: emerald (تظهر كـ "نص" داخل الفقاعة)
        if (pointInPolygon(x + 0.5, y + 0.5, line1) || pointInPolygon(x + 0.5, y + 0.5, line2)) {
          col = EMERALD;
        }
      }
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
fs.writeFileSync(path.join(outDir, 'pwa-192.png'), makePng(192));
fs.writeFileSync(path.join(outDir, 'pwa-512.png'), makePng(512));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), makePng(180));
console.log('icons generated: pwa-192.png, pwa-512.png, apple-touch-icon.png');
