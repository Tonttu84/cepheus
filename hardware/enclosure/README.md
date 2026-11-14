# Cepheus Desk Buddy Enclosure (Arduino UNO Q + USB Camera)

Screwless 3D-printable enclosure for the Cepheus home unit (**Arduino UNO Q `ABX00162`**, **8-in-1 USB-C Hub `TPX00241`**, and **Arduino USB Camera `TPX00246`**), featuring a **physical flip-up privacy visor** that covers the camera completely at rest and flips open only during an active check-in.

- Small parts (`cepheus_visor_arms.stl`, `cepheus_hinge_pins.stl`, `cepheus_uno_pins.stl`, `cepheus_paw_pads.stl`) are laid flat for support-free printing.
- `stl/cepheus_desk_buddy.3mf` enables build-plate-only tree supports (`tree(auto)`) for the curved outer shell and visor overhangs.

## Contents

- `stl/cepheus_desk_buddy.3mf` — Multi-plate Bambu Studio / PrusaSlicer project (Plate 1: Peach PLA `cepheus_top_shell`; Plate 2: White PLA tray, visor, arms, pins, and paw pads).
- `stl/*.stl` — Individual STL parts (`cepheus_top_shell.stl`, `cepheus_bottom_tray.stl`, `cepheus_privacy_visor.stl`, `cepheus_visor_arms.stl`, `cepheus_hinge_pins.stl`, `cepheus_uno_pins.stl`, `cepheus_paw_pads.stl`).
- `cepheus_all_parts.stl`, `cepheus_white_plate.stl` — Combined single-plate STLs.
- `cepheus_enclosure.blend` — Blender assembly source file.
- `build_enclosure.py`, `make_3mf.py` — Parametric Blender generator (exports parts to `stl/`) and `.3mf` packager (reads from and writes to `stl/`).
- `index.html`, `cepheus_assembly.glb` — Interactive Three.js 3D explorer (sleep/awake visor toggle, X-ray mode, exploded slider, part toggles).
- `preview_assembled.png`, `preview_exploded.png`, `preview_rear.png` — Rendered views.

## Viewing the Interactive 3D Explorer (`index.html`)

`index.html` loads Three.js locally from `./node_modules/three` (no external CDN):

```bash
cd hardware/enclosure
npm ci
npx serve .
```
