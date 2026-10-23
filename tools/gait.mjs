// SPDX-License-Identifier: MIT OR Apache-2.0
// A walk driven by human gait data: sagittal hip, knee and ankle angles over one gait cycle
// (0 = heel strike, about 60% stance), approximated from normative clinical gait data (as in
// Winter, "Biomechanics and Motor Control of Human Movement", and Perry, "Gait Analysis").
// From the angles and the character's own leg lengths it works out where the ankles go, how high
// the pelvis rides (the lowest heel or toe touches the ground) and how far it travels (the
// supporting heel or toe stays where it touched down), so the bob and the surge of the body come
// from the legs, unevenly, as in a real walk.

const D = Math.PI / 180;
// Share of the cycle a foot is on the ground.
const STANCE = 0.62;

// [percent of the cycle, degrees]. Hip: + flexion (thigh forward). Knee: + flexion. Ankle: +
// dorsiflexion (toes up).
export const GAIT = {
  hip: [[0, 30], [10, 27], [20, 18], [30, 9], [40, 1], [50, -7], [55, -9], [60, -5], [65, 4], [70, 14], [75, 22], [80, 28], [87, 32], [93, 31]],
  knee: [[0, 4], [5, 10], [12, 18], [20, 14], [30, 7], [40, 5], [50, 9], [55, 18], [60, 35], [65, 50], [70, 60], [73, 62], [78, 55], [85, 35], [90, 18], [95, 7]],
  ankle: [[0, 0], [5, -5], [8, -6], [15, 0], [30, 6], [45, 10], [52, 6], [57, -5], [62, -17], [66, -16], [72, -8], [80, -2], [90, 0]],
};

/** Periodic Catmull-Rom through [percent, value] knots; p is the phase (0..1). */
export function curve(knots, p) {
  const x = (((p % 1) + 1) % 1) * 100;
  const n = knots.length;
  const at = (i) => {
    const k = knots[((i % n) + n) % n];
    return [k[0] + 100 * Math.floor(i / n), k[1]];
  };
  let i = n - 1;
  for (let j = 0; j < n; j++) if (knots[j][0] <= x) i = j;
  const [x1, y1] = at(i), [x2, y2] = at(i + 1), [, y0] = at(i - 1), [, y3] = at(i + 2);
  const u = (x - x1) / (x2 - x1);
  return 0.5 * (2 * y1 + (-y0 + y2) * u + (2 * y0 - 5 * y1 + 4 * y2 - y3) * u * u + (-y0 + 3 * y1 - 3 * y2 + y3) * u * u * u);
}

/**
 * The walk for a leg geometry: legs = { l, r }, each { hip: [x, y] (thigh joint), thigh, shin
 * (lengths), thighAngle, shinAngle, footAngle (world degrees in the setup pose), ankle: [x, y],
 * footLength, heel: [x, y] (on the ground in the setup pose) }; offsets = { l: 0, r: 0.5 } (phase
 * of each leg's heel strike); scale shrinks or grows the hip and knee angles (1 = human); heel and
 * toeOff are the foot roll at heel strike and toe off (degrees); smoothing is the width of the
 * smoothing pass (a share of the cycle). Hip and knee follow the gait
 * data; the foot is placed flat during stance and rolls over the heel at contact and over the toe
 * at push-off, so cartoon feet longer than a human's still meet the ground. Returns
 * { at(phase) => { pelvis: [x, y], legs: { side: { ankle: [x, y], foot } } }, stride }: pelvis
 * is the body's offset from the setup pose for a walk in place, ankle the ankle's offset from its
 * setup position (pelvis included), foot the foot's world angle; stride is the distance
 * travelled per cycle.
 */
export function gaitWalk(legs, { offsets = { l: 0, r: 0.5 }, scale = 1, heel = 14, toeOff = -25, smoothing = 0.02, samples = 400 } = {}) {
  const sides = Object.keys(offsets);
  const smooth = (x) => x * x * x * (x * (6 * x - 15) + 10);
  /** Foot roll (degrees from flat) at leg phase q, and whether the foot turns about its toe. */
  const roll = (q) => {
    if (q < 0.1) return { roll: heel * (1 - smooth(q / 0.1)), pivot: 'heel', stance: true };
    if (q < 0.45) return { roll: 0, pivot: null, stance: true };
    if (q < STANCE) return { roll: toeOff * smooth((q - 0.45) / (STANCE - 0.45)), pivot: 'toe', stance: true };
    const v = (q - STANCE) / (1 - STANCE);
    return { roll: toeOff + (heel - toeOff) * smooth(v) - 12 * Math.sin(Math.PI * v), pivot: null, stance: false };
  };
  // Each leg with the pelvis at rest: ankle from the hip and knee angles, the foot's angle, and how
  // far the roll lifts the ankle (turning about the toe or the heel, which stay down).
  const pose = (p) => Object.fromEntries(sides.map((s) => {
    const g = legs[s], q = (((p + offsets[s]) % 1) + 1) % 1;
    const hip = scale * curve(GAIT.hip, q), knee = scale * curve(GAIT.knee, q);
    const th = (g.thighAngle + hip) * D, sh = (g.shinAngle + hip - knee) * D;
    const ax = g.hip[0] + g.thigh * Math.cos(th) + g.shin * Math.cos(sh);
    const ay = g.hip[1] + g.thigh * Math.sin(th) + g.shin * Math.sin(sh);
    const r = roll(q), f0 = g.footAngle * D, f = (g.footAngle + r.roll) * D;
    // Toe and heel as seen from the ankle, flat and rolled.
    const toe0 = [g.footLength * Math.cos(f0), g.footLength * Math.sin(f0)];
    const heel0 = [g.heel[0] - g.ankle[0], g.heel[1] - g.ankle[1]];
    const turn = ([x, y]) => [x * Math.cos(f - f0) - y * Math.sin(f - f0), x * Math.sin(f - f0) + y * Math.cos(f - f0)];
    const about = (pt, deg) => {
      const a = (deg - g.footAngle) * D;
      return [pt[0] - (pt[0] * Math.cos(a) - pt[1] * Math.sin(a)), pt[1] - (pt[0] * Math.sin(a) + pt[1] * Math.cos(a))];
    };
    let lift = [0, 0];
    if (r.pivot === 'toe') lift = about(toe0, g.footAngle + r.roll);
    if (r.pivot === 'heel') lift = about(heel0, g.footAngle + r.roll);
    if (!r.stance && !r.pivot) {
      // In the air the ankle hands over smoothly from where the toe pivot left it to where the heel
      // pivot will take it, so there is no jump at toe off or heel strike.
      const v = (q - STANCE) / (1 - STANCE), e = smooth(v);
      const off = about(toe0, g.footAngle + toeOff), on = about(heel0, g.footAngle + heel);
      lift = [off[0] + (on[0] - off[0]) * e, off[1] + (on[1] - off[1]) * e];
    }
    const low = Math.min(...[turn(toe0), turn(heel0)].map((v) => v[1])) - heel0[1]; // lowest point below the ankle's flat height
    return [s, { ankle: [ax, ay], lift, foot: g.footAngle + r.roll, stance: q < STANCE, low }];
  }));

  // The supporting leg (in stance, the lower ankle) stays planted: the pelvis drops by as much as
  // its ankle is above the setup height and moves forward by as much as the ankle slides back.
  const table = [];
  let travel = 0;
  for (let i = 0; i <= samples; i++) {
    const p = i / samples, legsAt = pose(p);
    const standing = sides.filter((s) => legsAt[s].stance);
    const height = (s) => legsAt[s].ankle[1] - legs[s].ankle[1];
    const support = (standing.length ? standing : sides).reduce((a, b) => (height(a) <= height(b) ? a : b));
    if (i > 0) {
      const prev = table[i - 1];
      travel += prev.legs[prev.support].ankle[0] - legsAt[prev.support].ankle[0];
    }
    table.push({ legs: legsAt, support, drop: -height(support), travel });
  }
  const stride = travel;
  // Every channel at each sample, then smoothed around the cycle: the hand-over from one supporting
  // leg to the other and the scuff guard leave corners that a smoothing pass rounds off.
  const channels = [];
  for (let i = 0; i < samples; i++) {
    const a = table[i];
    const pelvis = [a.travel - (stride * i) / samples, a.drop];
    const row = [...pelvis];
    for (const s of sides) {
      const A = a.legs[s];
      const ax = A.ankle[0] + A.lift[0] + pelvis[0];
      let ay = A.ankle[1] + A.lift[1] + pelvis[1];
      // A swinging foot longer than a human's would scuff the ground: lift it clear.
      ay += Math.max(0, -(ay - legs[s].ankle[1] + A.low));
      row.push(ax - legs[s].ankle[0], ay - legs[s].ankle[1], A.foot);
    }
    channels.push(row);
  }
  const smoothed = smoothCycle(channels, smoothing * samples);
  const at = (phase) => {
    const x = (((phase % 1) + 1) % 1) * samples, i = Math.floor(x) % samples, u = x - Math.floor(x);
    const a = smoothed[i], b = smoothed[(i + 1) % samples];
    const v = a.map((m, k) => m + (b[k] - m) * u);
    const out = {};
    sides.forEach((s, k) => (out[s] = { ankle: [v[2 + 3 * k], v[3 + 3 * k]], foot: v[4 + 3 * k] }));
    return { pelvis: [v[0], v[1]], legs: out };
  };
  return { at, stride };
}

/** Gaussian smoothing of rows of numbers around a cycle (sigma in samples; 0 leaves them). */
function smoothCycle(rows, sigma) {
  if (!(sigma > 0)) return rows;
  const n = rows.length, r = Math.ceil(3 * sigma);
  const w = Array.from({ length: 2 * r + 1 }, (_, k) => Math.exp(-((k - r) ** 2) / (2 * sigma * sigma)));
  const total = w.reduce((a, b) => a + b, 0);
  return rows.map((_, i) => rows[0].map((__, c) => {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += w[k + r] * rows[(((i + k) % n) + n) % n][c];
    return sum / total;
  }));
}
