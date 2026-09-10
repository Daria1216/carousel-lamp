import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const paint = (color: string, metalness = 0.04) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.54, metalness });
const brass = paint('#b58b3b', 0.64);
function consolidate(group: THREE.Group) {
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(),
    originals = new Set<THREE.BufferGeometry>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material))
      return;
    const geometry = object.geometry.clone();
    geometry.deleteAttribute('uv');
    geometry.applyMatrix4(
      new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld),
    );
    const batch = batches.get(object.material) ?? [];
    batch.push(geometry);
    batches.set(object.material, batch);
    originals.add(object.geometry);
  });
  group.clear();
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false);
    if (!geometry)
      throw new Error('Unable to combine carousel ornament geometry');
    solid(group, geometry, material);
    geometries.forEach((g) => g.dispose());
  }
  originals.forEach((g) => g.dispose());
}

function solid(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: number[] = [0, 0, 0],
) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(position[0], position[1], position[2]);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function oval(
  parent: THREE.Object3D,
  material: THREE.Material,
  position: number[],
  scale: number[],
) {
  const object = solid(
    parent,
    new THREE.SphereGeometry(1, 24, 16),
    material,
    position,
  );
  object.scale.set(scale[0], scale[1], scale[2]);
  return object;
}
function curve(
  parent: THREE.Object3D,
  material: THREE.Material,
  points: number[][],
  radius: number,
) {
  const path = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...(p as [number, number, number]))),
  );
  return solid(
    parent,
    new THREE.TubeGeometry(path, 24, radius, 8, false),
    material,
  );
}
/** A tapered solid loft, rather than a flat silhouette, for carved necks and limbs. */
function loft(
  parent: THREE.Object3D,
  material: THREE.Material,
  points: number[][],
  widths: number[],
  depths: number[],
) {
  const path = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...(p as [number, number, number]))),
  );
  const segments = 24,
    sides = 14,
    frames = path.computeFrenetFrames(segments, false),
    positions: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      p = path.getPointAt(t),
      u = t * (widths.length - 1),
      j = Math.min(widths.length - 2, Math.floor(u)),
      f = u - j;
    const w = THREE.MathUtils.lerp(widths[j], widths[j + 1], f),
      d = THREE.MathUtils.lerp(depths[j], depths[j + 1], f);
    for (let k = 0; k <= sides; k++) {
      const angle = (k / sides) * Math.PI * 2,
        v = p
          .clone()
          .addScaledVector(frames.normals[i], Math.cos(angle) * w)
          .addScaledVector(frames.binormals[i], Math.sin(angle) * d);
      positions.push(v.x, v.y, v.z);
      if (i < segments && k < sides) {
        const a = i * (sides + 1) + k,
          b = a + sides + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  // Cap the loft at both ends so oblique views never reveal open tubes.
  for (const end of [0, segments]) {
    const p = path.getPointAt(end / segments),
      center = positions.length / 3;
    positions.push(p.x, p.y, p.z);
    for (let k = 0; k < sides; k++) {
      const a = end * (sides + 1) + k;
      if (end === 0) indices.push(center, a + 1, a);
      else indices.push(center, a, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return solid(parent, geometry, material);
}
export function createHorse(index: number) {
  const group = new THREE.Group();
  group.name = `solid-carousel-horse-${index + 1}`;
  const ivory = paint(['#e5d6b4', '#d7c19a', '#e9ddd0'][index % 3]),
    mane = paint(['#b78b43', '#8a5740', '#cfb479'][index % 3]),
    saddle = paint(['#496f8a', '#a35349', '#788453'][index % 3]),
    trim = paint('#d4ad62', 0.35),
    hoof = paint('#745646'),
    eye = paint('#25262b');
  oval(group, ivory, [0, 0, 0], [0.4, 0.205, 0.15]);
  oval(group, ivory, [-0.235, 0.015, 0], [0.19, 0.215, 0.155]);
  oval(group, ivory, [0.24, -0.015, 0], [0.2, 0.19, 0.16]);
  loft(
    group,
    ivory,
    [
      [-0.23, 0.06, 0],
      [-0.3, 0.27, 0],
      [-0.4, 0.47, 0],
      [-0.46, 0.49, 0],
    ],
    [0.17, 0.145, 0.1, 0.1],
    [0.135, 0.11, 0.085, 0.08],
  );
  const head = oval(group, ivory, [-0.485, 0.475, 0], [0.155, 0.13, 0.09]);
  head.rotation.z = -0.48;
  const muzzle = oval(group, ivory, [-0.62, 0.39, 0], [0.125, 0.077, 0.081]);
  muzzle.rotation.z = -0.45;
  for (const z of [-0.06, 0.06]) {
    const ear = oval(group, ivory, [-0.41, 0.635, z], [0.037, 0.11, 0.028]);
    ear.rotation.z = -0.17;
    const inner = oval(
      group,
      paint('#b78f7f'),
      [-0.425, 0.65, z],
      [0.019, 0.06, 0.029],
    );
    inner.rotation.z = -0.17;
  }
  for (const z of [-1, 1]) {
    oval(group, eye, [-0.52, 0.505, z * 0.081], [0.018, 0.021, 0.012]);
    oval(group, trim, [-0.58, 0.405, z * 0.08], [0.031, 0.025, 0.009]);
    oval(group, hoof, [-0.68, 0.386, z * 0.061], [0.016, 0.01, 0.008]);
    const front =
      z === 1
        ? [
            [-0.24, -0.11, z * 0.11],
            [-0.35, -0.285, z * 0.125],
            [-0.48, -0.35, z * 0.12],
            [-0.49, -0.44, z * 0.12],
          ]
        : [
            [-0.23, -0.11, z * 0.11],
            [-0.3, -0.31, z * 0.12],
            [-0.18, -0.4, z * 0.12],
            [-0.16, -0.49, z * 0.12],
          ];
    const back =
      z === 1
        ? [
            [0.23, -0.1, z * 0.11],
            [0.39, -0.26, z * 0.125],
            [0.3, -0.37, z * 0.13],
            [0.39, -0.45, z * 0.13],
          ]
        : [
            [0.24, -0.1, z * 0.11],
            [0.38, -0.29, z * 0.12],
            [0.51, -0.33, z * 0.12],
            [0.55, -0.42, z * 0.12],
          ];
    for (const leg of [front, back]) {
      loft(
        group,
        ivory,
        leg,
        [0.073, 0.057, 0.037, 0.032],
        [0.06, 0.049, 0.034, 0.032],
      );
      const tip = leg[3];
      const shoe = oval(
        group,
        hoof,
        [tip[0] - 0.01, tip[1] - 0.025, tip[2]],
        [0.063, 0.037, 0.046],
      );
      shoe.rotation.z = -0.16;
    }
    curve(
      group,
      trim,
      [
        [-0.425, 0.57, z * 0.084],
        [-0.5, 0.5, z * 0.09],
        [-0.56, 0.36, z * 0.075],
      ],
      0.009,
    );
    curve(
      group,
      saddle,
      [
        [-0.67, 0.435, z * 0.07],
        [-0.625, 0.39, z * 0.082],
        [-0.59, 0.35, z * 0.06],
      ],
      0.012,
    );
    curve(
      group,
      trim,
      [
        [-0.57, 0.37, z * 0.09],
        [-0.36, 0.19, z * 0.175],
        [-0.04, 0.19, z * 0.172],
      ],
      0.006,
    );
  }
  // A thick curved saddle pad follows the back and drops down both sides.
  oval(group, trim, [0.01, 0.07, 0], [0.235, 0.163, 0.174]);
  oval(group, saddle, [0.01, 0.083, 0], [0.215, 0.155, 0.182]);
  oval(group, mane, [0.03, 0.207, 0], [0.15, 0.045, 0.105]);
  for (const side of [-1, 1]) {
    oval(group, trim, [0.02, 0.085, side * 0.179], [0.036, 0.037, 0.012]);
    for (let p = 0; p < 5; p++) {
      const a = (p * Math.PI * 2) / 5;
      oval(
        group,
        ivory,
        [0.02 + Math.sin(a) * 0.046, 0.085 + Math.cos(a) * 0.046, side * 0.179],
        [0.02, 0.023, 0.012],
      );
    }
    const stirrup = solid(
      group,
      new THREE.TorusGeometry(0.047, 0.009, 7, 20),
      trim,
      [0.1, -0.1, side * 0.17],
    );
    stirrup.scale.y = 1.3;
    curve(
      group,
      mane,
      [
        [0.1, 0.13, side * 0.177],
        [0.1, 0.01, side * 0.19],
        [0.1, -0.1, side * 0.17],
      ],
      0.012,
    );
  }
  for (let i = 0; i < 7; i++) {
    const y = 0.54 - i * 0.047,
      x = -0.35 + i * 0.022;
    curve(
      group,
      mane,
      [
        [x, y, -0.018],
        [x + 0.08, y - 0.015, 0.012],
        [x + 0.09, y - 0.095, 0.018],
      ],
      0.032 - i * 0.0015,
    );
  }
  for (let i = 0; i < 5; i++) {
    const z = (i - 2) * 0.025;
    curve(
      group,
      mane,
      [
        [0.35, 0.06, z],
        [0.53, 0.08, z],
        [0.61, -0.12, z],
        [0.53, -0.31, z],
        [0.58, -0.35, z],
      ],
      0.027,
    );
  }
  consolidate(group);
  return group;
}
export function addGarden(parent: THREE.Object3D) {
  const greens = [paint('#637747'), paint('#899653'), paint('#a1a96d')],
    flowers = [
      paint('#d99b98'),
      paint('#e5cf9d'),
      paint('#b47665'),
      paint('#d8d9be'),
    ],
    center = paint('#b78b3f');
  const garden = new THREE.Group();
  garden.name = 'miniature-garden';
  parent.add(garden);
  const leafGeometry = new THREE.SphereGeometry(1, 10, 7),
    petalGeometry = new THREE.SphereGeometry(1, 10, 7);
  for (let cluster = 0; cluster < 9; cluster++) {
    const angle = (cluster * Math.PI * 2) / 9 + 0.2,
      radius = cluster % 3 === 0 ? 0.6 : 1.18;
    const x = Math.sin(angle) * radius,
      z = Math.cos(angle) * radius;
    for (let leaf = 0; leaf < 6; leaf++) {
      const a = angle + leaf * 2.4,
        stemHeight = 0.09 + (leaf % 3) * 0.045;
      const object = solid(garden, leafGeometry, greens[leaf % 3], [
        x + Math.sin(a) * 0.09,
        0.79 + stemHeight / 2,
        z + Math.cos(a) * 0.09,
      ]);
      object.scale.set(0.028, stemHeight, 0.052);
      object.rotation.set(Math.cos(a) * 0.7, a, Math.sin(a) * 0.7);
    }
    for (let f = 0; f < 3; f++) {
      const a = angle + f * 2.1,
        fx = x + Math.sin(a) * 0.1,
        fz = z + Math.cos(a) * 0.1,
        fy = 0.9 + (f % 2) * 0.11;
      const stem = solid(
        garden,
        new THREE.CylinderGeometry(0.006, 0.009, fy - 0.75, 5),
        greens[0],
        [fx, (fy + 0.75) / 2, fz],
      );
      stem.castShadow = false;
      const blossom = new THREE.Group();
      blossom.position.set(fx, fy, fz);
      blossom.rotation.set(0.25 * Math.sin(a), a, 0.22 * Math.cos(a));
      garden.add(blossom);
      for (let p = 0; p < 6; p++) {
        const b = (p * Math.PI * 2) / 6;
        const petal = solid(
          blossom,
          petalGeometry,
          flowers[(cluster + f) % 4],
          [Math.sin(b) * 0.038, 0, Math.cos(b) * 0.038],
        );
        petal.scale.set(0.032, 0.016, 0.047);
        petal.rotation.y = b;
      }
      oval(blossom, center, [0, 0.012, 0], [0.023, 0.018, 0.023]);
    }
  }
  consolidate(garden);
}
export function addPole(
  parent: THREE.Object3D,
  x: number,
  z: number,
  top: number,
) {
  const bottom = 0.75,
    pole = solid(
      parent,
      new THREE.CylinderGeometry(0.018, 0.021, top - bottom, 12),
      paint('#ddc9a1', 0.24),
      [x, (top + bottom) / 2, z],
    );
  pole.name = 'connected-carousel-pole';
  for (const y of [bottom + 0.025, top - 0.035]) {
    solid(parent, new THREE.CylinderGeometry(0.058, 0.067, 0.065, 16), brass, [
      x,
      y,
      z,
    ]);
  }
  const path: THREE.Vector3[] = [];
  for (let i = 0; i <= 220; i++) {
    const t = i / 220,
      a = t * Math.PI * 2 * 12;
    path.push(
      new THREE.Vector3(
        x + Math.sin(a) * 0.023,
        bottom + 0.08 + t * (top - bottom - 0.16),
        z + Math.cos(a) * 0.023,
      ),
    );
  }
  const helix = new THREE.CatmullRomCurve3(path);
  solid(parent, new THREE.TubeGeometry(helix, 220, 0.004, 4, false), brass);
}
