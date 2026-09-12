// Generates the original WordSetu app icon assets from code, with no external
// image libraries. Node's built in zlib is used to deflate PNG image data.
//
// Output:
//   build/icon.png  - 512x512 PNG (Linux icon and canonical source mark)
//   build/icon.ico  - Windows multi size ICO (16,24,32,48,64,128,256)
//
// The mark is an ORIGINAL design: a rounded square tile filled with a diagonal
// indigo to teal gradient, carrying a geometric "W" (for WordSetu) drawn as two
// joined V strokes plus a small "bridge" bar beneath it (setu means bridge in
// Bangla, tying the name to the glyph). Nothing here is copied from any existing
// logo or font.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'build');

// ---- small vector/raster helpers -----------------------------------------

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Create an RGBA pixel buffer for a size x size square, painting the WordSetu
// mark procedurally. Returns a Buffer of length size*size*4.
function renderMark(size) {
  const buf = Buffer.alloc(size * size * 4, 0);
  const s = size;

  // Gradient endpoints (indigo -> teal), an original WordSetu palette.
  const c0 = { r: 0x4f, g: 0x46, b: 0xe5 }; // indigo
  const c1 = { r: 0x0d, g: 0x94, b: 0x88 }; // teal

  // Rounded square parameters.
  const radius = s * 0.22;
  const margin = s * 0.06;

  // Geometry for the "W" strokes, expressed in normalized [0,1] coordinates
  // then scaled. Two V shapes side by side.
  const strokeW = s * 0.11;
  const top = s * 0.30;
  const bottom = s * 0.66;
  const xs = [0.24, 0.38, 0.5, 0.62, 0.76].map((n) => n * s);
  // Peaks/valleys: outer tops, mid top, inner valleys.
  const wPoints = [
    { x: xs[0], y: top },
    { x: xs[1], y: bottom },
    { x: xs[2], y: top + (bottom - top) * 0.42 },
    { x: xs[3], y: bottom },
    { x: xs[4], y: top },
  ];

  // Bridge bar beneath the W (the "setu").
  const bridgeY = s * 0.74;
  const bridgeX0 = xs[0];
  const bridgeX1 = xs[4];
  const bridgeH = s * 0.055;

  const insideRounded = (x, y) => {
    const minX = margin;
    const minY = margin;
    const maxX = s - margin;
    const maxY = s - margin;
    if (x < minX || y < minY || x > maxX || y > maxY) return false;
    // Corner rounding.
    const rx = radius;
    const corners = [
      { cx: minX + rx, cy: minY + rx, qx: x < minX + rx, qy: y < minY + rx },
      { cx: maxX - rx, cy: minY + rx, qx: x > maxX - rx, qy: y < minY + rx },
      { cx: minX + rx, cy: maxY - rx, qx: x < minX + rx, qy: y > maxY - rx },
      { cx: maxX - rx, cy: maxY - rx, qx: x > maxX - rx, qy: y > maxY - rx },
    ];
    for (const c of corners) {
      if (c.qx && c.qy) {
        const dx = x - c.cx;
        const dy = y - c.cy;
        if (dx * dx + dy * dy > rx * rx) return false;
      }
    }
    return true;
  };

  // Distance from point to a line segment, for stroke drawing.
  const distToSeg = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = clamp(t, 0, 1);
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
  };

  const onW = (x, y) => {
    const half = strokeW / 2;
    for (let i = 0; i < wPoints.length - 1; i++) {
      const a = wPoints[i];
      const b = wPoints[i + 1];
      if (distToSeg(x, y, a.x, a.y, b.x, b.y) <= half) return true;
    }
    return false;
  };

  const onBridge = (x, y) =>
    x >= bridgeX0 && x <= bridgeX1 && y >= bridgeY && y <= bridgeY + bridgeH;

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const idx = (y * s + x) * 4;
      if (!insideRounded(x, y)) {
        // Transparent outside the tile.
        continue;
      }
      // Diagonal gradient fill.
      const t = clamp((x + y) / (2 * s), 0, 1);
      let r = lerp(c0.r, c1.r, t);
      let g = lerp(c0.g, c1.g, t);
      let b = lerp(c0.b, c1.b, t);

      // Foreground glyph (white with slight softness) for the W and bridge.
      if (onW(x, y) || onBridge(x, y)) {
        r = 0xff;
        g = 0xff;
        b = 0xff;
      }

      buf[idx] = Math.round(r);
      buf[idx + 1] = Math.round(g);
      buf[idx + 2] = Math.round(b);
      buf[idx + 3] = 0xff;
    }
  }
  return buf;
}

// ---- PNG encoder ----------------------------------------------------------

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Encode an RGBA pixel buffer (size x size) to a PNG Buffer.
function encodePng(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Add a filter byte (0 = none) at the start of each scanline.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- ICO encoder (embeds PNG images, valid for Vista+ / Windows 11) --------

function encodeIco(pngEntries) {
  // pngEntries: [{ size, buffer }]
  const count = pngEntries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  const images = [];
  let offset = 6 + count * 16;

  for (const entry of pngEntries) {
    const dir = Buffer.alloc(16);
    dir[0] = entry.size >= 256 ? 0 : entry.size; // width (0 means 256)
    dir[1] = entry.size >= 256 ? 0 : entry.size; // height
    dir[2] = 0; // palette
    dir[3] = 0; // reserved
    dir.writeUInt16LE(1, 4); // color planes
    dir.writeUInt16LE(32, 6); // bits per pixel
    dir.writeUInt32LE(entry.buffer.length, 8); // size of image data
    dir.writeUInt32LE(offset, 12); // offset
    dirEntries.push(dir);
    images.push(entry.buffer);
    offset += entry.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...images]);
}

// ---- main ------------------------------------------------------------------

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  // Canonical 512 source PNG.
  const master = renderMark(512);
  const masterPng = encodePng(master, 512);
  fs.writeFileSync(path.join(outDir, 'icon.png'), masterPng);
  console.log(`wrote build/icon.png (512x512, ${masterPng.length} bytes)`);

  // Multi size ICO.
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const entries = icoSizes.map((size) => ({
    size,
    buffer: encodePng(renderMark(size), size),
  }));
  const ico = encodeIco(entries);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);
  console.log(`wrote build/icon.ico (sizes ${icoSizes.join(',')}, ${ico.length} bytes)`);
}

main();
