// SPDX-License-Identifier: MIT OR Apache-2.0
// Rebuilds branding/rigbytron/rigbytron_side.rigby from side/rigbytron_side.psd with its walk cycles
// (see tools/walkcycle.mjs). Usage: node branding/rigbytron/side/walk.mjs
import { fileURLToPath } from 'node:url';

import { buildWalk } from '../../../tools/walkcycle.mjs';

const folder = fileURLToPath(new URL('..', import.meta.url));
const checks = await buildWalk(folder, 'side/rigbytron_side.psd', 'rigbytron_side.rigby', {
  absolute: true, stride: 220, lift: 75, bob: 11, crouch: 22, footLen: 297, footAngle: -28.8,
});
console.log(JSON.stringify(checks));
