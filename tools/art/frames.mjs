// SPDX-License-Identifier: MIT OR Apache-2.0
// Dumps region and mesh quads (world space, Y up) per frame. Usage: node frames.mjs <file> <anim> <fps>
import { loadProject } from '../../src/mcp/tools.js';
import { poseAt } from '../../src/core/keying.js';
const [file, name, fps] = process.argv.slice(2);
const p = await loadProject(file);
const anim = p.doc.animations.find((a) => a.name === name);
const frames = [];
for (let i = 0; i < Math.round(anim.duration * fps); i++) {
  const quads = poseAt(p.doc, anim, i / fps).quads(p.doc);
  frames.push(quads.map((q) => ({ image: q.image, kind: q.kind, pos: q.positions, uvs: q.uvs, tris: q.triangles ? Array.from(q.triangles) : null })));
}
console.log(JSON.stringify(frames));
