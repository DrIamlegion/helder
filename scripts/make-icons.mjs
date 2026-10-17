// Helder — boekhouden zonder ruis
// Copyright (C) 2026 Helder-auteurs
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dit bestand is vrije software: je mag het verspreiden en/of aanpassen onder de
// voorwaarden van de GNU Affero General Public License, versie 3. Zie LICENSE.

// Iconen voor de installeerbare app. Geen beeldbibliotheek nodig: we tekenen de
// vorm zelf en schrijven de PNG-bytes met zlib. Opnieuw genereren: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "public", "icons");
const BUILD_DIR = resolve(ROOT, "build");
const BRAND = [14, 143, 104];
const WHITE = [255, 255, 255];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (let index = 0; index < buffer.length; index++) {
    c = CRC_TABLE[(c ^ buffer[index]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bitdiepte
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Afstand tot een afgeronde rechthoek: negatief binnen, positief buiten.
function roundedRectDistance(x, y, { x0, y0, x1, y1, r }) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return Math.hypot(x - cx, y - cy) - r;
}

function insideRounded(x, y, rect) {
  return roundedRectDistance(x, y, rect) <= 0;
}

// De H van Helder: twee staanders met een dwarsbalk, alle drie als capsules.
function letterH(scale = 1, offset = 0.5) {
  const spread = 0.165 * scale;
  const bar = 0.105 * scale;
  const top = offset - 0.215 * scale;
  const bottom = offset + 0.215 * scale;
  const half = bar / 2;
  return [
    { x0: offset - spread - half, y0: top, x1: offset - spread + half, y1: bottom, r: half },
    { x0: offset + spread - half, y0: top, x1: offset + spread + half, y1: bottom, r: half },
    { x0: offset - spread - half, y0: offset - half, x1: offset + spread + half, y1: offset + half, r: half },
  ];
}

function render(size, { maskable }) {
  const samples = 5; // supersampling tegen kartelranden
  const step = 1 / (size * samples);
  const background = maskable
    ? { x0: 0, y0: 0, x1: 1, y1: 1, r: 0 }
    : { x0: 0.02, y0: 0.02, x1: 0.98, y1: 0.98, r: 0.22 };
  // Maskable iconen moeten binnen de veilige zone blijven.
  const mark = letterH(maskable ? 0.82 : 1.2);
  const rgba = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgHits = 0;
      let markHits = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (px * samples + sx + 0.5) * step;
          const y = (py * samples + sy + 0.5) * step;
          if (insideRounded(x, y, background)) bgHits++;
          if (mark.some((capsule) => insideRounded(x, y, capsule))) markHits++;
        }
      }
      const total = samples * samples;
      const bgAlpha = bgHits / total;
      // De H ligt binnen de achtergrond: zijn dekking is een deelverzameling daarvan.
      const mix = bgAlpha > 0 ? Math.min(1, markHits / bgHits) : 0;
      const offset = (py * size + px) * 4;
      for (let channel = 0; channel < 3; channel++) {
        rgba[offset + channel] = Math.round(BRAND[channel] * (1 - mix) + WHITE[channel] * mix);
      }
      rgba[offset + 3] = Math.round(bgAlpha * 255);
    }
  }
  return encodePng(size, size, rgba);
}

// Windows-installatie vraagt om een .ico; we stoppen er PNG's in (Vista en later lezen die).
function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;
  images.forEach(({ size, data }, index) => {
    const entry = index * 16;
    directory[entry] = size >= 256 ? 0 : size;
    directory[entry + 1] = size >= 256 ? 0 : size;
    directory.writeUInt16LE(1, entry + 4); // kleurvlakken
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, directory, ...images.map((image) => image.data)]);
}

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(BUILD_DIR, { recursive: true });
const files = [
  ["icon-192.png", render(192, { maskable: false })],
  ["icon-512.png", render(512, { maskable: false })],
  ["icon-maskable-512.png", render(512, { maskable: true })],
  ["apple-touch-icon-180.png", render(180, { maskable: true })],
];
for (const [name, bytes] of files) {
  writeFileSync(resolve(OUT_DIR, name), bytes);
  console.log(`${name} — ${bytes.length} bytes`);
}

const ico = encodeIco(
  [16, 24, 32, 48, 64, 128, 256].map((size) => ({
    size,
    data: render(size, { maskable: false }),
  }))
);
writeFileSync(resolve(BUILD_DIR, "icon.ico"), ico);
console.log(`build/icon.ico — ${ico.length} bytes`);
