# Cepheus Desk Buddy Enclosure (Arduino UNO Q + USB Camera)

Screwless, 100% solid-filament (Peach & White PLA) enclosure for the Cepheus home unit, featuring a **physical flip-up privacy visor** that covers the **Arduino USB Camera (`TPX00246`, Ø 62 mm)** completely at rest and flips open only during an active check-in.

Two printable sizes are included (`0` non-manifold edges on every mesh):

## 1. `slt2/` — Compact External-Hub Edition (Fastest Print)

Moves the **8-in-1 USB-C Hub (`TPX00241`, `119 × 27.8 × 16 mm`)** outside so only the **Arduino UNO Q (`ABX00162`, `68.58 × 53.34 mm`)** and **USB Camera (`TPX00246`)** sit inside (`~108 × 104 × 106 mm`, `2.4 mm` wall, `28 mm` rear cable U-notch, `141.35 cm³` total PLA):

| File | Volume | Bbox (mm) | Print notes |
| --- | --- | --- | --- |
| `slt2/cepheus_top_shell.stl` | `82.13 cm³` | `111.45 × 107.12 × 89.75` | Peach PLA — upright, Tree Supports (Touching Buildplate Only) |
| `slt2/cepheus_bottom_tray.stl` | `36.71 cm³` | `107.95 × 103.79 × 29.30` | White PLA — flat on base, 0 supports |
| `slt2/cepheus_privacy_visor.stl` | `15.90 cm³` | `110.00 × 57.26 × 11.41` | White PLA — tilted `-86°` face-up, Touching Buildplate Only under inner arch |
| `slt2/cepheus_visor_arms.stl` | `5.22 cm³` | `46.00 × 55.50 × 4.80` | White PLA — flat, 0 supports |
| `slt2/cepheus_hinge_pins.stl` | `0.92 cm³` | `26.60 × 8.60 × 12.30` | White PLA — wide cap flat on bed, 0 supports |
| `slt2/cepheus_uno_pins.stl` | `0.22 cm³` | `32.40 × 7.40 × 4.18` | White PLA — 4 screwless click-in pins, flat side down, 0 supports |
| `slt2/cepheus_paw_pads.stl` | `0.25 cm³` | `33.00 × 10.20 × 3.60` | White PLA — optional raised paw pads & toe-beans, flat, 0 supports |

## 2. `stl/` — Internal-Hub Edition (`154 × 154 × 136 mm`)

Houses the **Arduino UNO Q**, **8-in-1 USB-C Hub**, and **USB Camera** together inside one unit (`2.6 mm` wall):

- **`stl/cepheus_desk_buddy.3mf`** — Multi-plate Bambu Studio / PrusaSlicer project with `tree(auto)` build-plate-only supports enabled:
  - **Plate 1:** `cepheus_top_shell.stl` *(Peach PLA — `158.60 × 157.83 × 119.65 mm`, `192.58 cm³`)*
  - **Plate 2:** `cepheus_bottom_tray.stl` *(White PLA — `153.93 × 152.72 × 33.80 mm`, `75.29 cm³`, 0 supports)*
  - **Plate 3:** All 5 small White PLA parts together (`cepheus_privacy_visor`, `cepheus_visor_arms`, `cepheus_paw_pads`, `cepheus_hinge_pins`, `cepheus_uno_pins`, max `14.77 mm` height)
- **`stl/cepheus_small_parts_plate.stl`** — Combined single-plate STL containing all 5 small parts (`222.00 × 123.64 × 14.77 mm`, `45.13 cm³`).
- **`stl/*.stl`** — Individual pre-oriented STL parts (`cepheus_privacy_visor.stl` tilted `-86°` face-up at `14.77 mm`; `cepheus_paw_pads.stl` laid flat at `4.70 mm`; `cepheus_uno_pins.stl` flat side down; `cepheus_hinge_pins.stl` wide cap down).

## Other Files & Regenerating

- **`build_enclosure_compact.py`** — Generates `slt2/*.stl` and updates `cepheus_assembly.glb` for the external-hub edition.
- **`build_enclosure.py`** & **`make_3mf.py`** — Generates `stl/*.stl`, `cepheus_enclosure.blend`, `preview_*.png`, and packages `stl/cepheus_desk_buddy.3mf`.

```bash
# Compact external-hub STLs (slt2/) + viewer GLB:
"C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --python hardware/enclosure/build_enclosure_compact.py

# Internal-hub STLs (stl/) + 3-plate .3mf:
"C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --python hardware/enclosure/build_enclosure.py
python hardware/enclosure/make_3mf.py
```

## Viewing the Interactive 3D Explorer (`index.html`)

`index.html` loads Three.js locally from `./node_modules/three` (no external CDN) and displays the compact external-hub `cepheus_assembly.glb` with Sleeping/Awake visor toggle, X-ray shell mode, exploded view slider, and camera presets:

```bash
cd hardware/enclosure
npm ci
npx serve .
```
