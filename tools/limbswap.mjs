// SPDX-License-Identifier: MIT OR Apache-2.0
// Pose drawings for a limb: replaces a limb's single bending picture with several drawings of it
// (e.g. an arm swung forward with the elbow bent, hanging, swung back) on its upper bone. Each
// drawing is turned so its drawn limb lines up with the bone, so the bone can rotate continuously
// and an image swap changes only the shape, never the direction. The IK that bent the limb and
// the pictures the drawings replace (a separate hand) are removed.
//
// fitLimbPoses(folder, file, spec) edits <folder>/<file> (.rigby) in place. spec:
//   { slot: 'arm_r', bone: 'upperarm_r', ik: 'ik_hand_r', hide: ['hand_r'], scale,
//     poses: [{ name, file, width, height, pivot: [u, v], angle, swing }] }
// poses come from tools/art/limbposes.py (pivot in image pixels, angle in degrees from straight
// down, positive toward +x); swing is the swing angle each drawing stands for (see poseAt).
// blend: true adds a slot `<slot>_blend` above the limb's slot, so neighbouring drawings dissolve
// into each other instead of popping (see blendAt and writeBlendKeys).

import fs from 'node:fs/promises';
import path from 'node:path';

import { unzip, zip } from '../src/editor/zip.js';
import { Workspace, createTools } from '../src/mcp/tools.js';

const D = Math.PI / 180;
const rotate = ([x, y], deg) => [x * Math.cos(deg * D) - y * Math.sin(deg * D), x * Math.sin(deg * D) + y * Math.cos(deg * D)];

export async function fitLimbPoses(folder, file, spec) {
  const ws = await Workspace.open([folder]);
  const tools = Object.fromEntries(createTools(ws).map((t) => [t.name, t]));
  const setup = await tools.sample_pose.handler({ path: file });
  const beta = setup.bones.find((b) => b.name === spec.bone).rotation;

  const full = path.join(folder, file);
  const entries = unzip(new Uint8Array(await fs.readFile(full)));
  const project = JSON.parse(new TextDecoder().decode(entries.get('project.json')));
  const boneIndex = (name) => project.bones.findIndex((b) => b.name === name);
  const slot = project.slots.find((s) => s.name === spec.slot);
  const k = spec.scale;

  slot.bone = boneIndex(spec.bone);
  slot.attachments = spec.poses.map((p) => {
    // Image turned by rho so its limb line (-90 + angle in world) lies along the bone (beta).
    const rho = beta + 90 - p.angle;
    const toCenter = [(p.width / 2 - p.pivot[0]) * k, -(p.height / 2 - p.pivot[1]) * k];
    const [x, y] = rotate(rotate(toCenter, rho), -beta);
    return { name: p.name, x, y, rotation: rho - beta, scale_x: k, scale_y: k, width: p.width, height: p.height };
  });
  slot.attachment = spec.poses.find((p) => p.swing === 0)?.name ?? spec.poses[0].name;
  for (const name of spec.hide ?? []) {
    const s = project.slots.find((q) => q.name === name);
    if (s) s.attachment = null;
  }
  if (spec.blend) {
    // A twin slot right above, same bone and drawings, hidden until a dissolve shows it.
    const at = project.slots.indexOf(slot) + 1;
    project.slots.splice(at, 0, { ...structuredClone(slot), name: `${spec.slot}_blend`, attachment: null });
    for (const a of project.animations ?? []) for (const t of a.slots ?? []) if (t.slot >= at) t.slot++;
  }
  project.ik = (project.ik ?? []).filter((c) => c.name !== spec.ik);
  // Constraint order has no gaps (the other constraint kinds share it).
  const constraints = ['ik', 'transform', 'path', 'physics', 'slider'].flatMap((k) => project[k] ?? []);
  constraints.sort((a, b) => a.order - b.order).forEach((c, i) => (c.order = i));

  for (const p of spec.poses) {
    project.images = project.images.filter((im) => im.name !== p.name).concat({ name: p.name, width: p.width, height: p.height });
    entries.set(`images/${p.name}.png`, new Uint8Array(await fs.readFile(p.file)));
  }
  entries.set('project.json', new TextEncoder().encode(JSON.stringify(project, null, 2)));
  await fs.writeFile(full, zip([...entries].map(([p, bytes]) => ({ path: p, bytes }))));
}

/** The drawing that stands for the swing angle nearest to `swing`. */
export function poseAt(poses, swing) {
  return poses.reduce((best, p) => (Math.abs(p.swing - swing) < Math.abs(best.swing - swing) ? p : best));
}

/**
 * Which drawings the limb's two slots show at `swing`, and how opaque the upper one is:
 * { base, top, alpha }. The drawings, in swing order, alternate between the slots (1st, 3rd, ...
 * below, 2nd, 4th, ... above), so a slot changes its drawing only while the upper slot hides it
 * (alpha 1) or is itself invisible (alpha 0). Away from the middle between two drawings the
 * nearer one shows alone; across the middle `width` (a share of the gap between their swing
 * angles) one dissolves into the other.
 */
export function blendAt(poses, swing, width = 0.5) {
  const sorted = [...poses].sort((a, b) => a.swing - b.swing);
  let i = 0;
  while (i < sorted.length - 2 && swing > sorted[i + 1].swing) i++;
  const u = Math.min(1, Math.max(0, (swing - sorted[i].swing) / (sorted[i + 1].swing - sorted[i].swing)));
  const x = Math.min(1, Math.max(0, (u - 0.5) / width + 0.5));
  const toUpper = x * x * (3 - 2 * x); // 0: sorted[i] shows, 1: sorted[i + 1] shows
  const even = i % 2 === 0 ? sorted[i] : sorted[i + 1], odd = i % 2 === 0 ? sorted[i + 1] : sorted[i];
  return { base: even.name, top: odd.name, alpha: i % 2 === 0 ? toUpper : 1 - toUpper };
}

/**
 * Writes the dissolve keys of an animation into <folder>/<file>: keys = [{ time, base, top,
 * alpha }] (from blendAt): the limb's slot shows `base`, the `_blend` slot above shows `top` at
 * `alpha`.
 */
export async function writeBlendKeys(folder, file, slotName, animation, keys) {
  const full = path.join(folder, file);
  const entries = unzip(new Uint8Array(await fs.readFile(full)));
  const project = JSON.parse(new TextDecoder().decode(entries.get('project.json')));
  const anim = project.animations.find((a) => a.name === animation);
  anim.slots ??= [];
  const index = (name) => project.slots.findIndex((s) => s.name === name);
  const timeline = (slot) => {
    let t = anim.slots.find((x) => x.slot === slot);
    if (!t) anim.slots.push((t = { slot }));
    return t;
  };
  const changes = (pick) => keys.filter((k, i) => i === 0 || pick(k) !== pick(keys[i - 1])).map((k) => ({ time: k.time, value: pick(k), curve: 'stepped' }));
  timeline(index(slotName)).attachment = changes((k) => k.base);
  const top = timeline(index(`${slotName}_blend`));
  top.attachment = changes((k) => k.top);
  // Colours are stored as 8-bit channels in exports: keep the alpha on that grid.
  top.color = keys.map((k) => ({ time: k.time, value: [1, 1, 1, Math.round(k.alpha * 255) / 255] }));
  entries.set('project.json', new TextEncoder().encode(JSON.stringify(project, null, 2)));
  await fs.writeFile(full, zip([...entries].map(([p, bytes]) => ({ path: p, bytes }))));
}
