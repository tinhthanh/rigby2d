# Adventurer kid (side view)

A character designed for skeletal animation: the costume hides the joints that show seams on a
cut-out rig.

- Long jacket sleeves cover the elbow and wrist; the arm is one piece with its hand.
- Tall boots cover the ankle; each leg is one piece from the hip to the ankle (trouser and boot
  shaft), so AutoRig bends it as a weighted mesh at the knee.
- The jacket hem covers the top of the legs; the scarf wrap hides the neck.
- The long scarf end is a two-bone chain (`hair_scarf` → `hair1`, `hair2`) that trails back and
  ripples while walking.
- Flat cel shading: pieces meet without soft-shading seams.

| File | Use |
| --- | --- |
| `art/model.png` | The standard: the whole character in side view, standing. Sets proportions and positions |
| `art/parts.png` | The same character cut into pieces |
| `art/layout.json` | How the pieces sit on the model (the boot foot is recoloured to match the shaft) |
| `adventurer_side.psd` | The layered artwork built with `tools/art/` |
| `adventurer_side.rigby` | AutoRigged, with `walk` (in place, 0.95 s) and `walk_across`. The editor opens it from *File ▸ Open walk demo (adventurer)* |
| `walk.mjs` | Rebuilds the rig and both walks from the PSD: `node character/adventurer/walk.mjs` |
