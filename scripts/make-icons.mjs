// Generates the PNG app icons (rounded blue square with a green "open" dot)
// without any image dependencies. Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BLUE = [0x3e, 0x8e, 0xde];
const GREEN = [0x1c, 0x9d, 0x55];
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Signed distance to a rounded rectangle centred at origin. */
function roundedRect(px, py, half, radius) {
  const qx = Math.abs(px) - half + radius;
  const qy = Math.abs(py) - half + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function icon(size, { padded }) {
  const c = size / 2;
  const half = padded ? size * 0.4 : c;
  const radius = padded ? size * 0.11 : size * 0.22;
  const ring = size * 0.24;
  const dot = size * 0.17;
  return png(size, (x, y) => {
    const px = x - c;
    const py = y - c;
    const dRect = roundedRect(px, py, half, radius);
    const aa = (d) => Math.min(1, Math.max(0, 0.5 - d));
    const rectA = aa(dRect);
    if (rectA <= 0) return [0, 0, 0, 0];
    const dist = Math.hypot(px, py);
    let color = BLUE;
    color = mix(color, WHITE, aa(dist - ring));
    color = mix(color, GREEN, aa(dist - dot));
    return [...color, Math.round(rectA * 255)];
  });
}

writeFileSync('public/icon-180.png', icon(180, { padded: false }));
writeFileSync('public/icon-192.png', icon(192, { padded: false }));
writeFileSync('public/icon-512.png', icon(512, { padded: false }));
console.log('icons written');
