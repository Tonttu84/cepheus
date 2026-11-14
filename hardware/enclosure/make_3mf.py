"""
Packages the 7 unique Cepheus Desk Buddy STLs into one multi-plate Bambu Studio / PrusaSlicer .3mf file:
  - Plate 1: cepheus_top_shell (Peach PLA)
  - Plate 2: cepheus_bottom_tray, cepheus_privacy_visor, cepheus_visor_arms,
             cepheus_hinge_pins, cepheus_uno_pins, cepheus_paw_pads (White PLA)
"""

import json
import os
import struct
import uuid
import zipfile
from xml.sax.saxutils import escape

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
STL_DIR = os.path.join(OUT_DIR, "stl")


def read_binary_stl(path):
    with open(path, "rb") as f:
        f.read(80)
        count = struct.unpack("<I", f.read(4))[0]
        vert_map = {}
        verts = []
        tris = []
        for _ in range(count):
            data = struct.unpack("<12fH", f.read(50))
            tri_idx = []
            for k in range(3):
                vx, vy, vz = data[3 + k * 3], data[4 + k * 3], data[5 + k * 3]
                key = (round(vx, 5), round(vy, 5), round(vz, 5))
                idx = vert_map.get(key)
                if idx is None:
                    idx = len(verts)
                    vert_map[key] = idx
                    verts.append((vx, vy, vz))
                tri_idx.append(idx)
            tris.append(tuple(tri_idx))
    return verts, tris


def mesh_bounds(verts):
    xs = [v[0] for v in verts]
    ys = [v[1] for v in verts]
    zs = [v[2] for v in verts]
    return (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))


def rotate_z_90(verts):
    return [(-y, x, z) for (x, y, z) in verts]


def center_on_bed(verts):
    x0, x1, y0, y1, z0, _ = mesh_bounds(verts)
    cx = (x0 + x1) * 0.5
    cy = (y0 + y1) * 0.5
    return [(x - cx, y - cy, z - z0) for (x, y, z) in verts]


def make_3mf(out_path):
    # Bambu Studio 256x256 bed coordinates:
    #   Plate 1 center = (128.0, 128.0, 0)
    #   Plate 2 center = (128.0 + 307.2, 128.0, 0) = (435.2, 128.0, 0)
    parts_spec = [
        # (filename, display_name, plate_id, extruder_idx, rot_z_90, build_xy)
        ("cepheus_top_shell.stl", "cepheus_top_shell", 1, 1, False, (128.0, 128.0)),
        ("cepheus_bottom_tray.stl", "cepheus_bottom_tray", 2, 2, False, (397.2, 128.0)),
        ("cepheus_privacy_visor.stl", "cepheus_privacy_visor", 2, 2, True, (491.2, 128.0)),
        ("cepheus_visor_arms.stl", "cepheus_visor_arms", 2, 2, False, (533.2, 162.0)),
        ("cepheus_hinge_pins.stl", "cepheus_hinge_pins", 2, 2, False, (533.2, 106.0)),
        ("cepheus_uno_pins.stl", "cepheus_uno_pins", 2, 2, False, (533.2, 84.0)),
        ("cepheus_paw_pads.stl", "cepheus_paw_pads", 2, 2, False, (435.2, 232.0)),
    ]

    objects_xml = []
    build_items_xml = []
    settings_objs_xml = []
    plate1_instances_xml = []
    plate2_instances_xml = []

    for idx, (fname, label, plate_id, ext_id, rot90, (bx, by)) in enumerate(parts_spec, start=1):
        stl_path = os.path.join(STL_DIR, fname)
        verts, tris = read_binary_stl(stl_path)
        if rot90:
            verts = rotate_z_90(verts)
        verts = center_on_bed(verts)

        obj_uuid = str(uuid.uuid4())
        inst_uuid = str(uuid.uuid4())
        # pid=100 (colorgroup), pindex = 0 (Peach) or 1 (White)
        pindex = 0 if ext_id == 1 else 1

        v_lines = "\n".join(f'          <vertex x="{x:.5f}" y="{y:.5f}" z="{z:.5f}" />' for (x, y, z) in verts)
        t_lines = "\n".join(f'          <triangle v1="{a}" v2="{b}" v3="{c}" />' for (a, b, c) in tris)
        objects_xml.append(
            f'    <object id="{idx}" name="{escape(label)}" type="model" p:UUID="{obj_uuid}" pid="100" pindex="{pindex}">\n'
            f"      <mesh>\n"
            f"        <vertices>\n{v_lines}\n        </vertices>\n"
            f"        <triangles>\n{t_lines}\n        </triangles>\n"
            f"      </mesh>\n"
            f"    </object>"
        )

        # Row-major 3x4 affine matrix in 3MF: 1 0 0  0 1 0  0 0 1  tx ty tz
        build_items_xml.append(
            f'    <item objectid="{idx}" p:UUID="{inst_uuid}" transform="1 0 0 0 1 0 0 0 1 {bx:.4f} {by:.4f} 0" printable="1" />'
        )

        settings_objs_xml.append(
            f'  <object id="{idx}">\n'
            f'    <metadata key="name" value="{escape(label)}"/>\n'
            f'    <metadata key="extruder" value="{ext_id}"/>\n'
            f'    <part id="1" subtype="normal_part">\n'
            f'      <metadata key="name" value="{escape(label)}"/>\n'
            f'      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n'
            f'      <metadata key="source_file" value="{escape(fname)}"/>\n'
            f"    </part>\n"
            f"  </object>"
        )

        inst_xml = (
            f"    <model_instance>\n"
            f'      <metadata key="object_id" value="{idx}"/>\n'
            f'      <metadata key="instance_id" value="0"/>\n'
            f'      <metadata key="identify_id" value="{100 + idx}"/>\n'
            f"    </model_instance>"
        )
        if plate_id == 1:
            plate1_instances_xml.append(inst_xml)
        else:
            plate2_instances_xml.append(inst_xml)

    model_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<model unit="millimeter" xml:lang="en-US" '
        'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
        'xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02" '
        'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" '
        'requiredextensions="p">\n'
        '  <metadata name="Application">BambuStudio-02.00.00.00</metadata>\n'
        '  <metadata name="Title">Cepheus Desk Buddy</metadata>\n'
        "  <resources>\n"
        '    <m:colorgroup id="100">\n'
        '      <m:color color="#FAB18AFF"/>\n'
        '      <m:color color="#F7F5F0FF"/>\n'
        "    </m:colorgroup>\n"
        + "\n".join(objects_xml)
        + "\n  </resources>\n"
        '  <build p:UUID="'
        + str(uuid.uuid4())
        + '">\n'
        + "\n".join(build_items_xml)
        + "\n  </build>\n"
        "</model>\n"
    )

    model_settings_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<config>\n"
        + "\n".join(settings_objs_xml)
        + "\n"
        "  <plate>\n"
        '    <metadata key="plater_id" value="1"/>\n'
        '    <metadata key="plater_name" value="Plate 1 - Peach Body"/>\n'
        '    <metadata key="locked" value="false"/>\n'
        + "\n".join(plate1_instances_xml)
        + "\n  </plate>\n"
        "  <plate>\n"
        '    <metadata key="plater_id" value="2"/>\n'
        '    <metadata key="plater_name" value="Plate 2 - White Parts"/>\n'
        '    <metadata key="locked" value="false"/>\n'
        + "\n".join(plate2_instances_xml)
        + "\n  </plate>\n"
        "</config>\n"
    )

    project_settings = json.dumps(
        {
            "filament_colour": ["#FAB18A", "#F7F5F0"],
            "filament_type": ["PLA", "PLA"],
            "enable_support": "1",
            "support_type": "tree(auto)",
            "support_on_build_plate_only": "1",
        },
        indent=4,
    )

    content_types_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n'
        '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n'
        '  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n'
        '  <Default Extension="config" ContentType="text/plain"/>\n'
        "</Types>\n"
    )

    rels_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
        '  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n'
        "</Relationships>\n"
    )

    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml)
        zf.writestr("_rels/.rels", rels_xml)
        zf.writestr("3D/3dmodel.model", model_xml)
        zf.writestr("Metadata/model_settings.config", model_settings_xml)
        zf.writestr("Metadata/project_settings.config", project_settings)

    print(f"[DONE] Wrote multi-plate 3MF ({os.path.getsize(out_path)} bytes) -> {out_path}")


if __name__ == "__main__":
    os.makedirs(STL_DIR, exist_ok=True)
    make_3mf(os.path.join(STL_DIR, "cepheus_desk_buddy.3mf"))
