// יוצר אייקוני PNG פשוטים (רקע טורקיז + מטבע לבן) בלי תלות בספריות חיצוניות
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function makePNG(size, cb) {
  const width = size, height = size;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter type 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = cb(x, y, width, height);
      const off = y * (width * 4 + 1) + 1 + x * 4;
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = a;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// CRC32 (PNG spec)
let crcTable = null;
function makeCrcTable() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  return table;
}
function crc32(buf) {
  if (!crcTable) crcTable = makeCrcTable();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF);
}

function draw(x, y, w, h) {
  const bg = [15, 118, 110, 255];       // teal
  const white = [255, 255, 255, 255];
  const cx = w / 2, cy = h / 2;
  const r = w * 0.44; // rounded-rect corner via radius test approximated as square (simpler, still looks like app icon)
  const cornerR = w * 0.22;

  // rounded square mask
  function inRoundedSquare(px, py) {
    const inset = w * 0.04;
    const left = inset, top = inset, right = w - inset, bottom = h - inset;
    const rad = cornerR;
    if (px < left + rad && py < top + rad) return dist(px, py, left + rad, top + rad) <= rad;
    if (px > right - rad && py < top + rad) return dist(px, py, right - rad, top + rad) <= rad;
    if (px < left + rad && py > bottom - rad) return dist(px, py, left + rad, bottom - rad) <= rad;
    if (px > right - rad && py > bottom - rad) return dist(px, py, right - rad, bottom - rad) <= rad;
    return px >= left && px <= right && py >= top && py <= bottom;
  }
  function dist(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2); }

  if (!inRoundedSquare(x, y)) return [0, 0, 0, 0];

  // coin circle in center
  const coinR = w * 0.22;
  const d = dist(x, y, cx, cy);
  if (d <= coinR) return white;
  if (d <= coinR + w * 0.02) return white; // ring edge same color, fine

  return bg;
}

const outDir = path.join(__dirname, '..', 'icons');
[192, 512].forEach(size => {
  const png = makePNG(size, draw);
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
  console.log('written icon-' + size + '.png');
});
