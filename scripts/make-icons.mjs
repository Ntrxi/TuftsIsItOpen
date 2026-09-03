// Generates the PNG app icons (paper tile with the brick elephant mark)
// without any image dependencies. Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const PAPER = [0xf5, 0xef, 0xe3];
const BRICK = [0xb9, 0x51, 0x2b];

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
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
    raw[y * (size * 4 + 1)] = 0;
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
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function roundedRect(px, py, half, radius) {
  const qx = Math.abs(px) - half + radius;
  const qy = Math.abs(py) - half + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const aa = (d) => Math.min(1, Math.max(0, 0.5 - d));

/** Sample a cubic bezier into points (in the 64-unit mark space). */
function cubic(p0, p1, p2, p3, n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return pts;
}

// Trunk path from the SVG mark: M43 36 c5 6 6 14 2 20 c-3 4 -9 3 -9 -2 c0 -3 3 -4 3 -8
const trunk = [
  ...cubic([43, 36], [48, 42], [49, 50], [45, 56]),
  ...cubic([45, 56], [42, 60], [36, 59], [36, 54]),
  ...cubic([36, 54], [36, 51], [39, 50], [39, 46]),
];
// Ear: M12 26 c-6 -1 -10 4 -8 10 s8 8 12 5  (approximate as a blob of sampled points)
const ear = [...cubic([12, 26], [6, 25], [2, 30], [4, 36]), ...cubic([4, 36], [6, 42], [12, 44], [16, 41])];

function distToPolyline(px, py, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

function icon(size) {
  const c = size / 2;
  const scale = size / 64;
  return png(size, (x, y) => {
    const tileA = aa(roundedRect(x - c, y - c, c, size * 0.16));
    if (tileA <= 0) return [0, 0, 0, 0];
    const mx = x / scale;
    const my = y / scale;
    let color = PAPER;
    // head
    let ink = aa((Math.hypot(mx - 30, my - 27) - 19) * scale);
    // ear (filled blob: within 6 units of the ear curve, or inside its hull near the head)
    ink = Math.max(ink, aa((distToPolyline(mx, my, ear) - 5.5) * scale));
    // trunk (stroke width 7 -> radius 3.5)
    ink = Math.max(ink, aa((distToPolyline(mx, my, trunk) - 3.5) * scale));
    color = mix(color, BRICK, ink);
    // eye
    color = mix(color, PAPER, aa((Math.hypot(mx - 36, my - 22) - 3) * scale));
    return [...color, Math.round(tileA * 255)];
  });
}

writeFileSync('public/icon-180.png', icon(180));
writeFileSync('public/icon-192.png', icon(192));
writeFileSync('public/icon-512.png', icon(512));
console.log('icons written');
