// SPDX-License-Identifier: MIT OR Apache-2.0
// Rebuilds character/adventurer/adventurer_side.rigby from adventurer_side.psd with its walk cycles
// (see tools/walkcycle.mjs). The scarf end is a two-bone chain that trails back and ripples. The
// arm is seven drawings along its swing (forward with the elbow bending, hanging, back with the
// arm straight) that swap as it swings (see tools/limbswap.mjs); art/arm_poses.json comes from
// tools/art/limbposes.py.
// Usage: node character/adventurer/walk.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildWalk } from '../../tools/walkcycle.mjs';

const folder = fileURLToPath(new URL('.', import.meta.url));
const measured = JSON.parse(fs.readFileSync(path.join(folder, 'art/arm_poses.json'), 'utf8'));
// Each drawing stands for the swing angle it was drawn at; the scale gives the hanging drawing the
// length of the arm piece it replaces (354 px in parts.png, placed at scale 1.8).
const mid = measured.find((p) => p.name === 'arm_r_mid');
const limbPoses = {
  side: 'r', slot: 'arm_r', bone: 'upperarm_r', ik: 'ik_hand_r', hide: ['hand_r'],
  scale: (354 * 1.8) / mid.length,
  poses: measured.map((p) => ({ ...p, file: path.join(folder, p.file), swing: p.angle })),
};
const checks = await buildWalk(folder, 'adventurer_side.psd', 'adventurer_side.rigby', {
  gait: 'data', cycle: 1.0, keys: 60, smoothing: 0.035, arm: 24, nod: 3, hair: 5, trail: 10, limbPoses,
});
console.log(JSON.stringify(checks));
