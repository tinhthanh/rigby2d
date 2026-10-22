// SPDX-License-Identifier: MIT OR Apache-2.0
// Rebuilds character/adventurer/adventurer_side.rigby from adventurer_side.psd with its walk cycles
// (see tools/walkcycle.mjs). The scarf end is a two-bone chain that trails back and ripples.
// Usage: node character/adventurer/walk.mjs
import { fileURLToPath } from 'node:url';

import { buildWalk } from '../../tools/walkcycle.mjs';

const folder = fileURLToPath(new URL('.', import.meta.url));
const checks = await buildWalk(folder, 'adventurer_side.psd', 'adventurer_side.rigby', {
  cycle: 0.95, stride: 0.26, crouch: 0.025, bob: 0.014, arm: 18, hair: 5, trail: 10,
});
console.log(JSON.stringify(checks));
