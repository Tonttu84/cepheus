"""
Cepheus Bedside Companion — Peach & White Cozy Desk Buddy (100% Solid Filament)
Designed for standard opaque 3D printing (NO translucent filament, NO hardware buttons needed):
  - Soft warm PEACH plump buddy body (`Shell_Top`) with cute rounded ears & stubby arms
  - Clean WARM WHITE base plinth (`Tray_Bottom`) and flip-up Sleep Visor (`Privacy_Visor`)
  - Sculpted cute front PAWS with raised white toe-beans on the lower belly (no button holes!)
  - Peaceful sleeping expression `( ◡   ◡ )` with delicate curved EYELASHES & gentle smile
  - Houses Arduino UNO Q (ABX00162), 8-in-1 USB-C Hub (TPX00241), and round USB Camera (TPX00246)

Usage (headless):
  "C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --python build_enclosure.py
"""

import math
import os
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

# ==============================================================================
# DATASHEET-ACCURATE ENVELOPE + SPACIOUS CABLE BAY (mm)
# ==============================================================================
OUTER_W = 162.0          # Cozy plump width (clears 119 mm TPX00241 + 175 mm pigtail)
OUTER_D = 164.0          # Spacious depth: gives 53+ mm plug/cable bay in front of Hub
BASE_TRAY_H = 26.0       # Clean white base plinth
TOTAL_H = 152.0          # Head dome height (ears rise gently above)
WALL = 3.8
FLOOR_T = 3.2
FRONT_TILT_DEG = 6.0

# Camera window + Flip-Up Sleep Visor Pivot
HEAD_PIVOT_Y = -6.0
HEAD_PIVOT_Z = 92.0
CAM_WINDOW_D = 56.0      # Clean front aperture (inner step seats Ø 62 mm TPX00246 puck)
VISOR_OPEN_DEG = 56.0    # Flips UP 56 deg cleanly in front of the ears

# Arduino UNO Q (ABX00162) — 68.58 x 53.34 mm
UNO_PCB_W = 68.58
UNO_PCB_D = 53.34
UNO_PCB_T = 1.6
UNO_STANDOFF_H = 5.0
UNO_STANDOFF_OD = 6.4
UNO_SCREW_HOLE_D = 2.7
UNO_OFFSET_X = 48.0      # Leaves ~48 mm on left for 175 mm USB-C cable curve
UNO_OFFSET_Y = 8.0       # Front bay: Y = -74.0 .. -20.66 mm
UNO_HOLES = [
    (13.97, 2.54),
    (15.24, 50.80),
    (66.04, 7.62),
    (66.04, 35.56),
]

# Arduino USB-C Hub 8-in-1 (TPX00241) — 119 x 27.8 x 16 mm
# Placed in rear bay with 53.8 mm open plug/bend clearance in front of USB-A ports B2 & B3!
HUB_W = 119.0
HUB_D = 27.8
HUB_H = 16.0
HUB_CENTER_Y = 47.0      # Y = +33.1 .. +60.9 mm
REAR_HUB_WINDOW_W = 92.0
REAR_HUB_WINDOW_H = 16.5

# Arduino USB Camera (TPX00246) — Ø 62 mm round ring-light puck + 60 x 40 mm clip
CAM_HEAD_D = 62.0
CAM_HEAD_T = 22.0
CAM_CENTER_Z = 94.0

# Sculpted cute front paws on lower belly (replaces physical buttons)
PAW_SPACING = 68.0
PAW_CENTER_Z = 42.0

# Screwless Shell Connectors (Front Hook + 2 PLA-Safe Cantilever Snap-Tabs + Split Visor Pins)
LIP_H = 2.8
LIP_CLEARANCE = 0.25
SNAP_Y = 12.0            # Side snap-tab center Y (between UNO Q and Hub)
SNAP_W = 14.0            # Tab width along Y
SNAP_ARM_T = 1.6         # Flex arm thickness
SNAP_ARM_H = 11.0        # Flex height above BASE_TRAY_H
SNAP_BARB_OUT = 1.0      # Outward catch barb depth
VISOR_PIN_D = 8.0        # Compliant split snap-pin diameter on HingeNub
VISOR_HOLE_D = 8.4       # Matching bore in VisorPivot (0.2 mm radial clearance)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
STL_DIR = os.path.join(OUT_DIR, "stl")


# ==============================================================================
# HELPERS
# ==============================================================================
def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 0.001
    return scene


def apply_boolean(target_obj, cutter_obj, operation="DIFFERENCE"):
    mod = target_obj.modifiers.new(name=f"Bool_{cutter_obj.name}", type="BOOLEAN")
    mod.operation = operation
    mod.solver = "EXACT"
    mod.object = cutter_obj
    bpy.context.view_layer.objects.active = target_obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter_obj, do_unlink=True)


def fix_normals_and_check_manifold(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-4, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.edges.ensure_lookup_table()
    non_manifold = sum(1 for e in bm.edges if not e.is_manifold)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return non_manifold


def make_material(name, color_rgba, roughness=0.58, metallic=0.0):
    mat = bpy.data.materials.new(name)
    if not getattr(mat, "node_tree", None):
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color_rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return mat


def set_obj_material(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.material_index = 0


def set_smooth_shading(obj, auto_angle_deg=35.0):
    for poly in obj.data.polygons:
        poly.use_smooth = True
    mod = obj.modifiers.new(name="SharpCutoutRims", type="EDGE_SPLIT")
    mod.split_angle = math.radians(auto_angle_deg)
    mod.use_edge_angle = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def superellipse_point(theta, rx, ry, power=2.5):
    c = math.cos(theta)
    s = math.sin(theta)
    x = math.copysign(abs(c) ** (2.0 / power), c) * rx
    y = math.copysign(abs(s) ** (2.0 / power), s) * ry
    return x, y


def buddy_section_params(z, shrink=0.0):
    h = TOTAL_H - shrink
    z_clamped = max(0.0, min(z, h))

    if z_clamped < 26.0:
        u = z_clamped / 26.0
        w_scale = 0.93 + 0.07 * math.sin(u * math.pi * 0.5)
    elif z_clamped < 86.0:
        u = (z_clamped - 26.0) / 60.0
        w_scale = 1.0 - 0.08 * (u ** 1.4)
    else:
        u = min(1.0, (z_clamped - 86.0) / max(1.0, h - 86.0))
        w_scale = 0.92 * math.sqrt(max(0.03, 1.0 - (u ** 2.0) * 0.97))

    rx = max(4.0, (OUTER_W / 2.0) * w_scale - shrink)
    ry = max(4.0, (OUTER_D / 2.0) * w_scale - shrink)
    lean_y = z_clamped * math.tan(math.radians(FRONT_TILT_DEG)) * 0.40
    power = 2.65 - 0.65 * max(0.0, (z_clamped - 55.0) / max(1.0, TOTAL_H - 55.0))
    return rx, ry, lean_y, power


def create_buddy_hull(name, shrink=0.0, z_min=0.0, z_max=None, radial_segs=84):
    if z_max is None:
        z_max = TOTAL_H - shrink

    z_levels = []
    z = z_min
    while z < z_max - 1.0:
        z_levels.append(z)
        step = 3.5 if z < 84.0 else 1.8
        z += step
    z_levels.append(z_max)

    bm = bmesh.new()
    rings = []
    for zl in z_levels:
        rx, ry, cy, p = buddy_section_params(zl, shrink=shrink)
        ring = []
        for i in range(radial_segs):
            th = (2.0 * math.pi * i) / radial_segs
            px, py = superellipse_point(th, rx, ry, power=p)
            ring.append(bm.verts.new((px, py + cy, zl)))
        rings.append(ring)

    bm.faces.new(list(reversed(rings[0])))

    for r_idx in range(len(rings) - 1):
        r0 = rings[r_idx]
        r1 = rings[r_idx + 1]
        for i in range(radial_segs):
            ni = (i + 1) % radial_segs
            bm.faces.new((r0[i], r0[ni], r1[ni], r1[i]))

    top_ring = rings[-1]
    _, _, cy_t, _ = buddy_section_params(z_max, shrink=shrink)
    top_center = bm.verts.new((0.0, cy_t, z_max + 0.9))
    for i in range(radial_segs):
        ni = (i + 1) % radial_segs
        bm.faces.new((top_ring[i], top_ring[ni], top_center))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def front_y_at(x, z):
    rx, ry, cy, p = buddy_section_params(z, shrink=0.0)
    u = min(0.95, abs(x) / max(1.0, rx))
    y_rel = -ry * ((1.0 - (u ** p)) ** (1.0 / p))
    return cy + y_rel


def front_normal_at(x, z):
    dx = 1.5
    dz = 1.5
    yx0 = front_y_at(x - dx, z)
    yx1 = front_y_at(x + dx, z)
    yz0 = front_y_at(x, max(0.0, z - dz))
    yz1 = front_y_at(x, min(TOTAL_H - 5.0, z + dz))
    tx = Vector((2.0 * dx, yx1 - yx0, 0.0))
    tz = Vector((0.0, yz1 - yz0, 2.0 * dz))
    n = tz.cross(tx)
    if n.y > 0:
        n = -n
    n.normalize()
    return n


def orient_along_normal(obj, x, z, inset_depth=0.0, local_axis="Y_NEG"):
    y = front_y_at(x, z)
    n = front_normal_at(x, z)
    pos = Vector((x, y, z)) - n * inset_depth
    if local_axis == "Z_POS":
        rot = n.to_track_quat("Z", "Y").to_euler("XYZ")
    else:
        rot = (-n).to_track_quat("Y", "Z").to_euler("XYZ")
    obj.location = pos
    obj.rotation_euler = rot


def create_rounded_prism(name, size_x, size_y, size_z, radius=0.0, z_min=0.0, segments=12):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    hx = size_x / 2.0
    hy = size_y / 2.0
    r = max(0.0, min(radius, hx * 0.48, hy * 0.48))

    bm = bmesh.new()
    if r > 0.01:
        corners = [
            (hx - r, hy - r, 0.0),
            (-hx + r, hy - r, math.pi * 0.5),
            (-hx + r, -hy + r, math.pi),
            (hx - r, -hy + r, math.pi * 1.5),
        ]
        verts_bot = []
        for cx, cy, start_a in corners:
            for s in range(segments + 1):
                ang = start_a + (math.pi * 0.5) * (s / segments)
                verts_bot.append(bm.verts.new((cx + r * math.cos(ang), cy + r * math.sin(ang), z_min)))
        base_face = bm.faces.new(verts_bot)
        res = bmesh.ops.extrude_face_region(bm, geom=[base_face])
        top_verts = [g for g in res["geom"] if isinstance(g, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=(0.0, 0.0, size_z), verts=top_verts)
    else:
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(size_x, size_y, size_z), verts=bm.verts)
        bmesh.ops.translate(bm, vec=(0.0, 0.0, z_min + size_z / 2.0), verts=bm.verts)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return obj


def create_cylinder(name, diameter, length, segments=48):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=diameter / 2.0,
        radius2=diameter / 2.0,
        depth=length,
    )
    bm.to_mesh(mesh)
    bm.free()
    return obj


def create_tube_ring(name, outer_d, inner_d, length, segments=48):
    outer = create_cylinder(name, outer_d, length, segments)
    inner = create_cylinder(f"{name}_Inner", inner_d, length + 2.0, segments)
    apply_boolean(outer, inner, "DIFFERENCE")
    return outer


def create_ellipsoid(name, rx, ry, rz, u_segs=32, v_segs=24):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u_segs, v_segments=v_segs, radius=1.0)
    bmesh.ops.scale(bm, vec=(rx, ry, rz), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return obj


def wrap_2d_polygon_on_cylinder(name, pts_2d, dr_back, dr_front, half_x=77.0, r_out=83.0):
    """Projects a 2D (px, pz) polygon onto the exact curved Privacy_Visor outer surface."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    def surf_pt(px, pz, dr):
        u = max(-0.95, min(0.95, px / half_x))
        r_surf = r_out * math.sqrt(max(0.34, 1.0 - 0.16 * (u ** 2)))
        th_z = pz / r_surf
        r = r_surf + dr
        return (px, -r * math.cos(th_z), r * math.sin(th_z))

    bm = bmesh.new()
    verts_back = [bm.verts.new(surf_pt(px, pz, dr_back)) for (px, pz) in pts_2d]
    verts_front = [bm.verts.new(surf_pt(px, pz, dr_front)) for (px, pz) in pts_2d]

    bm.faces.new(list(reversed(verts_back)))
    bm.faces.new(verts_front)
    n = len(pts_2d)
    for i in range(n):
        ni = (i + 1) % n
        bm.faces.new((verts_back[i], verts_back[ni], verts_front[ni], verts_front[i]))

    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return obj


def create_arc_smile_ribbon(name, radius, span_deg, thickness, dr_back, dr_front, x_off=0.0, z_off=0.0, segs=22):
    pts_2d = []
    a0 = math.radians(-90.0 - span_deg / 2.0)
    a1 = math.radians(-90.0 + span_deg / 2.0)
    r_in = radius - thickness / 2.0
    r_out = radius + thickness / 2.0

    for i in range(segs + 1):
        a = a0 + (a1 - a0) * (i / segs)
        pts_2d.append((x_off + r_out * math.cos(a), z_off + r_out * math.sin(a) + radius * 0.6))
    for i in range(segs, -1, -1):
        a = a0 + (a1 - a0) * (i / segs)
        pts_2d.append((x_off + r_in * math.cos(a), z_off + r_in * math.sin(a) + radius * 0.6))

    return wrap_2d_polygon_on_cylinder(name, pts_2d, dr_back, dr_front)


def create_eyelash_stroke(name, x_eye_center, z_eye_center, side, arc_ang_deg, lash_dir_deg, lash_len, thickness, dr_back, dr_front, arc_r=9.0):
    """Creates one cute tapered eyelash flick extending cleanly on the exact visor surface."""
    ang_on_arc = math.radians(-90.0 + side * arc_ang_deg)
    sx = x_eye_center + (arc_r + 0.2) * math.cos(ang_on_arc)
    sz = z_eye_center + arc_r * 0.6 + (arc_r + 0.2) * math.sin(ang_on_arc)

    dir_rad = math.radians(lash_dir_deg)
    dx = side * math.cos(dir_rad)
    dz = math.sin(dir_rad)
    nx = -dz
    nz = dx
    hw = thickness / 2.0

    ex = sx + dx * lash_len
    ez = sz + dz * lash_len
    pts_2d = [
        (sx - nx * hw, sz - nz * hw),
        (ex - nx * hw * 0.35, ez - nz * hw * 0.35),
        (ex + nx * hw * 0.35, ez + nz * hw * 0.35),
        (sx + nx * hw, sz + nz * hw),
    ]
    if side < 0:
        pts_2d.reverse()
    return wrap_2d_polygon_on_cylinder(name, pts_2d, dr_back, dr_front)


def create_front_hook_wedge(name, width_x, height_z, depth_y):
    """Printable 45-deg underside ramped hook pointing forward (-Y) so it needs zero supports."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    hx = width_x / 2.0
    hh = height_z / 2.0
    pts_yz = [
        (0.7, -hh),
        (0.7, hh),
        (-depth_y, hh),
        (-depth_y, hh * 0.15),
    ]
    bm = bmesh.new()
    v_left = [bm.verts.new((-hx, py, pz)) for (py, pz) in pts_yz]
    v_right = [bm.verts.new((hx, py, pz)) for (py, pz) in pts_yz]
    bm.faces.new(list(reversed(v_left)))
    bm.faces.new(v_right)
    n = len(pts_yz)
    for i in range(n):
        ni = (i + 1) % n
        bm.faces.new((v_left[i], v_right[i], v_right[ni], v_left[ni]))
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return obj


def create_flip_sleep_visor(name, x_span=154.0, r_in=79.2, r_out=83.0, theta_min_deg=-28.0, theta_max_deg=36.0):
    """
    100% solid-filament curved Sleep Mask (prints upright with 0 supports on the sleeping face!)
    plus detachable flat-printed Visor Arms & Hinge Snap-Pins for support-free PLA printing.
    """
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    nx = 48
    nt = 24
    half_x = x_span / 2.0

    def hood_point(ix, it, r_offset):
        u = (ix / nx) * 2.0 - 1.0
        v = it / nt
        x = u * half_x
        arch = math.sqrt(max(0.06, 1.0 - (u ** 2) * 0.92))
        mid_th = (theta_min_deg + theta_max_deg) * 0.5 * (1.0 - 0.80 * (u ** 2))
        half_span = ((theta_max_deg - theta_min_deg) * 0.5) * arch
        th_deg = mid_th + (v * 2.0 - 1.0) * half_span
        th = math.radians(th_deg)
        r = r_offset * math.sqrt(max(0.34, 1.0 - 0.16 * (u ** 2)))
        y = -r * math.cos(th)
        z = r * math.sin(th)
        return (x, y, z)

    grid_in = [[bm.verts.new(hood_point(ix, it, r_in)) for it in range(nt + 1)] for ix in range(nx + 1)]
    grid_out = [[bm.verts.new(hood_point(ix, it, r_out)) for it in range(nt + 1)] for ix in range(nx + 1)]

    for ix in range(nx):
        for it in range(nt):
            bm.faces.new((grid_out[ix][it], grid_out[ix + 1][it], grid_out[ix + 1][it + 1], grid_out[ix][it + 1]))
            bm.faces.new((grid_in[ix][it], grid_in[ix][it + 1], grid_in[ix + 1][it + 1], grid_in[ix + 1][it]))

    for ix in range(nx):
        bm.faces.new((grid_in[ix][0], grid_in[ix + 1][0], grid_out[ix + 1][0], grid_out[ix][0]))
        bm.faces.new((grid_out[ix][nt], grid_out[ix + 1][nt], grid_in[ix + 1][nt], grid_in[ix][nt]))

    for it in range(nt):
        bm.faces.new((grid_in[0][it], grid_out[0][it], grid_out[0][it + 1], grid_in[0][it + 1]))
        bm.faces.new((grid_out[nx][it], grid_in[nx][it], grid_in[nx][it + 1], grid_out[nx][it + 1]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    # Side peg sockets on Privacy_Visor so the flat-printed Visor Arms snap/glue cleanly onto the mask edges
    for side in [-1.0, 1.0]:
        tab_slot = create_rounded_prism(f"VisorArmSlot_{side}", 4.0, 6.0, 12.0, 0.5, -6.0)
        tab_slot.location = Vector((side * (half_x - 2.0), -69.5, 0.0))
        apply_boolean(obj, tab_slot, "DIFFERENCE")

    # Cute debossed sleeping eyes `( ◡   ◡ )` + eyelashes + tiny smile directly on the white visor STL!
    for side in [-1.0, 1.0]:
        eye_cut = create_arc_smile_ribbon(
            f"SleepEyeCut_{side}", radius=9.0, span_deg=115.0, thickness=2.6, dr_back=-1.2, dr_front=1.5, x_off=side * 19.0, z_off=6.0
        )
        apply_boolean(obj, eye_cut, "DIFFERENCE")

        for l_idx, (arc_off, dir_deg, l_len) in enumerate([(30.0, -52.0, 4.8), (46.0, -30.0, 5.4), (58.0, -8.0, 5.0)]):
            lash = create_eyelash_stroke(
                f"LashCut_{side}_{l_idx}", side * 19.0, 6.0, side, arc_off, dir_deg, l_len, 1.7, -1.2, 1.5
            )
            apply_boolean(obj, lash, "DIFFERENCE")

    smile_cut = create_arc_smile_ribbon(
        "SleepSmileCut", radius=7.5, span_deg=90.0, thickness=2.2, dr_back=-1.2, dr_front=1.5, x_off=0.0, z_off=-5.5
    )
    apply_boolean(obj, smile_cut, "DIFFERENCE")

    obj.location = Vector((0.0, HEAD_PIVOT_Y, HEAD_PIVOT_Z))
    return obj


def build_visor_arms_and_pins():
    """
    Separate flat-printable side temple arms (`Visor_Arms`) + 2 compliant split snap-pins (`Hinge_Pins`)
    so there are ZERO horizontal cantilevers or supports during PLA printing!
    """
    half_x = 154.0 / 2.0
    arms = []
    for side in [-1.0, 1.0]:
        arm = create_rounded_prism(f"VisorArm_{side}", 5.0, 74.0, 11.5, 2.4, -5.75)
        arm.location = Vector((side * (half_x - 1.6), -36.0, 0.0))

        tab = create_rounded_prism(f"ArmFrontTab_{side}", 3.6, 5.5, 11.0, 0.4, -5.5)
        tab.location = Vector((side * (half_x - 2.0), -71.0, 0.0))
        apply_boolean(arm, tab, "UNION")

        ear_pivot = create_cylinder(f"VisorPivot_{side}", 22.0, 5.5, 36)
        ear_pivot.rotation_euler = Euler((0.0, math.pi / 2.0, 0.0), "XYZ")
        ear_pivot.location = Vector((side * (half_x - 1.6), 0.0, 0.0))
        apply_boolean(arm, ear_pivot, "UNION")

        pin_bore = create_cylinder(f"VisorPinBore_{side}", VISOR_HOLE_D, 14.0, 32)
        pin_bore.rotation_euler = Euler((0.0, math.pi / 2.0, 0.0), "XYZ")
        pin_bore.location = Vector((side * (half_x - 1.6), 0.0, 0.0))
        apply_boolean(arm, pin_bore, "DIFFERENCE")

        pin_cbore = create_cylinder(f"VisorPinCBore_{side}", VISOR_HOLE_D + 1.4, 3.0, 32)
        pin_cbore.rotation_euler = Euler((0.0, math.pi / 2.0, 0.0), "XYZ")
        pin_cbore.location = Vector((side * (half_x - 1.6 + 2.5), 0.0, 0.0))
        apply_boolean(arm, pin_cbore, "DIFFERENCE")
        arms.append(arm)

    arms_group = join_objects(arms, "Visor_Arms")
    bpy.ops.object.select_all(action="DESELECT")
    arms_group.select_set(True)
    bpy.context.view_layer.objects.active = arms_group
    bpy.ops.object.transform_apply(location=True, rotation=True)
    arms_group.location = Vector((0.0, HEAD_PIVOT_Y, HEAD_PIVOT_Z))

    pins = []
    for side in [-1.0, 1.0]:
        shaft = create_cylinder(f"HingePin_{side}", VISOR_PIN_D, 13.0, 32)
        shaft.rotation_euler = Euler((0.0, math.pi / 2.0, 0.0), "XYZ")
        shaft.location = Vector((side * 73.5, 0.0, 0.0))

        cap = create_cylinder(f"HingeCap_{side}", VISOR_PIN_D + 1.6, 1.8, 32)
        cap.rotation_euler = Euler((0.0, math.pi / 2.0, 0.0), "XYZ")
        cap.location = Vector((side * 79.2, 0.0, 0.0))
        apply_boolean(shaft, cap, "UNION")

        inner_lip = create_cylinder(f"HingeInnerLip_{side}", VISOR_PIN_D + 0.8, 1.8, 32)
        inner_lip.rotation_euler = Euler((0.0, math.pi / 2.0, 0.0), "XYZ")
        inner_lip.location = Vector((side * 67.6, 0.0, 0.0))
        apply_boolean(shaft, inner_lip, "UNION")

        split = create_rounded_prism(f"HingeSplit_{side}", 7.0, 12.0, 1.5, 0.2, -0.75)
        split.location = Vector((side * 69.5, 0.0, 0.0))
        apply_boolean(shaft, split, "DIFFERENCE")
        pins.append(shaft)

    pins_group = join_objects(pins, "Hinge_Pins")
    bpy.ops.object.select_all(action="DESELECT")
    pins_group.select_set(True)
    bpy.context.view_layer.objects.active = pins_group
    bpy.ops.object.transform_apply(location=True, rotation=True)
    pins_group.location = Vector((0.0, HEAD_PIVOT_Y, HEAD_PIVOT_Z))

    return arms_group, pins_group


def build_uno_click_pins():
    """
    4x screwless click-in PLA push-pins that press down through the Arduino UNO Q holes (3.2 mm)
    into the existing 2.7 mm standoff pilot holes — zero metal screws needed, zero changes to Tray_Bottom!
    Returns (assembled_glb_obj, flat_stl_obj).
    """
    def make_one_pin(name):
        # Cap (Ø 5.6 mm x 1.8 mm)
        cap = create_cylinder(name, 5.6, 1.8, 28)
        cap.location = Vector((0.0, 0.0, 0.9))

        # PCB centering collar (Ø 2.95 mm x 1.6 mm below cap)
        collar = create_cylinder(f"{name}_Collar", 2.95, UNO_PCB_T + 0.4, 24)
        collar.location = Vector((0.0, 0.0, -(UNO_PCB_T * 0.5)))
        apply_boolean(cap, collar, "UNION")

        # Standoff push-stem (Ø 2.55 mm x 5.0 mm) + slight 2.78 mm snap-bulge near tip
        stem = create_cylinder(f"{name}_Stem", 2.55, 5.0, 24)
        stem.location = Vector((0.0, 0.0, -UNO_PCB_T - 2.5))
        apply_boolean(cap, stem, "UNION")

        bulge = create_ellipsoid(f"{name}_Bulge", 1.40, 1.40, 1.25, 20, 14)
        bulge.location = Vector((0.0, 0.0, -UNO_PCB_T - 3.0))
        apply_boolean(cap, bulge, "UNION")

        # Compliant split slot along stem so PLA squeezes smoothly into the 2.7 mm standoff hole
        split = create_rounded_prism(f"{name}_Split", 0.65, 4.0, 4.4, 0.0, -UNO_PCB_T - 5.2)
        apply_boolean(cap, split, "DIFFERENCE")

        # Trim one side of the Ø 5.6 mm cap flat at Y = -1.28 mm (flush with shaft radius) so pin prints
        # lying flat on the bed with strong longitudinal layer lines and 0 supports!
        flat_trim = create_rounded_prism(f"{name}_Flat", 8.0, 4.0, 4.0, 0.0, -1.0)
        flat_trim.location = Vector((0.0, -3.28, 0.0))
        apply_boolean(cap, flat_trim, "DIFFERENCE")
        return cap

    # 1) Assembled pins seated on the 4 Arduino UNO Q standoffs (for GLB)
    pcb_origin_x = -OUTER_W / 2.0 + UNO_OFFSET_X
    pcb_origin_y = -OUTER_D / 2.0 + UNO_OFFSET_Y
    pcb_top_z = FLOOR_T + UNO_STANDOFF_H + UNO_PCB_T
    glb_pins = []
    for idx, (hx, hy) in enumerate(UNO_HOLES):
        p = make_one_pin(f"UnoClickPin_{idx}")
        p.location = Vector((pcb_origin_x + hx, pcb_origin_y + hy, pcb_top_z))
        glb_pins.append(p)
    glb_group = join_objects(glb_pins, "HW_UNO_Pins")

    # 2) Flat bed-printable set of 4 pins laid side-by-side on Z = 0 (for cepheus_uno_pins.stl)
    stl_pins = []
    for idx in range(4):
        p = make_one_pin(f"UnoPinSTL_{idx}")
        p.rotation_euler = Euler((-math.pi / 2.0, 0.0, 0.0), "XYZ")
        p.location = Vector((-13.5 + idx * 9.0, 0.0, 1.28))
        bpy.ops.object.select_all(action="DESELECT")
        p.select_set(True)
        bpy.context.view_layer.objects.active = p
        bpy.ops.object.transform_apply(location=True, rotation=True)
        stl_pins.append(p)
    stl_group = join_objects(stl_pins, "UNO_Click_Pins")

    return glb_group, stl_group


def export_split_flat_stl(obj, x_split_offset, filename):
    """Exports Left & Right halves side-by-side flat on Z=0 for 0-support PLA printing."""
    dup_l = obj.copy()
    dup_l.data = obj.data.copy()
    bpy.context.collection.objects.link(dup_l)
    # Keep only X < 0 verts in dup_l, X > 0 in dup_r
    bm = bmesh.new()
    bm.from_mesh(dup_l.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.x > 0.0], context="VERTS")
    bm.to_mesh(dup_l.data)
    bm.free()

    dup_r = obj.copy()
    dup_r.data = obj.data.copy()
    bpy.context.collection.objects.link(dup_r)
    bm = bmesh.new()
    bm.from_mesh(dup_r.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.x < 0.0], context="VERTS")
    bm.to_mesh(dup_r.data)
    bm.free()

    for d, rot_y, x_pos in [(dup_l, math.pi / 2.0, -x_split_offset), (dup_r, -math.pi / 2.0, x_split_offset)]:
        d.location = Vector((0.0, 0.0, 0.0))
        d.rotation_euler = Euler((0.0, rot_y, 0.0), "XYZ")
        bpy.ops.object.select_all(action="DESELECT")
        d.select_set(True)
        bpy.context.view_layer.objects.active = d
        bpy.ops.object.transform_apply(rotation=True)
        min_z = min(v.co.z for v in d.data.vertices)
        cx = (min(v.co.x for v in d.data.vertices) + max(v.co.x for v in d.data.vertices)) * 0.5
        for v in d.data.vertices:
            v.co.x += x_pos - cx
            v.co.z -= min_z

    flat_pair = join_objects([dup_l, dup_r], "TmpFlatPair")
    path = export_stl_object(flat_pair, filename)
    bpy.data.objects.remove(flat_pair, do_unlink=True)
    return path


def build_visor_face_inlay():
    """Visual dark-espresso inlay inside the sleeping-eye grooves, eyelashes & smile."""
    mat_espresso = make_material("WarmEspressoPLA", (0.24, 0.19, 0.16, 1.0), 0.55)

    parts = []
    smile = create_arc_smile_ribbon(
        "SleepSmileInlay", radius=7.5, span_deg=86.0, thickness=1.9, dr_back=-0.6, dr_front=0.25, x_off=0.0, z_off=-5.5
    )
    set_obj_material(smile, mat_espresso)
    parts.append(smile)

    for side in [-1.0, 1.0]:
        eye = create_arc_smile_ribbon(
            f"SleepEyeInlay_{side}", radius=9.0, span_deg=112.0, thickness=2.2, dr_back=-0.6, dr_front=0.25, x_off=side * 19.0, z_off=6.0
        )
        set_obj_material(eye, mat_espresso)
        parts.append(eye)

        for l_idx, (arc_off, dir_deg, l_len) in enumerate([(30.0, -52.0, 4.6), (46.0, -30.0, 5.2), (58.0, -8.0, 4.8)]):
            lash = create_eyelash_stroke(
                f"LashInlay_{side}_{l_idx}", side * 19.0, 6.0, side, arc_off, dir_deg, l_len, 1.45, -0.6, 0.25
            )
            set_obj_material(lash, mat_espresso)
            parts.append(lash)

    group = join_objects(parts, "Sleep_Face_Inlay")
    group.location = Vector((0.0, HEAD_PIVOT_Y, HEAD_PIVOT_Z))
    return group


def create_curve_cable(name, points, radius=2.1, mat=None):
    curve_data = bpy.data.curves.new(name, type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 16
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 4

    spline = curve_data.splines.new("NURBS")
    spline.points.add(len(points) - 1)
    for idx, pt in enumerate(points):
        spline.points[idx].co = (pt[0], pt[1], pt[2], 1.0)
    spline.use_endpoint_u = True

    curve_obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(curve_obj)

    bpy.ops.object.select_all(action="DESELECT")
    curve_obj.select_set(True)
    bpy.context.view_layer.objects.active = curve_obj
    bpy.ops.object.convert(target="MESH")
    if mat is not None:
        set_obj_material(curve_obj, mat)
    return curve_obj


def join_objects(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def create_snap_barb_wedge(name, width_y, height_z, depth_x, side_sign):
    """Creates a printable 45-deg ramped snap barb pointing outward in side_sign * X."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    hw = width_y / 2.0
    hh = height_z / 2.0
    # Cross section in (X, Z): flat inner face at x=0, 45-deg top ramp, steep 55-deg bottom catch
    pts_xz = [
        (0.0, -hh),
        (side_sign * depth_x, -hh * 0.25),
        (side_sign * depth_x, hh * 0.20),
        (0.0, hh),
    ]
    bm = bmesh.new()
    v_front = [bm.verts.new((px, -hw, pz)) for (px, pz) in pts_xz]
    v_back = [bm.verts.new((px, hw, pz)) for (px, pz) in pts_xz]
    if side_sign > 0:
        bm.faces.new(list(reversed(v_front)))
        bm.faces.new(v_back)
    else:
        bm.faces.new(v_front)
        bm.faces.new(list(reversed(v_back)))
    n = len(pts_xz)
    for i in range(n):
        ni = (i + 1) % n
        bm.faces.new((v_front[i], v_front[ni], v_back[ni], v_back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return obj


def build_bottom_tray():
    tray = create_buddy_hull("Tray_Bottom", shrink=0.0, z_min=0.0, z_max=TOTAL_H)
    top_slice = create_rounded_prism("TopSlice", OUTER_W + 40.0, OUTER_D + 40.0, TOTAL_H + 20.0, 0.0, BASE_TRAY_H)
    apply_boolean(tray, top_slice, "DIFFERENCE")

    inner_cut = create_buddy_hull("TrayInner", shrink=WALL, z_min=FLOOR_T, z_max=BASE_TRAY_H + 20.0)
    apply_boolean(tray, inner_cut, "DIFFERENCE")

    # Open-top rear U-notch for Hub ports (zero horizontal bridging / zero supports!)
    _, ry_b, cy_b, _ = buddy_section_params(BASE_TRAY_H * 0.5, shrink=0.0)
    rear_win = create_rounded_prism(
        "RearHubWindow", REAR_HUB_WINDOW_W, 32.0, BASE_TRAY_H + 12.0, 4.0, FLOOR_T + 2.5
    )
    rear_win.location = Vector((0.0, cy_b + ry_b - 2.0, 0.0))
    apply_boolean(tray, rear_win, "DIFFERENCE")

    for i in range(4):
        vent = create_rounded_prism(f"Vent_{i}", 24.0, 3.4, 9.0, 1.5, FLOOR_T + 3.5)
        vent.location = Vector((OUTER_W / 2.0 - 4.0, -14.0 + i * 11.5, 0.0))
        apply_boolean(tray, vent, "DIFFERENCE")

    pcb_origin_x = -OUTER_W / 2.0 + UNO_OFFSET_X
    pcb_origin_y = -OUTER_D / 2.0 + UNO_OFFSET_Y
    for idx, (hx, hy) in enumerate(UNO_HOLES):
        sx = pcb_origin_x + hx
        sy = pcb_origin_y + hy
        post = create_cylinder(f"UnoStandoff_{idx}", UNO_STANDOFF_OD, UNO_STANDOFF_H + 0.8, 24)
        post.location = Vector((sx, sy, FLOOR_T + UNO_STANDOFF_H / 2.0 - 0.4))
        apply_boolean(tray, post, "UNION")

        pilot = create_cylinder(f"UnoPilot_{idx}", UNO_SCREW_HOLE_D, UNO_STANDOFF_H + 1.5, 20)
        pilot.location = Vector((sx, sy, FLOOR_T + UNO_STANDOFF_H / 2.0 + 0.5))
        apply_boolean(tray, pilot, "DIFFERENCE")

    for rx in [-38.0, 38.0]:
        rail = create_rounded_prism(f"HubRail_{rx}", 8.0, HUB_D - 2.0, 3.0, 1.0, FLOOR_T - 0.5)
        rail.location = Vector((rx, HUB_CENTER_Y, 0.0))
        apply_boolean(tray, rail, "UNION")
    hub_stop = create_rounded_prism("HubFrontStop", 84.0, 2.5, 6.0, 1.0, FLOOR_T - 0.5)
    hub_stop.location = Vector((0.0, HUB_CENTER_Y - HUB_D / 2.0 - 2.2, 0.0))
    apply_boolean(tray, hub_stop, "UNION")

    # Alignment lip around perimeter
    lip_outer = create_buddy_hull("LipOuter", shrink=WALL * 0.52, z_min=BASE_TRAY_H - 0.6, z_max=BASE_TRAY_H + LIP_H)
    lip_inner = create_buddy_hull(
        "LipInner", shrink=WALL - 0.3, z_min=BASE_TRAY_H - 1.2, z_max=BASE_TRAY_H + LIP_H + 0.6
    )
    apply_boolean(lip_outer, lip_inner, "DIFFERENCE")
    apply_boolean(tray, lip_outer, "UNION")

    # 1) Screwless Front Tongue Hook (reuses tested 45-deg ramped wedge rotated -90 deg -> points -Y)
    _, ry_lip, cy_lip, _ = buddy_section_params(BASE_TRAY_H, shrink=WALL * 0.52)
    front_hook = create_snap_barb_wedge("FrontHookTab", 18.0, 2.4, 1.8, 1.0)
    front_hook.rotation_euler = Euler((0.0, 0.0, -math.pi / 2.0), "XYZ")
    front_hook.location = Vector((0.0, cy_lip - ry_lip + 0.65, BASE_TRAY_H + 1.5))
    apply_boolean(tray, front_hook, "UNION")

    # 2) Two Wide PLA-Safe Cantilever Snap-Tabs at left & right (X = ±75 mm, Y = +12 mm)
    rx_lip, _, _, _ = buddy_section_params(BASE_TRAY_H, shrink=WALL)
    for side in [-1.0, 1.0]:
        arm_x = side * (rx_lip - SNAP_ARM_T * 0.5 - 1.4)
        arm = create_rounded_prism(
            f"SnapArm_{side}", SNAP_ARM_T, SNAP_W, SNAP_ARM_H + 6.0, 0.0, BASE_TRAY_H - 5.2
        )
        arm.location = Vector((arm_x, SNAP_Y, 0.0))

        # Anchor block slightly wider in Y (SNAP_W + 2.0) and offset inward so zero faces are coplanar
        anchor = create_rounded_prism(f"SnapAnchor_{side}", 4.2, SNAP_W + 2.0, 5.5, 0.0, BASE_TRAY_H - 6.0)
        anchor.location = Vector((side * (rx_lip - 0.6), SNAP_Y, 0.0))

        barb = create_snap_barb_wedge(f"SnapBarb_{side}", SNAP_W - 0.8, 3.0, SNAP_BARB_OUT + 0.5, side)
        barb.location = Vector((arm_x + side * (SNAP_ARM_T * 0.5 - 0.3), SNAP_Y, BASE_TRAY_H + SNAP_ARM_H - 1.8))

        apply_boolean(tray, anchor, "UNION")
        apply_boolean(tray, arm, "UNION")
        apply_boolean(tray, barb, "UNION")

    return tray


def build_top_shell():
    shell = create_buddy_hull("Shell_Top", shrink=0.0, z_min=0.0, z_max=TOTAL_H)
    bot_slice = create_rounded_prism("BotSlice", OUTER_W + 40.0, OUTER_D + 40.0, BASE_TRAY_H + 10.0, 0.0, -10.0)
    apply_boolean(shell, bot_slice, "DIFFERENCE")

    inner_wedge = create_buddy_hull("InnerBuddy", shrink=WALL, z_min=BASE_TRAY_H - 5.0, z_max=TOTAL_H - WALL)
    apply_boolean(shell, inner_wedge, "DIFFERENCE")

    groove = create_buddy_hull(
        "MateGroove", shrink=WALL * 0.52 - LIP_CLEARANCE, z_min=BASE_TRAY_H - 0.2, z_max=BASE_TRAY_H + LIP_H + 0.6
    )
    apply_boolean(shell, groove, "DIFFERENCE")

    # 1) Matching Front Hook Pocket inside front wall (1.4 mm deep so outer wall never breaks through)
    _, ry_lip, cy_lip, _ = buddy_section_params(BASE_TRAY_H, shrink=WALL * 0.52)
    hook_pocket = create_rounded_prism("FrontHookPocket", 23.4, 2.4, 2.8, 0.4, BASE_TRAY_H + 0.6)
    hook_pocket.location = Vector((0.0, cy_lip - ry_lip - 0.3, 0.0))
    apply_boolean(shell, hook_pocket, "DIFFERENCE")

    # 2) Two Snap-Tab Catch Pockets inside left & right walls (no floating bosses!)
    rx_lip, _, _, _ = buddy_section_params(BASE_TRAY_H, shrink=WALL)
    for side in [-1.0, 1.0]:
        pocket_x = side * (rx_lip + 0.3)
        snap_pocket = create_rounded_prism(
            f"SnapPocket_{side}", 2.6, SNAP_W + 1.4, 3.6, 0.6, BASE_TRAY_H + SNAP_ARM_H - 3.6
        )
        snap_pocket.location = Vector((pocket_x, SNAP_Y, 0.0))
        apply_boolean(shell, snap_pocket, "DIFFERENCE")

    # Subtle rear pry-notch at solid rear-left seam (clear of RearHubWindow)
    _, ry_rear_seam, cy_rear_seam, _ = buddy_section_params(BASE_TRAY_H, shrink=0.0)
    pry = create_rounded_prism("RearPryNotch", 12.0, 14.0, 2.4, 1.0, BASE_TRAY_H - 0.2)
    pry.location = Vector((-54.0, cy_rear_seam + ry_rear_seam * 0.80, 0.0))
    apply_boolean(shell, pry, "DIFFERENCE")

    # Cute soft rounded ears (seated safely behind flipped-up visor)
    for side in [-1.0, 1.0]:
        ear = create_ellipsoid(f"CuteEar_{side}", 16.0, 12.0, 20.0, 32, 24)
        ear.rotation_euler = Euler((math.radians(-8.0), side * math.radians(-16.0), 0.0), "XYZ")
        ear.location = Vector((side * 46.0, 16.0, 140.0))
        apply_boolean(shell, ear, "UNION")

    # Cute chubby side arms & visor hinge sockets (NO horizontal pins sticking out -> zero external supports!)
    for side in [-1.0, 1.0]:
        hinge_nub = create_ellipsoid(f"HingeNub_{side}", 7.5, 10.0, 10.0, 28, 20)
        hinge_nub.location = Vector((side * 69.5, HEAD_PIVOT_Y, HEAD_PIVOT_Z))
        apply_boolean(shell, hinge_nub, "UNION")

        pin_socket = create_cylinder(f"HingeSocket_{side}", VISOR_HOLE_D, 14.0, 32)
        pin_socket.rotation_euler = Euler((0.0, math.pi / 2.0, 0.0), "XYZ")
        pin_socket.location = Vector((side * 69.5, HEAD_PIVOT_Y, HEAD_PIVOT_Z))
        apply_boolean(shell, pin_socket, "DIFFERENCE")

        arm_nub = create_ellipsoid(f"ChubbyArm_{side}", 11.0, 15.0, 18.0, 28, 20)
        arm_nub.rotation_euler = Euler((math.radians(14.0), side * math.radians(12.0), 0.0), "XYZ")
        arm_nub.location = Vector((side * 73.0, -8.0, 56.0))
        apply_boolean(shell, arm_nub, "UNION")

    # Cute sculpted front PAWS directly on lower belly (solid body, zero button cutouts!)
    for side in [-1.0, 1.0]:
        px = side * (PAW_SPACING / 2.0)
        paw_mound = create_ellipsoid(f"SculptedPaw_{side}", 13.5, 9.0, 11.5, 32, 24)
        orient_along_normal(paw_mound, px, PAW_CENTER_Z, inset_depth=2.5, local_axis="Y_NEG")
        apply_boolean(shell, paw_mound, "UNION")

    # Stepped circular seat for the Ø 62 mm round Arduino USB Camera (TPX00246)
    cam_seat = create_cylinder("CamCradleCut", CAM_WINDOW_D, 24.0, 48)
    orient_along_normal(cam_seat, 0.0, CAM_CENTER_Z, inset_depth=5.0, local_axis="Z_POS")
    apply_boolean(shell, cam_seat, "DIFFERENCE")

    cam_inner_seat = create_cylinder("CamInnerStep", CAM_HEAD_D + 2.0, 20.0, 48)
    orient_along_normal(cam_inner_seat, 0.0, CAM_CENTER_Z, inset_depth=12.5, local_axis="Z_POS")
    apply_boolean(shell, cam_inner_seat, "DIFFERENCE")

    # Low-rear cooling slots
    _, ry_rear, cy_rear, _ = buddy_section_params(BASE_TRAY_H + 18.0, shrink=0.0)
    for i in range(6):
        vent = create_rounded_prism(f"LowRearVent_{i}", 4.0, 32.0, 11.0, 1.8, BASE_TRAY_H + 10.0)
        vent.location = Vector((-25.0 + i * 10.0, cy_rear + ry_rear - 5.0, 0.0))
        apply_boolean(shell, vent, "DIFFERENCE")

    return shell


def build_paw_pads():
    """
    Cute raised white paw-pad + 3 little toe-bean accents on each sculpted front paw.
    Exported both to cepheus_paw_pads.stl (optional multi-color print) and HW_Paws in GLB.
    """
    mat_white = make_material("WarmWhitePawPLA", (0.97, 0.96, 0.94, 1.0), 0.56)
    pads = []
    for side in [-1.0, 1.0]:
        px = side * (PAW_SPACING / 2.0)
        y_surf = front_y_at(px, PAW_CENTER_Z)
        n_surf = front_normal_at(px, PAW_CENTER_Z)
        rot = (-n_surf).to_track_quat("Y", "Z").to_euler("XYZ")
        rot_mat = rot.to_matrix()
        # Mound peaks ~6.5 mm out from front surface
        mound_front = Vector((px, y_surf, PAW_CENTER_Z)) + n_surf * 6.2

        # Main central paw pad
        main_pad = create_ellipsoid(f"MainPawPad_{side}", 5.6, 1.8, 4.2, 24, 16)
        main_pad.location = mound_front + rot_mat @ Vector((0.0, 0.0, -1.5))
        main_pad.rotation_euler = rot
        set_obj_material(main_pad, mat_white)
        pads.append(main_pad)

        # 3 cute little toe beans arched cleanly above the main pad
        for b_idx, (bx, bz) in enumerate([(-5.2, 4.2), (0.0, 5.6), (5.2, 4.2)]):
            bean = create_ellipsoid(f"ToeBean_{side}_{b_idx}", 2.2, 1.8, 2.5, 20, 14)
            # Follow curved surface of ellipsoid mound slightly inward along Y
            bean.location = mound_front + rot_mat @ Vector((bx, 1.1, bz))
            bean.rotation_euler = rot
            set_obj_material(bean, mat_white)
            pads.append(bean)

    return join_objects(pads, "HW_Paws")


# ==============================================================================
# 2. ACCURATE ARDUINO USB CAMERA (TPX00246) + HARDWARE (Web GLB)
# ==============================================================================
def build_mock_hardware():
    mat_pcb = make_material("ArduinoTealPCB", (0.04, 0.36, 0.38, 1.0), 0.45)
    mat_chip = make_material("DarkSiliconIC", (0.07, 0.07, 0.08, 1.0), 0.35)
    mat_metal = make_material("BrushedMetal", (0.72, 0.74, 0.76, 1.0), 0.28, metallic=0.88)
    mat_hub_plastic = make_material("HubMatteBlack", (0.14, 0.15, 0.16, 1.0), 0.55)
    mat_cable = make_material("MatteBlackCable", (0.08, 0.08, 0.09, 1.0), 0.65)
    mat_cam_black = make_material("ArduinoCamBlack", (0.12, 0.13, 0.14, 1.0), 0.42)
    mat_cam_ring = make_material("ArduinoCamRing", (0.94, 0.94, 0.92, 1.0), 0.28)
    mat_lens = make_material("CameraLens", (0.03, 0.06, 0.12, 1.0), 0.08, metallic=0.20)

    hw_objects = []

    # --- A. Arduino UNO Q (ABX00162: 68.58 x 53.34 mm) ---
    pcb_ox = -OUTER_W / 2.0 + UNO_OFFSET_X
    pcb_oy = -OUTER_D / 2.0 + UNO_OFFSET_Y
    pcb_cx = pcb_ox + UNO_PCB_W / 2.0
    pcb_cy = pcb_oy + UNO_PCB_D / 2.0
    pcb_z = FLOOR_T + UNO_STANDOFF_H

    pcb = create_rounded_prism("UNO_PCB", UNO_PCB_W, UNO_PCB_D, UNO_PCB_T, 1.5, pcb_z)
    pcb.location = Vector((pcb_cx, pcb_cy, 0.0))
    set_obj_material(pcb, mat_pcb)

    usbc = create_rounded_prism("UNO_USBC", 10.0, 9.0, 3.4, 1.0, pcb_z + UNO_PCB_T)
    usbc.location = Vector((pcb_ox + 3.0, pcb_oy + 34.0, 0.0))
    set_obj_material(usbc, mat_metal)

    qrb_soc = create_rounded_prism("UNO_QRB2210", 14.0, 14.0, 1.8, 0.5, pcb_z + UNO_PCB_T)
    qrb_soc.location = Vector((pcb_cx - 4.0, pcb_cy - 4.0, 0.0))
    set_obj_material(qrb_soc, mat_chip)

    led_matrix = create_rounded_prism("UNO_Matrix", 16.0, 12.0, 1.4, 0.4, pcb_z + UNO_PCB_T)
    led_matrix.location = Vector((pcb_cx + 16.0, pcb_cy + 6.0, 0.0))
    set_obj_material(led_matrix, mat_chip)

    hdr_top = create_rounded_prism("UNO_HdrTop", 42.0, 2.6, 8.5, 0.2, pcb_z + UNO_PCB_T)
    hdr_top.location = Vector((pcb_cx + 6.0, pcb_oy + UNO_PCB_D - 2.5, 0.0))
    set_obj_material(hdr_top, mat_chip)

    hdr_bot = create_rounded_prism("UNO_HdrBot", 38.0, 2.6, 8.5, 0.2, pcb_z + UNO_PCB_T)
    hdr_bot.location = Vector((pcb_cx + 8.0, pcb_oy + 2.5, 0.0))
    set_obj_material(hdr_bot, mat_chip)

    uno_group = join_objects([pcb, usbc, qrb_soc, led_matrix, hdr_top, hdr_bot], "HW_Arduino_UNO_Q")
    hw_objects.append(uno_group)

    # --- B. Arduino USB-C Hub 8-in-1 (TPX00241: 119 x 27.8 x 16 mm) ---
    hub_z = FLOOR_T + 2.5
    hub_body = create_rounded_prism("HubBody", HUB_W, HUB_D, HUB_H, 4.0, hub_z)
    hub_body.location = Vector((0.0, HUB_CENTER_Y, 0.0))
    set_obj_material(hub_body, mat_hub_plastic)

    plug_c = create_rounded_prism("HubPlugUSBC", 13.0, 11.0, 5.5, 1.5, pcb_z + 0.5)
    plug_c.location = Vector((pcb_ox - 7.5, pcb_oy + 34.0, 0.0))
    set_obj_material(plug_c, mat_cable)

    pigtail = create_curve_cable(
        "HubPigtail_175mm",
        [
            (pcb_ox - 13.0, pcb_oy + 34.0, pcb_z + 3.2),
            (pcb_ox - 27.0, pcb_oy + 24.0, pcb_z + 10.0),
            (-HUB_W / 2.0 - 8.0, 8.0, hub_z + HUB_H + 12.0),
            (-HUB_W / 2.0 - 8.0, HUB_CENTER_Y - 4.0, hub_z + HUB_H / 2.0 + 3.0),
            (-HUB_W / 2.0 + 1.0, HUB_CENTER_Y, hub_z + HUB_H / 2.0),
        ],
        radius=2.1,
        mat=mat_cable,
    )

    # Realistic 28 mm long USB-A plug head + strain relief plugged into Hub B3 (USB-A 3.0)
    # 53.8 mm total clearance to UNO Q rear edge!
    cam_usba_plug = create_rounded_prism("CamUSBAPlug", 15.0, 28.0, 8.5, 1.5, hub_z + 3.5)
    cam_usba_plug.location = Vector((26.0, HUB_CENTER_Y - HUB_D / 2.0 - 13.5, 0.0))
    set_obj_material(cam_usba_plug, mat_cable)

    hub_group = join_objects(
        [hub_body, plug_c, pigtail, cam_usba_plug],
        "HW_USB_C_Hub_8in1",
    )
    hw_objects.append(hub_group)

    # --- C. Real Arduino USB Camera (TPX00246): round Ø 62 mm ring-light puck + folded clip ---
    cam_puck = create_cylinder("CamRoundPuck", CAM_HEAD_D, CAM_HEAD_T, 48)
    orient_along_normal(cam_puck, 0.0, CAM_CENTER_Z, inset_depth=14.5, local_axis="Z_POS")
    set_obj_material(cam_puck, mat_cam_black)

    cam_ring = create_tube_ring("CamRingDiffuser", CAM_HEAD_D - 6.0, 36.0, 2.4, 48)
    orient_along_normal(cam_ring, 0.0, CAM_CENTER_Z, inset_depth=3.6, local_axis="Z_POS")
    set_obj_material(cam_ring, mat_cam_ring)

    cam_lens = create_cylinder("CamLens", 12.0, 4.0, 32)
    orient_along_normal(cam_lens, 0.0, CAM_CENTER_Z - 2.0, inset_depth=3.6, local_axis="Z_POS")
    set_obj_material(cam_lens, mat_lens)

    cam_clip = create_rounded_prism("CamClipMount", 56.0, 36.0, 20.0, 4.0, CAM_CENTER_Z - 54.0)
    cam_clip.location = Vector((0.0, front_y_at(0.0, CAM_CENTER_Z) + 26.0, 0.0))
    set_obj_material(cam_clip, mat_cam_black)

    cam_neck = create_cylinder("CamNeck", 12.0, 14.0, 24)
    cam_neck.location = Vector((0.0, front_y_at(0.0, CAM_CENTER_Z) + 20.0, CAM_CENTER_Z - 32.0))
    set_obj_material(cam_neck, mat_cam_black)

    cam_cable = create_curve_cable(
        "CamCable",
        [
            (0.0, front_y_at(0.0, CAM_CENTER_Z) + 24.0, CAM_CENTER_Z - 14.0),
            (18.0, -14.0, CAM_CENTER_Z - 36.0),
            (26.0, -4.0, 28.0),
            (26.0, HUB_CENTER_Y - HUB_D / 2.0 - 27.5, hub_z + 7.8),
        ],
        radius=2.0,
        mat=mat_cable,
    )

    cam_group = join_objects([cam_puck, cam_ring, cam_lens, cam_clip, cam_neck, cam_cable], "HW_USB_Camera")
    hw_objects.append(cam_group)

    return hw_objects


# ==============================================================================
# 3. EXPORTS & PREVIEWS (Peach Body + White Base & Visor & Paws)
# ==============================================================================
def assign_enclosure_materials(tray, shell, visor):
    mat_peach = make_material("SoftWarmPeachPLA", (0.98, 0.69, 0.54, 1.0), 0.56)
    mat_white = make_material("CrispWarmWhitePLA", (0.97, 0.96, 0.94, 1.0), 0.54)

    set_obj_material(shell, mat_peach)
    set_obj_material(tray, mat_white)
    set_obj_material(visor, mat_white)


def export_stl_object(obj, filename, target_dir=STL_DIR):
    os.makedirs(target_dir, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    path = os.path.join(target_dir, filename)
    bpy.ops.wm.stl_export(
        filepath=path,
        export_selected_objects=True,
        global_scale=1.0,
        use_scene_unit=False,
        apply_modifiers=True,
    )
    return path


def export_glb_assembly(objs, filename):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_materials="EXPORT",
    )
    return path


def setup_render_studio():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 900

    floor = create_rounded_prism("StudioFloor", 900.0, 900.0, 2.0, 0.0, -2.0)
    set_obj_material(floor, make_material("StudioFloorMat", (0.94, 0.92, 0.88, 1.0), 0.85))

    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    if not getattr(world, "node_tree", None):
        world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.90, 0.88, 0.84, 1.0)
        bg.inputs["Strength"].default_value = 0.45

    sun_data = bpy.data.lights.new("KeySun", type="SUN")
    sun_data.energy = 2.9
    sun_data.angle = math.radians(18.0)
    sun = bpy.data.objects.new("KeySun", sun_data)
    sun.rotation_euler = Euler((math.radians(52.0), math.radians(-18.0), math.radians(-35.0)), "XYZ")
    bpy.context.collection.objects.link(sun)

    rim_data = bpy.data.lights.new("RimSun", type="SUN")
    rim_data.energy = 1.2
    rim_data.angle = math.radians(28.0)
    rim = bpy.data.objects.new("RimSun", rim_data)
    rim.rotation_euler = Euler((math.radians(40.0), math.radians(20.0), math.radians(135.0)), "XYZ")
    bpy.context.collection.objects.link(rim)

    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.lens = 50.0
    cam_data.clip_start = 1.0
    cam_data.clip_end = 5000.0
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    target = bpy.data.objects.new("LookTarget", None)
    target.location = Vector((0.0, 0.0, 76.0))
    bpy.context.collection.objects.link(target)
    c = cam.constraints.new(type="TRACK_TO")
    c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"

    return scene, cam, target, floor


def render_previews(tray, shell, visor, arms, pins, face_inlay, paws):
    scene, cam, target, floor = setup_render_studio()

    # 1. Resting state (Sleep visor DOWN showing cute `( ◡   ◡ )` with eyelashes!)
    cam.location = Vector((-220.0, -280.0, 185.0))
    target.location = Vector((0.0, 0.0, 76.0))
    scene.render.filepath = os.path.join(OUT_DIR, "preview_assembled.png")
    bpy.ops.render.render(write_still=True)

    # 2. Exploded + Visor flipped UP
    visor.rotation_euler.x = math.radians(-VISOR_OPEN_DEG)
    arms.rotation_euler.x = math.radians(-VISOR_OPEN_DEG)
    face_inlay.rotation_euler.x = math.radians(-VISOR_OPEN_DEG)
    shell.location.z = 78.0
    paws.location.z += 78.0
    visor.location.z += 78.0
    arms.location.z += 78.0
    pins.location.z += 78.0
    face_inlay.location.z += 78.0
    cam.location = Vector((-280.0, -320.0, 250.0))
    target.location = Vector((0.0, 0.0, 108.0))
    scene.render.filepath = os.path.join(OUT_DIR, "preview_exploded.png")
    bpy.ops.render.render(write_still=True)

    # 3. Rear view
    visor.rotation_euler.x = 0.0
    arms.rotation_euler.x = 0.0
    face_inlay.rotation_euler.x = 0.0
    shell.location.z = 0.0
    paws.location.z -= 78.0
    visor.location.z -= 78.0
    arms.location.z -= 78.0
    pins.location.z -= 78.0
    face_inlay.location.z -= 78.0
    cam.location = Vector((235.0, 275.0, 185.0))
    target.location = Vector((0.0, 0.0, 72.0))
    scene.render.filepath = os.path.join(OUT_DIR, "preview_rear.png")
    bpy.ops.render.render(write_still=True)

    for o in [floor, cam, target]:
        bpy.data.objects.remove(o, do_unlink=True)
    for l in list(bpy.data.lights):
        bpy.data.lights.remove(l)


def shift_mesh_to_bed(obj, target_xy=None):
    """Translates obj's vertices so min_z = 0 (and optional XY center)."""
    zs = [v.co.z for v in obj.data.vertices]
    min_z = min(zs)
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    cx = (min(xs) + max(xs)) * 0.5
    cy = (min(ys) + max(ys)) * 0.5
    dx = (target_xy[0] - cx) if target_xy else 0.0
    dy = (target_xy[1] - cy) if target_xy else 0.0
    for v in obj.data.vertices:
        v.co.x += dx
        v.co.y += dy
        v.co.z -= min_z


def build_flat_paw_pads_stl(paws_obj):
    """Creates a bed-flat copy of left+right paw pads sitting at Z=0 for clean printing."""
    dup = paws_obj.copy()
    dup.data = paws_obj.data.copy()
    bpy.context.collection.objects.link(dup)
    # Center around X=0, Y=0 and lay flat facing +Z
    xs = [v.co.x for v in dup.data.vertices]
    ys = [v.co.y for v in dup.data.vertices]
    zs = [v.co.z for v in dup.data.vertices]
    cx, cy, cz = (min(xs) + max(xs)) * 0.5, (min(ys) + max(ys)) * 0.5, (min(zs) + max(zs)) * 0.5
    for v in dup.data.vertices:
        v.co -= Vector((cx, cy, cz))
    dup.rotation_euler = Euler((-math.pi / 2.0, 0.0, 0.0), "XYZ")
    bpy.ops.object.select_all(action="DESELECT")
    dup.select_set(True)
    bpy.context.view_layer.objects.active = dup
    bpy.ops.object.transform_apply(rotation=True)
    shift_mesh_to_bed(dup, (0.0, 0.0))
    return dup


def export_combined_plates(tray, shell, visor, arms, pins, uno_pins_stl, flat_paws):
    """
    Exports:
      - cepheus_white_plate.stl (all White PLA parts neatly arranged on Z=0)
      - cepheus_all_parts.stl   (every printable part in one single STL file on Z=0)
    """
    def clone_at(src, rot_z_deg, target_xy):
        d = src.copy()
        d.data = src.data.copy()
        bpy.context.collection.objects.link(d)
        d.location = Vector((0.0, 0.0, 0.0))
        d.rotation_euler = Euler((0.0, 0.0, math.radians(rot_z_deg)), "XYZ")
        bpy.ops.object.select_all(action="DESELECT")
        d.select_set(True)
        bpy.context.view_layer.objects.active = d
        bpy.ops.object.transform_apply(rotation=True)
        shift_mesh_to_bed(d, target_xy)
        return d

    def clone_split_flat_arms(src, x_split, rot_z_deg, target_xy):
        # Reuse already-exported flat STL cleanly via import so exact flat orientation is preserved
        bpy.ops.wm.stl_import(filepath=os.path.join(STL_DIR, src))
        d = bpy.context.selected_objects[0]
        d.rotation_euler = Euler((0.0, 0.0, math.radians(rot_z_deg)), "XYZ")
        bpy.ops.object.select_all(action="DESELECT")
        d.select_set(True)
        bpy.context.view_layer.objects.active = d
        bpy.ops.object.transform_apply(rotation=True)
        shift_mesh_to_bed(d, target_xy)
        return d

    # White parts plate (~245 x 170 mm):
    #   Tray_Bottom centered at (-38, 0)
    #   Privacy_Visor rotated 90 deg at (+64, 0)
    #   Visor_Arms at (+102, +34), Hinge_Pins at (+102, -30), UNO_Pins at (+102, -55), Paw_Pads at (+102, -78)
    w_tray = clone_at(tray, 0.0, (-38.0, 0.0))
    w_visor = clone_at(visor, 90.0, (56.0, 0.0))
    w_arms = clone_split_flat_arms("cepheus_visor_arms.stl", 16.0, 0.0, (98.0, 34.0))
    w_pins = clone_split_flat_arms("cepheus_hinge_pins.stl", 10.0, 0.0, (98.0, -22.0))
    w_uno = clone_at(uno_pins_stl, 0.0, (98.0, -44.0))
    w_paws = clone_at(flat_paws, 0.0, (86.0, -68.0))

    white_plate = join_objects([w_tray, w_visor, w_arms, w_pins, w_uno, w_paws], "Cepheus_White_Plate")
    export_stl_object(white_plate, "cepheus_white_plate.stl", target_dir=OUT_DIR)

    # Combined single-STL of ALL parts (Peach Shell_Top beside White Plate):
    a_shell = clone_at(shell, 0.0, (-212.0, 0.0))
    all_parts = join_objects([white_plate, a_shell], "Cepheus_All_Parts")
    export_stl_object(all_parts, "cepheus_all_parts.stl", target_dir=OUT_DIR)
    bpy.data.objects.remove(all_parts, do_unlink=True)


def main():
    clear_scene()
    tray = build_bottom_tray()
    shell = build_top_shell()
    visor = create_flip_sleep_visor("Privacy_Visor")
    arms, pins = build_visor_arms_and_pins()
    paws = build_paw_pads()
    uno_pins_glb, uno_pins_stl = build_uno_click_pins()

    for obj in [tray, shell, visor, arms, pins, paws, uno_pins_stl]:
        nm = fix_normals_and_check_manifold(obj)
        dims = obj.dimensions
        print(f"[CHECK] {obj.name}: non-manifold edges = {nm}, bbox (mm) = ({dims.x:.2f}, {dims.y:.2f}, {dims.z:.2f})")

    fix_normals_and_check_manifold(uno_pins_glb)
    assign_enclosure_materials(tray, shell, visor)
    mat_white = make_material("CrispWarmWhitePartPLA", (0.96, 0.95, 0.93, 1.0), 0.54)
    set_obj_material(arms, mat_white)
    set_obj_material(pins, mat_white)
    set_obj_material(uno_pins_glb, mat_white)
    set_obj_material(uno_pins_stl, mat_white)

    export_stl_object(tray, "cepheus_bottom_tray.stl")

    shell.location.z = -BASE_TRAY_H
    export_stl_object(shell, "cepheus_top_shell.stl")
    shell.location.z = 0.0

    saved_v_loc = visor.location.copy()
    visor.location = Vector((0.0, 0.0, 0.0))
    visor_stl = visor.copy()
    visor_stl.data = visor.data.copy()
    bpy.context.collection.objects.link(visor_stl)
    shift_mesh_to_bed(visor_stl)
    export_stl_object(visor_stl, "cepheus_privacy_visor.stl")
    bpy.data.objects.remove(visor_stl, do_unlink=True)
    visor.location = saved_v_loc

    # Export arms & pins flat on Z=0 side-by-side for 100% support-free PLA printing
    export_split_flat_stl(arms, 16.0, "cepheus_visor_arms.stl")
    export_split_flat_stl(pins, 10.0, "cepheus_hinge_pins.stl")

    flat_paws = build_flat_paw_pads_stl(paws)
    export_stl_object(flat_paws, "cepheus_paw_pads.stl")

    shift_mesh_to_bed(uno_pins_stl)
    export_stl_object(uno_pins_stl, "cepheus_uno_pins.stl")

    # Export combined build-plate STLs (1 White plate + 1 All-in-one STL)
    shell.location.z = -BASE_TRAY_H
    visor.location = Vector((0.0, 0.0, 0.0))
    export_combined_plates(tray, shell, visor, arms, pins, uno_pins_stl, flat_paws)
    shell.location.z = 0.0
    visor.location = saved_v_loc

    bpy.data.objects.remove(flat_paws, do_unlink=True)
    bpy.data.objects.remove(uno_pins_stl, do_unlink=True)

    for obj in [tray, shell, visor, arms, pins, paws, uno_pins_glb]:
        set_smooth_shading(obj)

    face_inlay = build_visor_face_inlay()
    set_smooth_shading(face_inlay)
    hw_objects = build_mock_hardware()

    export_glb_assembly([tray, shell, visor, arms, pins, face_inlay, paws, uno_pins_glb] + hw_objects, "cepheus_assembly.glb")

    render_previews(tray, shell, visor, arms, pins, face_inlay, paws)

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, "cepheus_enclosure.blend"))
    print(f"[DONE] Exported Support-Free Screwless Peach & White Cepheus Desk Buddy STLs, GLB, .blend, and previews to {OUT_DIR}")


if __name__ == "__main__":
    main()
