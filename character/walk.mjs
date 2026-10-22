// SPDX-License-Identifier: MIT OR Apache-2.0
// Rebuilds character/chibi_side.rigby from chibi_side.psd with its walk cycles (see
// tools/walkcycle.mjs). Chibi legs are short: a quicker cycle, shorter steps, more bounce.
// Usage: node character/walk.mjs
import { fileURLToPath } from 'node:url';

import { buildWalk } from '../tools/walkcycle.mjs';

const folder = fileURLToPath(new URL('.', import.meta.url));
const checks = await buildWalk(folder, 'chibi_side.psd', 'chibi_side.rigby', { cycle: 0.9, stride: 0.24, crouch: 0.045, bob: 0.018 });
console.log(JSON.stringify(checks));
