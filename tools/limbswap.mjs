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
