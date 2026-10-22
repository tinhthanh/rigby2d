// SPDX-License-Identifier: MIT OR Apache-2.0
// Writes layers.json (+ raw .rgba files) as a layered PSD, bottom layer first.
// Usage: node tools/art/topsd.mjs <layers.json> <out.psd>
import fs from 'node:fs';
import { writePsdBuffer } from 'ag-psd';
const [meta, out] = process.argv.slice(2);
const m = JSON.parse(fs.readFileSync(meta, 'utf8'));
const children = m.layers.map((L) => ({
  name: L.name, left: L.left, top: L.top, right: L.left + L.w, bottom: L.top + L.h,
  imageData: { width: L.w, height: L.h, data: new Uint8ClampedArray(fs.readFileSync(L.file.replace(/\.png$/, '.rgba'))) },
}));
fs.writeFileSync(out, writePsdBuffer({ width: m.width, height: m.height, children }, { noBackground: true }));
console.log('wrote', out, children.map((c) => c.name).join(', '));
