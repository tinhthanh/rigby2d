# Adventurer kid (side view)

A character designed for skeletal animation: the costume hides the joints that show seams on a
cut-out rig.

- Long jacket sleeves cover the elbow and wrist. The arm is **seven drawings** along its swing
  (`art/arms.png` and `art/arms_mid.png`, cut into `art/arms/`), each standing for the angle it
  was drawn at: 20, 12 and 6 degrees forward (elbow bending, hand curling), hanging, 5, 10 and 19
  degrees back (arm straight, hand open). Neighbours differ so little that the drawing simply
  swaps; a dissolve (`blend: true`) was tried and left double sleeve outlines without being
  smoother. One picture bent by a mesh cannot change the
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
  real walk instead of a smooth wave. The head nods a moment after each landing. Every channel is smoothed
  around the cycle (`smoothing: 0.035`) and keyed 60 times per cycle, so the hand-over between the
  supporting legs and the lift at toe off carry no jolts; the planted foot moves under 1 px.

| File | Use |
| --- | --- |
| `art/model.png` | The standard: the whole character in side view, standing. Sets proportions and positions |
| `art/parts.png` | The same character cut into pieces |
| `art/arms.png`, `art/arms_mid.png`, `art/arms/`, `art/arm_poses.json` | The seven arm drawings, cut and measured (pivot at the shoulder, drawn angle) |
| `art/layout.json` | How the pieces sit on the model (the boot foot is recoloured to match the shaft) |
| `adventurer_side.psd` | The layered artwork built with `tools/art/` |
| `adventurer_side.rigby` | AutoRigged, with `walk` (in place, 1 s) and `walk_across`. The editor opens it from *File ▸ Open walk demo (adventurer)* |
| `walk.mjs` | Rebuilds the rig and both walks from the PSD: `node character/adventurer/walk.mjs` |
