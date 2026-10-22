// SPDX-License-Identifier: MIT OR Apache-2.0
// Side-view walk cycles for AutoRigged characters (facing +x): `walk` in place and `walk_across`
// (walks right, turns, walks back). Built from smooth curves sampled densely:
// - legs: the foot IK targets follow a stance (planted, sliding back at body speed) and a swing
//   (lifted arc) phase, with heel strike / flat / toe off foot roll
// - body: hip bob (lowest after contact, highest at mid-stance), forward lean, delayed head
// - arms: pendulum arcs about the shoulder on the hand IK targets, slightly behind the legs; a
//   separate hand bone drags behind the swing (a relaxed wrist)
// - hair, scarves and tails (`hair`, `hair1`, `hair2`, `tail1`... bones): bounce behind the body,
//   each link of a chain later and wider than the one before, so it ripples like cloth
// Pass 1 keys the body and legs; pass 2 samples the posed shoulders and feet to key the arms and
// the foot roll. Sizes default to fractions of the leg length, so one call fits any character.
//
// Usage: node tools/walkcycle.mjs <folder> <artwork.psd> <out.rigby> [--cycle 1] [--stride 0.28] [--cycles 8]
//   (paths relative to <folder>; the PSD is AutoRigged into <out.rigby> first)

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { gaitWalk } from './gait.mjs';
import { fitLimbPoses, poseAt } from './limbswap.mjs';
import { createEditTools } from '../src/mcp/edits.js';
import { createRiggingTools } from '../src/mcp/rigging.js';
import { Workspace, createTools } from '../src/mcp/tools.js';

const D = Math.PI / 180;
const smooth = (x) => x * x * x * (x * (6 * x - 15) + 10);
const lerp = (a, b, u) => a + (b - a) * u;
const mod1 = (x) => ((x % 1) + 1) % 1;

/**
 * AutoRigs `psd` into `out` (inside `folder`) and keys `walk` and `walk_across`. Options (all
 * optional): cycle (s), keys (per cycle), cycles (of walk_across), stance (share), stride, lift,
 * bob, crouch (fractions of the leg length, or pixels when absolute: true), heel, toeOff, arm,
 * gait ('data': legs and pelvis from human gait data, see tools/gait.mjs), gaitScale, nod (degrees the
 * head nods after each landing, with gait 'data'), wrist (degrees), elbow (share the reach shortens at the front of the swing), hair (degrees of bounce), trail (degrees a hanging chain leans back while walking).
 * Returns the validation checks.
 */
export async function buildWalk(folder, psd, out, options = {}) {
  const ws = await Workspace.open([folder]);
  const tools = Object.fromEntries([...createTools(ws), ...createEditTools(ws), ...createRiggingTools(ws)].map((t) => [t.name, t]));
  const call = (name, args) => tools[name].handler({ path: out, ...args });
  await tools.autorig.handler({ psd_file: psd, output: out, overwrite: true });
  // Pose drawings for an arm (see tools/limbswap.mjs): its upper bone swings and the drawings swap.
  const limb = options.limbPoses;
  if (limb) await fitLimbPoses(folder, out, limb);

  const rig = await call('describe_rig', {});
  const setup = await call('sample_pose', {});
  const bone = (pose, n) => pose.bones.find((b) => b.name === n);
  const length = (n) => rig.bones.find((b) => b.name === n).length;
  // Secondary chains: [bone, link index] for hair / tail bones (`hair`, or `hair1`, `hair2`, ...).
  const chains = rig.bones.flatMap((b) => {
    const m = /^(?:hair|tail)(?:_[lr])?(\d*)$/.exec(b.name);
    return m ? [[b.name, m[1] ? Number(m[1]) - 1 : 0]] : [];
  });
  const hasBone = (name) => rig.bones.some((b) => b.name === name);
  const hasArm = (side) => hasBone(`ik_hand_${side}`);

  const o = { cycle: 1, keys: 24, cycles: 8, stance: 0.6, stride: 0.28, lift: 0.095, bob: 0.014, crouch: 0.028, heel: 14, toeOff: -25, arm: 22, elbow: 0.07, wrist: 0, hair: 6, trail: 0, nod: 3, ...options };
  const legLen = length('thigh_l') + length('shin_l');
  const size = (v) => (o.absolute ? v : v * legLen);
  const S = size(o.stride), LIFT = size(o.lift), BOB = size(o.bob), CROUCH = size(o.crouch);
  const { cycle: CYCLE, keys: KEYS, stance: STANCE } = o;
  const foot = Object.fromEntries(['l', 'r'].map((s) => [s, { len: o.footLen ?? length(`foot_${s}`), angle: o.footAngle ?? bone(setup, `foot_${s}`).rotation }]));

  // gait: 'data' drives the legs and the pelvis from human gait data (see tools/gait.mjs) instead
  // of the stance / swing curves below; gaitScale shrinks or grows the joint angles.
  const model = o.gait === 'data' ? gaitWalk(Object.fromEntries(['l', 'r'].map((s) => {
    const th = bone(setup, `thigh_${s}`), sh = bone(setup, `shin_${s}`), ft = bone(setup, `foot_${s}`);
    return [s, {
      hip: [th.x, th.y], thigh: length(`thigh_${s}`), shin: length(`shin_${s}`),
      thighAngle: th.rotation, shinAngle: sh.rotation, footAngle: foot[s].angle, ankle: [ft.x, ft.y],
      // The heel a little behind the ankle, on the ground (y = 0).
      footLength: foot[s].len, heel: [ft.x - 0.2 * foot[s].len, 0],
    }];
  })), { scale: o.gaitScale ?? 1, heel: o.heel, toeOff: o.toeOff }) : null;
  // Pelvis height over the cycle, for the head's follow-through (0 at the top, 1 at the bottom).
  const lowness = (() => {
    if (!model) return null;
    const ys = Array.from({ length: 100 }, (_, i) => model.at(i / 100).pelvis[1]);
    const lo = Math.min(...ys), hi = Math.max(...ys);
    return (ph) => (hi - model.at(ph).pelvis[1]) / Math.max(1e-6, hi - lo);
  })();

  /** Ankle offset from its setup position and foot roll of a leg at walk phase ph. */
  function legAt(ph, side, off) {
    if (!model) return leg(mod1(ph + off), side);
    const L = model.at(ph).legs[side];
    return { x: L.ankle[0], y: L.ankle[1], roll: L.foot - foot[side].angle };
  }

  /** Ankle offset from its setup position and foot roll for a leg at phase p (0 = heel strike). */
  function leg(p, side) {
    const { len, angle } = foot[side];
    const toePivot = (x, roll) => {
      // The toe stays on the ground while the heel lifts: the ankle moves around the toe.
      const a = (angle + roll) * D;
      return [x + len * (Math.cos(angle * D) - Math.cos(a)), len * (Math.sin(angle * D) - Math.sin(a))];
    };
    if (p < STANCE) {
      const u = p / STANCE, x = S - 2 * S * u;
      if (u < 0.15) return { x, y: 0, roll: o.heel * (1 - smooth(u / 0.15)) };
      if (u < 0.72) return { x, y: 0, roll: 0 };
      const roll = o.toeOff * smooth((u - 0.72) / 0.28);
      const [ax, ay] = toePivot(x, roll);
      return { x: ax, y: ay, roll };
    }
    const v = (p - STANCE) / (1 - STANCE), e = smooth(v);
    const [sx, sy] = toePivot(-S, o.toeOff);
    return {
      x: lerp(sx, S, e),
      y: lerp(sy, 0, e) + LIFT * Math.sin(Math.PI * Math.pow(v, 0.8)),
      roll: lerp(o.toeOff, o.heel, e) - 12 * Math.sin(Math.PI * v),
    };
  }

  const body = (t) => {
    const w = Math.cos(4 * Math.PI * (t - 0.3)); // two bobs per cycle, highest at mid-stance
    if (model) {
      const [x, y] = model.at(t).pelvis;
      return {
        hip: { x, y },
        hipRot: 0,
        // The chest leans into the walk and settles a moment after each landing; the head nods
        // later still (follow-through), most visible on a big head.
        chest: -4 - 1.5 * lowness(t - 0.04),
        head: 2 - o.nod * lowness(t - 0.09),
        hair: (k) => o.hair * (1 + 0.5 * k) * (1 - 2 * lowness(t - 0.12 - 0.06 * k)) + (k === 0 ? -o.trail : -o.trail * 0.3),
      };
    }
    return {
      hip: { x: 0, y: -CROUCH + BOB * w },
      hipRot: 1.5 * Math.sin(4 * Math.PI * (t - 0.2)),
      chest: -4 + 1.5 * w,
      head: 3 - 1.2 * Math.cos(4 * Math.PI * (t - 0.4)),
      // Hair trails the bob: it lags and overshoots a little, more at each link down a chain.
      hair: (k) => o.hair * (1 + 0.5 * k) * Math.cos(4 * Math.PI * (t - 0.42 - 0.07 * k)) + (k === 0 ? -o.trail : -o.trail * 0.3),
    };
  };

  /** Arm swing in degrees (positive forward): against the leg on its side, a little behind it, further forward than back. */
  const swing = (ph, sign) => {
    const th = sign * o.arm * Math.cos(2 * Math.PI * (ph - 0.06));
    return th * (th > 0 ? 1.15 : 0.85);
  };

  const keyer = (anim, ops) => (bone, channel, time, v, last) => ops.push({ op: 'set_bone_key', animation: anim, bone, channel, time, ...v, ...(!last && { curve: 'linear' }) });

  async function bodyAndLegs(anim, cycles) {
    const dur = cycles * CYCLE, n = cycles * KEYS;
    const ops = [{ op: 'add_animation', name: anim, duration: dur }];
    const key = keyer(anim, ops);
    for (let k = 0; k <= n; k++) {
      const t = (k / KEYS) * CYCLE, ph = mod1(k / KEYS), last = k === n, b = body(ph);
      key('hip', 'translate', t, b.hip, last);
      key('hip', 'rotate', t, { value: b.hipRot }, last);
      key('chest', 'rotate', t, { value: b.chest }, last);
      key('head', 'rotate', t, { value: b.head }, last);
      if (limb) {
        const sw = swing(ph, limb.side === 'l' ? -1 : 1);
        key(limb.bone, 'rotate', t, { value: sw }, last);
        ops.push({ op: 'set_attachment_key', animation: anim, slot: limb.slot, time: t, attachment: poseAt(limb.poses, sw).name });
      }
      for (const [name, k] of chains) key(name, 'rotate', t, { value: b.hair(k) }, last);
      for (const [side, off] of [['l', 0], ['r', 0.5]]) {
        const L = legAt(ph, side, off);
        key(`ik_foot_${side}`, 'translate', t, { x: L.x, y: L.y }, last);
      }
    }
    if (anim === 'walk_across') {
      const speed = model ? model.stride / CYCLE : (2 * S) / (STANCE * CYCLE), half = dur / 2, X = (speed * half) / 2;
      for (const [t, x, c] of [[0, -X, 'linear'], [half, X, 'linear'], [dur, -X]]) ops.push({ op: 'set_bone_key', animation: anim, bone: 'root', channel: 'translate', time: t, x, y: 0, ...(c && { curve: c }) });
      // Mirror the whole character for the trip back.
      for (const [t, sx, c] of [[0, 1, 'stepped'], [half, -1, 'stepped'], [dur, -1]]) ops.push({ op: 'set_bone_key', animation: anim, bone: 'root', channel: 'scale', time: t, x: sx, y: 1, ...(c && { curve: c }) });
    }
    await call('batch_edit', { operations: ops });
  }

  // Arm and foot values come from the one-cycle walk (root at rest), repeated for any cycle count.
  async function armsAndFeet(anim, cycles, sampled) {
    const ops = [], key = keyer(anim, ops), n = cycles * KEYS;
    for (let k = 0; k <= n; k++) {
      const t = (k / KEYS) * CYCLE, s = sampled[k % KEYS], last = k === n;
      for (const side of ['l', 'r']) {
        key(`foot_${side}`, 'rotate', t, { value: s.foot[side] }, last);
        if (s.hand[side]) key(`ik_hand_${side}`, 'translate', t, s.hand[side], last);
        if (s.wrist[side] !== undefined) key(`hand_${side}`, 'rotate', t, { value: s.wrist[side] }, last);
      }
    }
    await call('batch_edit', { operations: ops });
  }

  await bodyAndLegs('walk', 1);
  const sampled = [];
  for (let k = 0; k < KEYS; k++) {
    const ph = k / KEYS, pose = await call('sample_pose', { animation: 'walk', time: ph * CYCLE });
    const s = { foot: {}, hand: {}, wrist: {} };
    for (const [side, off, sign] of [['l', 0, -1], ['r', 0.5, 1]]) {
      // Foot: the world angle the roll asks for, minus what the shin already gives it.
      const d = foot[side].angle + legAt(ph, side, off).roll - bone(pose, `foot_${side}`).rotation;
      s.foot[side] = ((d + 540) % 360) - 180;
      // A side view often shows one arm only (the far one hides behind the body).
      if (!hasArm(side)) continue;
      const th = swing(ph, sign);
      const sh = bone(pose, `upperarm_${side}`), sh0 = bone(setup, `upperarm_${side}`), tg0 = bone(setup, `ik_hand_${side}`);
      const reach0 = Math.hypot(tg0.x - sh0.x, tg0.y - sh0.y), th0 = Math.atan2(tg0.x - sh0.x, sh0.y - tg0.y) / D;
      const R = reach0 * (0.985 - o.elbow * Math.max(0, th / o.arm)); // the elbow bends as the arm swings forward
      const a = (th0 + th) * D;
      s.hand[side] = { x: sh.x + R * Math.sin(a) - tg0.x, y: sh.y - R * Math.cos(a) - tg0.y };
      // Wrist: the hand trails the arm's motion a little later (negative turns the fingers back).
      if (o.wrist && hasBone(`hand_${side}`)) s.wrist[side] = sign * o.wrist * Math.sin(2 * Math.PI * (ph - 0.12));
    }
    sampled.push(s);
  }
  await armsAndFeet('walk', 1, sampled);
  await bodyAndLegs('walk_across', o.cycles);
  await armsAndFeet('walk_across', o.cycles, sampled);
  return (await call('validate_project', {})).checks;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [folder, psd, out, ...rest] = process.argv.slice(2);
  if (!out) {
    process.stderr.write('Usage: node tools/walkcycle.mjs <folder> <artwork.psd> <out.rigby> [--cycle 1] [--stride 0.28] [--cycles 8]\n');
    process.exit(2);
  }
  const options = {};
  for (let i = 0; i < rest.length; i += 2) options[rest[i].replace(/^--/, '')] = Number(rest[i + 1]);
  console.log(JSON.stringify(await buildWalk(path.resolve(folder), psd, out, options)));
}
