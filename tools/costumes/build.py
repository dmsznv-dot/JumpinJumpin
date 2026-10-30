"""Turn NVIDIA SimReady assets (CC BY 4.0) into toy-style full-body costumes for the cube.

Pipeline per costume (see costumes.json):
  USD meshes + albedo texture -> Y-up, oriented (`rotate`) -> scaled into the cube's suit box (`margin`)
  -> the cube's own suit shell (face window included) is inflated out to the object's outer surface (`cap`, `smooth`)
  (`points` vertices per ring of the shell = the polygon budget) -> texture colours reduced to a `colors`-tone palette, saturated for the game's look
  -> GLB with vertex colours and normals (no textures) + characters/costume-manifest.mjs.

The quality knobs are `points` (detail) and `colors` (palette size); lower = closer to the game's flat toy style.

Usage:
  python build.py                      # build every costume from costumes.json
  python build.py hotdog banana        # only these
  python build.py --info <asset_dir>   # print extents to pick an orientation
Requires: usd-core numpy pillow trimesh fast-simplification certifi (see README.md).
"""
import colorsys, glob, json, math, os, sys

import numpy as np
from PIL import Image, ImageFilter
from pxr import Usd, UsdGeom, UsdShade, Sdf
import trimesh
import fast_simplification

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
CONFIG = json.load(open(os.path.join(HERE, 'costumes.json')))
CUBE = CONFIG['cube']  # mirrors characters/cube-shape.mjs CUBE (+ suit offset)


# ---------- USD loading ----------
def _albedo(material, asset_dir):
    """Albedo texture path and constant colour of a bound material (OmniPBR or UsdPreviewSurface)."""
    tex, const = None, None
    if not material:
        return tex, const
    for prim in Usd.PrimRange(material.GetPrim()):
        if not prim.IsA(UsdShade.Shader):
            continue
        for inp in UsdShade.Shader(prim).GetInputs():
            name, value = inp.GetBaseName().lower(), inp.Get()
            if isinstance(value, Sdf.AssetPath) and value.path:
                base = os.path.basename(value.path).lower()
                if tex is None and ('diffuse' in name or 'albedo' in name or any(k in base for k in ('_alb', 'albedo', 'basecolor', 'diff'))):
                    path = value.resolvedPath
                    if not path or not os.path.exists(path):
                        hits = glob.glob(os.path.join(asset_dir, '**', os.path.basename(value.path)), recursive=True)
                        path = hits[0] if hits else None
                    tex = path
            elif const is None and name in ('diffuse_color_constant', 'diffusecolor') and value is not None:
                const = np.array(value, dtype=float)[:3]
    return tex, const


class Texture:
    cache = {}

    def __init__(self, path):
        img = Image.open(path).convert('RGB')
        img.thumbnail((512, 512))
        # Blur first: we want the local average colour, not the photo detail.
        self.px = np.asarray(img.filter(ImageFilter.GaussianBlur(7)), dtype=float) / 255

    @classmethod
    def get(cls, path):
        if path not in cls.cache:
            cls.cache[path] = Texture(path)
        return cls.cache[path]

    def sample(self, uv):
        h, w, _ = self.px.shape
        x = (np.mod(uv[:, 0], 1) * (w - 1)).astype(int)
        y = ((1 - np.mod(uv[:, 1], 1)) * (h - 1)).astype(int)
        return self.px[y, x]


def load_asset(asset_dir):
    """All triangles of the asset in world space (Y-up) with a colour per corner."""
    root = sorted(glob.glob(os.path.join(asset_dir, 'simready_usd', '*.usd*')))[0]
    stage = Usd.Stage.Open(root, Usd.Stage.LoadAll)
    z_up = UsdGeom.GetStageUpAxis(stage) == UsdGeom.Tokens.z
    cache = UsdGeom.XformCache()
    tris, cols = [], []
    for prim in stage.Traverse(Usd.TraverseInstanceProxies()):
        if not prim.IsA(UsdGeom.Mesh) or not UsdGeom.Imageable(prim).ComputeVisibility() == UsdGeom.Tokens.inherited:
            continue
        mesh = UsdGeom.Mesh(prim)
        pts = np.array(mesh.GetPointsAttr().Get(), dtype=float)
        counts = np.array(mesh.GetFaceVertexCountsAttr().Get())
        idx = np.array(mesh.GetFaceVertexIndicesAttr().Get())
        m = np.array(cache.GetLocalToWorldTransform(prim), dtype=float)
        pts = np.c_[pts, np.ones(len(pts))] @ m
        pts = pts[:, :3]
        # UVs (per corner)
        uv = None
        for pv in UsdGeom.PrimvarsAPI(prim).GetPrimvars():
            if pv.GetTypeName() in (Sdf.ValueTypeNames.TexCoord2fArray, Sdf.ValueTypeNames.Float2Array):
                vals = np.array(pv.ComputeFlattened(), dtype=float)
                uv = vals if pv.GetInterpolation() == 'faceVarying' else vals[idx]
                break
        # Material per face (GeomSubsets) -> colour sampler
        face_mat = [UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()[0]] * len(counts)
        for subset in UsdGeom.Subset.GetAllGeomSubsets(mesh):
            mat = UsdShade.MaterialBindingAPI(subset.GetPrim()).ComputeBoundMaterial()[0]
            for f in subset.GetIndicesAttr().Get():
                face_mat[f] = mat
        looks = {}
        corner = 0
        for f, n in enumerate(counts):
            key = face_mat[f].GetPath() if face_mat[f] else None
            if key not in looks:
                looks[key] = _albedo(face_mat[f], asset_dir)
            tex, const = looks[key]
            for k in range(1, n - 1):  # fan triangulation
                c = [corner, corner + k, corner + k + 1]
                tris.append(pts[idx[c]])
                if tex and uv is not None:
                    cols.append(Texture.get(tex).sample(uv[c]))
                else:
                    cols.append(np.tile(const if const is not None else np.array([.8, .8, .8]), (3, 1)))
            corner += n
    tris, cols = np.array(tris), np.array(cols)
    if z_up:
        tris = tris[..., [0, 2, 1]] * np.array([1, 1, -1])
    return tris, cols


# ---------- Shaping ----------
def rotation(deg):
    rx, ry, rz = (math.radians(a) for a in deg)
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    X = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Y = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Z = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Z @ Y @ X


def fit_to_suit(points, spec):
    """Squash the object into the suit box around the cube body: every costume shares the cube silhouette."""
    lo, hi = points.min(0), points.max(0)
    half = np.array([CUBE['halfW'], CUBE['halfH'], CUBE['halfD']]) + CUBE['suit']
    margin = np.array(spec.get('margin', [1.07, 1.06, 1.1]))
    fitted = (points - (lo + hi) / 2) / ((hi - lo) / 2) * half * margin
    # Taller costumes grow upwards only: the hem stays just above the legs.
    fitted[:, 1] += half[1] * (margin[1] - 1.06)
    return fitted


def palette(colors, k, saturation, lift):
    """k-means into k tones, then push them toward the game's bright, saturated toy colours."""
    rng = np.random.default_rng(1)
    centers = colors[rng.choice(len(colors), k, replace=False)]
    for _ in range(25):
        label = np.argmin(((colors[:, None] - centers[None]) ** 2).sum(-1), 1)
        for j in range(k):
            if np.any(label == j):
                centers[j] = colors[label == j].mean(0)
    styled = []
    for r, g, b in centers:
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        styled.append(colorsys.hsv_to_rgb(h, min(1, s * saturation), min(1, lift + v * (1 - lift) * 1.08)))
    return np.array(styled), label


def suit_shell(points):
    """The cube's own suit (body + suit offset, face window and lip included) with `points` vertices per ring."""
    import subprocess
    data = json.loads(subprocess.check_output(['node', os.path.join(HERE, 'shell.mjs'), str(CUBE['suit']), str(points)]))
    return trimesh.Trimesh(np.array(data['position']).reshape(-1, 3), np.array(data['index']).reshape(-1, 3), process=False)


def wrap(shell, asset, spec):
    """Inflate the suit outwards to the asset's outer surface: the cube silhouette stays, the object's bulges show.

    Rays go from the body centre through every shell vertex; the farthest asset hit along the ray is the costume surface
    there (never inside the suit, capped so thin stems do not become spikes). The face window keeps its shape."""
    v = shell.vertices.copy()
    r0 = np.linalg.norm(v, axis=1)
    dirs = v / r0[:, None]
    far = np.zeros(len(v))
    loc, ray, _ = asset.ray.intersects_location(np.zeros_like(v), dirs, multiple_hits=True)
    np.maximum.at(far, ray, np.linalg.norm(loc, axis=1))
    push = np.clip(far - r0, 0, r0 * (spec.get('cap', 1.4) - 1))
    # No push around the face window, fading in over ~0.3 m.
    fw, fh = CUBE['face']['w'] / 2, CUBE['face']['h'] / 2
    edge = np.maximum(np.abs(v[:, 0]) - fw, np.abs(v[:, 1]) - fh)
    keep = np.clip((edge - .08) / .3, 0, 1)
    keep = np.where(v[:, 2] > 0, keep * keep * (3 - 2 * keep), 1)
    push *= keep
    # Smooth the push so the inflated suit stays soft (graph Laplacian over shell edges).
    edges = shell.edges_unique
    for _ in range(spec.get('smooth', 4)):
        acc = np.zeros(len(v)); cnt = np.zeros(len(v))
        np.add.at(acc, edges[:, 0], push[edges[:, 1]]); np.add.at(acc, edges[:, 1], push[edges[:, 0]])
        np.add.at(cnt, edges[:, 0], 1); np.add.at(cnt, edges[:, 1], 1)
        push = (push + acc / np.maximum(cnt, 1)) / 2 * np.where(keep > 0, 1, 0)
    return trimesh.Trimesh(v + dirs * push[:, None], shell.faces, process=False)


def build(cid, spec, info=False):
    asset_dir = os.path.join(os.path.expanduser(CONFIG['cache']), spec['asset'])
    if not os.path.isdir(asset_dir):
        sys.path.insert(0, HERE)
        from fetch import fetch
        fetch(spec['asset'], asset_dir)
    tris, cols = load_asset(asset_dir)
    pts = tris.reshape(-1, 3) @ rotation(spec.get('rotate', [0, 0, 0])).T
    if info:
        print(cid, 'tris', len(tris), 'extent', np.round(pts.max(0) - pts.min(0), 3))
        return
    pts = fit_to_suit(pts, spec)
    # Weld corners; each welded vertex keeps the mean colour of its corners.
    _, inverse = np.unique(np.round(pts, 5), axis=0, return_inverse=True)
    inverse = inverse.ravel(); n = inverse.max() + 1
    counts = np.bincount(inverse)[:, None]
    weld_pts = np.zeros((n, 3)); np.add.at(weld_pts, inverse, pts); weld_pts /= counts
    weld_cols = np.zeros((n, 3)); np.add.at(weld_cols, inverse, cols.reshape(-1, 3)); weld_cols /= counts
    asset = trimesh.Trimesh(weld_pts, inverse.reshape(-1, 3), process=False)
    if len(asset.faces) > 6000:  # ray casting only needs the silhouette
        av, af = fast_simplification.simplify(asset.vertices.astype(np.float32), asset.faces.astype(np.int32), 1 - 6000 / len(asset.faces))
        asset = trimesh.Trimesh(av, af)

    low = wrap(suit_shell(spec.get('points', CONFIG['defaults']['points'])), asset, spec)

    # Palette from the source colours; each costume vertex takes the tone of the nearest asset point.
    tones, label = palette(weld_cols, spec.get('colors', CONFIG['defaults']['colors']), spec.get('saturation', CONFIG['defaults']['saturation']), spec.get('lift', CONFIG['defaults']['lift']))
    nearest = np.concatenate([np.argmin(((weld_pts[None] - chunk[:, None]) ** 2).sum(-1), 1) for chunk in np.array_split(low.vertices, max(1, len(low.vertices) // 128))])
    # Majority filter over the shell's edges: photo noise becomes clean toy-like colour patches.
    tone = label[nearest]
    edges = low.edges_unique
    for _ in range(spec.get('clean', CONFIG['defaults']['clean'])):
        votes = np.zeros((len(tone), len(tones)))
        np.add.at(votes, (edges[:, 0], tone[edges[:, 1]]), 1); np.add.at(votes, (edges[:, 1], tone[edges[:, 0]]), 1)
        votes[np.arange(len(tone)), tone] += 1.5
        tone = votes.argmax(1)
    # glTF vertex colours are linear; the palette is authored in sRGB.
    lin = np.where(tones <= .04045, tones / 12.92, ((tones + .055) / 1.055) ** 2.4)
    vcols = (lin[tone] * 255).round().astype(np.uint8)
    low.visual = trimesh.visual.ColorVisuals(low, vertex_colors=np.c_[vcols, np.full(len(vcols), 255, np.uint8)])

    out = os.path.join(ROOT, 'assets', 'costumes', f'{cid}.glb')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    low.export(out)  # normals are computed in the game (smaller files)
    order = np.argsort(-np.bincount(tone, minlength=len(tones)))
    print(f'{cid}: {len(tris)} source tris -> {len(low.faces)} tris, {os.path.getsize(out) // 1024} KB')
    return {'file': f'assets/costumes/{cid}.glb', 'tris': int(len(low.faces)),
            'palette': ['#%02x%02x%02x' % tuple((tones[j] * 255).round().astype(int)) for j in order],
            'source': spec['asset']}


def write_manifest(entries):
    path = os.path.join(ROOT, 'characters', 'costume-manifest.mjs')
    old = {}
    if os.path.exists(path):
        text = open(path).read()
        old = json.loads(text[text.index('{'):text.rindex('}') + 1])
    old.update(entries)
    with open(path, 'w') as f:
        f.write('// Generated by tools/costumes/build.py from NVIDIA SimReady assets (CC BY 4.0). Do not edit by hand.\n')
        f.write('export const COSTUME_ASSETS = ' + json.dumps(old, indent=1, ensure_ascii=False) + ';\n')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[:1] == ['--info']:
        for cid, spec in CONFIG['costumes'].items():
            build(cid, spec, info=True)
        sys.exit()
    built = {}
    for cid, spec in CONFIG['costumes'].items():
        if not args or cid in args:
            built[cid] = {**build(cid, spec), 'title': spec['title'], 'icon': spec['icon']}
    write_manifest(built)
