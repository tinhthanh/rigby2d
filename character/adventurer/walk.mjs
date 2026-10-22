// SPDX-License-Identifier: MIT OR Apache-2.0
// Rebuilds character/adventurer/adventurer_side.rigby from adventurer_side.psd with its walk cycles
// (see tools/walkcycle.mjs). The scarf end is a two-bone chain that trails back and ripples. The
// arm is three drawings (swung forward with the elbow bent, hanging, swung back) that swap as it
// swings (see tools/limbswap.mjs); art/arm_poses.json comes from tools/art/limbposes.py.
// Usage: node character/adventurer/walk.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildWalk } from '../../tools/walkcycle.mjs';

const folder = fileURLToPath(new URL('.', import.meta.url));
const measured = JSON.parse(fs.readFileSync(path.join(folder, 'art/arm_poses.json'), 'utf8'));
// The swing angle each drawing stands for, and the scale that gives the hanging drawing the length
// of the arm piece it replaces (354 px in parts.png, placed at scale 1.8).
const swings = { arm_r_fwd: 20, arm_r_mid: 0, arm_r_back: -16 };
const mid = measured.find((p) => p.name === 'arm_r_mid');
const limbPoses = {
  side: 'r', slot: 'arm_r', bone: 'upperarm_r', ik: 'ik_hand_r', hide: ['hand_r'],
  scale: (354 * 1.8) / mid.length,
  poses: measured.map((p) => ({ ...p, file: path.join(folder, p.file), swing: swings[p.name] })),
};
const checks = await buildWalk(folder, 'adventurer_side.psd', 'adventurer_side.rigby', {
  cycle: 0.95, stride: 0.26, crouch: 0.025, bob: 0.014, arm: 24, hair: 5, trail: 10, limbPoses,
});
console.log(JSON.stringify(checks));
