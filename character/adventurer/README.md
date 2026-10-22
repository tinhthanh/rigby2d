# Adventurer kid (side view)

A character designed for skeletal animation: the costume hides the joints that show seams on a
cut-out rig.

- Long jacket sleeves cover the elbow and wrist. The arm is **five drawings** along its swing
  (`art/arms.png`, cut into `art/arms/`): swung forward with the elbow bent and the hand curled,
  half forward, hanging, half back, swung back with the arm straight. Neighbouring drawings
  dissolve into each other over a few frames (a `arm_r_blend` slot above the arm), so the arm
  never pops from one shape to the next. One picture bent by a mesh cannot change the
  hand's shape or the sleeve's folds; drawings can. The upper arm bone rotates continuously and
  each drawing is turned to line up with it, so a swap changes the shape, never the direction
  (`tools/limbswap.mjs`, measured with `tools/art/limbposes.py` into `art/arm_poses.json`).
- Tall boots cover the ankle; each leg is one piece from the hip to the ankle (trouser and boot
  shaft), so AutoRig bends it as a weighted mesh at the knee.
- The jacket hem covers the top of the legs; the scarf wrap hides the neck.
- The long scarf end is a two-bone chain (`hair_scarf` → `hair1`, `hair2`) that trails back and
  ripples while walking.
- Flat cel shading: pieces meet without soft-shading seams.
- The walk follows human gait data (`gait: 'data'`, see `tools/gait.mjs`): hip and knee angles over
  the cycle as measured in people, the foot planted flat with heel strike and toe off, and the
  pelvis bob and forward surge worked out from the planted foot, so the timing is uneven like a
  real walk instead of a smooth wave. The head nods a moment after each landing.

| File | Use |
| --- | --- |
| `art/model.png` | The standard: the whole character in side view, standing. Sets proportions and positions |
| `art/parts.png` | The same character cut into pieces |
| `art/arms.png`, `art/arms/`, `art/arm_poses.json` | The five arm drawings, cut and measured (pivot at the shoulder, drawn angle) |
| `art/layout.json` | How the pieces sit on the model (the boot foot is recoloured to match the shaft) |
| `adventurer_side.psd` | The layered artwork built with `tools/art/` |
| `adventurer_side.rigby` | AutoRigged, with `walk` (in place, 1 s) and `walk_across`. The editor opens it from *File ▸ Open walk demo (adventurer)* |
| `walk.mjs` | Rebuilds the rig and both walks from the PSD: `node character/adventurer/walk.mjs` |
