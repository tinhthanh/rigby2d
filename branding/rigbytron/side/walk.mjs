// SPDX-License-Identifier: MIT OR Apache-2.0
// Rebuilds branding/rigbytron/rigbytron_side.rigby: AutoRigs side/rigbytron_side.psd, then keys a
// natural side-view walk (faces +x), built from smooth curves sampled densely.
// Pass 1 keys the body and legs; pass 2 samples the posed shoulders and feet to key the arm IK
// targets (pendulum arcs about the shoulder) and the foot roll (heel strike, flat, toe off).
// Usage: node branding/rigbytron/side/walk.mjs
import { fileURLToPath } from 'node:url';

import { createEditTools } from '../../../src/mcp/edits.js';
import { createRiggingTools } from '../../../src/mcp/rigging.js';
import { Workspace, createTools } from '../../../src/mcp/tools.js';

const ws = await Workspace.open([fileURLToPath(new URL('..', import.meta.url))]);
const tools = Object.fromEntries([...createTools(ws), ...createEditTools(ws), ...createRiggingTools(ws)].map((t) => [t.name, t]));
const file = 'rigbytron_side.rigby';
const call = (name, args) => tools[name].handler({ path: file, ...args });
await tools.autorig.handler({ psd_file: 'side/rigbytron_side.psd', output: file, overwrite: true });

const KEYS = 24;               // keys per cycle
const CYCLE = 1.0;             // seconds per cycle (two steps)
const STANCE = 0.6;            // share of the cycle a foot is planted
const S = 220;                 // half stride
const LIFT = 75;               // swing foot clearance
const TOE_OFF = -25, HEEL = 14; // foot roll in degrees (+ = toe up)
const FOOT_LEN = 297, FOOT_SETUP = -28.8; // foot bone length and world angle in setup
const ARM = 22;                // arm swing amplitude in degrees
const D = Math.PI / 180;

const smooth = (x) => x * x * x * (x * (6 * x - 15) + 10);
const lerp = (a, b, u) => a + (b - a) * u;
const mod1 = (x) => ((x % 1) + 1) % 1;

/** Ankle offset (x, y) from its setup position and foot roll for a leg at phase p (0 = heel strike). */
function leg(p) {
  const flat = Math.cos(FOOT_SETUP * D), down = Math.sin(FOOT_SETUP * D);
  const toePivot = (x, roll) => {
    // Toe stays on the ground while the heel lifts: move the ankle around the toe.
    const a = (FOOT_SETUP + roll) * D;
    return [x + FOOT_LEN * (flat - Math.cos(a)), FOOT_LEN * (down - Math.sin(a))];
  };
  if (p < STANCE) {
    const u = p / STANCE, x = S - 2 * S * u; // planted: slides back at body speed
    if (u < 0.15) return { x, y: 0, roll: HEEL * (1 - smooth(u / 0.15)) };
    if (u < 0.72) return { x, y: 0, roll: 0 };
    const roll = TOE_OFF * smooth((u - 0.72) / 0.28);
    const [ax, ay] = toePivot(x, roll);
    return { x: ax, y: ay, roll };
  }
  const v = (p - STANCE) / (1 - STANCE), e = smooth(v);
  const [sx, sy] = toePivot(-S, TOE_OFF);
  return {
    x: lerp(sx, S, e),
    y: lerp(sy, 0, e) + LIFT * Math.sin(Math.PI * Math.pow(v, 0.8)),
    roll: lerp(TOE_OFF, HEEL, e) - 12 * Math.sin(Math.PI * v),
  };
}

const body = (t) => {
  const w = Math.cos(4 * Math.PI * (t - 0.3)); // 2 bobs per cycle, highest at mid-stance
  return {
    hip: { x: 0, y: -22 + 11 * w },
    hipRot: 1.5 * Math.sin(4 * Math.PI * (t - 0.2)),
    chest: -4 + 1.5 * w,
    head: 3 - 1.2 * Math.cos(4 * Math.PI * (t - 0.4)),
  };
};

async function build(anim, cycles) {
  const dur = cycles * CYCLE, n = cycles * KEYS;
  const ops = [{ op: 'add_animation', name: anim, duration: dur }];
  const key = (bone, channel, time, v, last) => ops.push({ op: 'set_bone_key', animation: anim, bone, channel, time, ...v, ...(!last && { curve: 'linear' }) });
  for (let k = 0; k <= n; k++) {
    const t = (k / KEYS) * CYCLE, ph = mod1(k / KEYS), last = k === n, b = body(ph);
    key('hip', 'translate', t, b.hip, last);
    key('hip', 'rotate', t, { value: b.hipRot }, last);
    key('chest', 'rotate', t, { value: b.chest }, last);
    key('head', 'rotate', t, { value: b.head }, last);
    for (const [side, off] of [['l', 0], ['r', 0.5]]) {
      const L = leg(mod1(ph + off));
      key(`ik_foot_${side}`, 'translate', t, { x: L.x, y: L.y }, last);
    }
  }
  if (anim === 'walk_across') {
    const speed = (2 * S) / (STANCE * CYCLE), half = dur / 2, X = (speed * half) / 2;
    for (const [t, x, c] of [[0, -X, 'linear'], [half, X, 'linear'], [dur, -X]]) ops.push({ op: 'set_bone_key', animation: anim, bone: 'root', channel: 'translate', time: t, x, y: 0, ...(c && { curve: c }) });
    for (const [t, sx, c] of [[0, 1, 'stepped'], [half, -1, 'stepped'], [dur, -1]]) ops.push({ op: 'set_bone_key', animation: anim, bone: 'root', channel: 'scale', time: t, x: sx, y: 1, ...(c && { curve: c }) });
  }
  await call('batch_edit', { operations: ops });
}

// Pass 2 values come from the one-cycle walk (root at rest), then repeat for any cycle count.
async function limbs(anim, cycles, sampled) {
  const n = cycles * KEYS, ops = [];
  const key = (bone, channel, time, v, last) => ops.push({ op: 'set_bone_key', animation: anim, bone, channel, time, ...v, ...(!last && { curve: 'linear' }) });
  for (let k = 0; k <= n; k++) {
    const t = (k / KEYS) * CYCLE, s = sampled[k % KEYS], last = k === n;
    for (const side of ['l', 'r']) {
      key(`foot_${side}`, 'rotate', t, { value: s.foot[side] }, last);
      key(`ik_hand_${side}`, 'translate', t, s.hand[side], last);
    }
  }
  await call('batch_edit', { operations: ops });
}

const setup = await call('sample_pose', {});
const bone = (pose, n) => pose.bones.find((b) => b.name === n);
await build('walk', 1);
const sampled = [];
for (let k = 0; k < KEYS; k++) {
  const ph = k / KEYS, pose = await call('sample_pose', { animation: 'walk', time: ph * CYCLE });
  const s = { foot: {}, hand: {} };
  for (const [side, off, sign] of [['l', 0, -1], ['r', 0.5, 1]]) {
    // Foot: the world angle the roll asks for, minus what the shin already gives it.
    const want = FOOT_SETUP + leg(mod1(ph + off)).roll;
    let d = want - bone(pose, `foot_${side}`).rotation;
    s.foot[side] = ((d + 540) % 360) - 180;
    // Arm: swings against the leg on its side, a little behind it, further forward than back.
    let th = sign * ARM * Math.cos(2 * Math.PI * (ph - 0.06));
    th *= th > 0 ? 1.15 : 0.85;
    const sh = bone(pose, `upperarm_${side}`), sh0 = bone(setup, `upperarm_${side}`), tg0 = bone(setup, `ik_hand_${side}`);
    const reach0 = Math.hypot(tg0.x - sh0.x, tg0.y - sh0.y), th0 = Math.atan2(tg0.x - sh0.x, sh0.y - tg0.y) / D;
    const R = reach0 * (0.985 - 0.07 * Math.max(0, th / ARM));
    const a = (th0 + th) * D;
    s.hand[side] = { x: sh.x + R * Math.sin(a) - tg0.x, y: sh.y - R * Math.cos(a) - tg0.y };
  }
  sampled.push(s);
}
await limbs('walk', 1, sampled);
await build('walk_across', 8);
await limbs('walk_across', 8, sampled);
console.log(JSON.stringify((await call('validate_project', {})).checks));
