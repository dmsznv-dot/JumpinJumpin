"""Fit Kenney GLBs (CC0) to the cube's head or back socket with baked vertex colours (no textures, no normals).
Sources: the GLB mirror named in assets/headwear/LICENSE.md, saved as <src_dir>/<src>.glb.
Usage: uv run --with trimesh --with numpy --with pillow --with scipy python fit-kenney.py <src_dir> assets/headwear tools/costumes/kenney-props.json
Placement: head items sit on the lid (y = .768), back items touch the back (z = -.678); `scale`, `rotate`, `lift`, `sink` tune one item."""
import sys, json, os, numpy as np, trimesh
from trimesh.exchange.gltf import export_glb
src, out, specs = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
def rot(deg):
    m = np.eye(4)
    for axis, d in zip(np.eye(3), deg):
        if d: m = trimesh.transformations.rotation_matrix(np.radians(d), axis) @ m
    return m
def colours(g):
    v = g.visual
    n = len(g.vertices)
    if isinstance(v, trimesh.visual.TextureVisuals):
        mat = v.material
        img = getattr(mat, 'baseColorTexture', None) or getattr(mat, 'image', None)
        base = np.array(getattr(mat, 'baseColorFactor', None) if getattr(mat, 'baseColorFactor', None) is not None else [255]*4, float)[:3]
        base = base / (255 if base.max() > 1 else 1)
        if img is not None and v.uv is not None:
            px = np.asarray(img.convert('RGB'), float) / 255
            h, w, _ = px.shape
            uv = v.uv
            x = np.clip((np.mod(uv[:, 0], 1) * w).astype(int), 0, w - 1)
            y = np.clip(((1 - np.mod(uv[:, 1], 1)) * h).astype(int), 0, h - 1)
            return px[y, x] * base
        return np.tile(base, (n, 1))
    return v.vertex_colors[:, :3] / 255
for name, spec in specs.items():
    scene = trimesh.load(os.path.join(src, spec['src'] + '.glb'), force='scene')
    parts = []
    for node in scene.graph.nodes_geometry:
        tf, gname = scene.graph[node]
        g = scene.geometry[gname].copy()
        c = colours(g)  # sRGB
        g.apply_transform(tf)
        g = trimesh.Trimesh(g.vertices, g.faces, process=False)
        g.visual = trimesh.visual.ColorVisuals(g, vertex_colors=np.c_[(c * 255).round(), np.full(len(c), 255)].astype(np.uint8))
        parts.append(g)
    m = trimesh.util.concatenate(parts)
    m.apply_transform(rot(spec.get('rotate', [0, 0, 0])))
    lo, hi = m.bounds; e = hi - lo
    k = spec.get('scale', 1)
    if spec['slot'] == 'head':
        s = min(1.1 / e[0], .83 / e[1], 1.0 / e[2]) * k
        m.apply_translation(-(lo + hi) / 2); m.apply_scale(s)
        lo, hi = m.bounds
        m.apply_translation([0, .768 - spec.get('sink', 0) - lo[1], -.015])
    else:
        s = min(1.1 / e[0], 1.08 / e[1]) * k
        m.apply_translation(-(lo + hi) / 2); m.apply_scale(s)
        lo, hi = m.bounds
        m.apply_translation([0, .06 + spec.get('lift', 0), -.678 - hi[2]])
    # The game stores linear vertex colours (see the existing headwear GLBs).
    c = m.visual.vertex_colors[:, :3] / 255
    lin = np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)
    m.visual.vertex_colors = np.c_[(lin * 255).round(), np.full(len(lin), 255)].astype(np.uint8)
    path = os.path.join(out, name + '.glb')
    open(path, 'wb').write(export_glb(m, include_normals=False))
    print(name, len(m.faces), 'tris', os.path.getsize(path), 'B', m.bounds.round(3).tolist())
