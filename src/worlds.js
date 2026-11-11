import * as THREE from 'three';
import {toon, box, cyl, sign, cloud, paintTex, ink, arrow} from './kit.js';
import {character} from './char.js';
import {wordT} from './camera.js';
import * as P from './props.js';
import timing from './timing.json';

const S = Object.fromEntries(timing.shots.map((s) => [s.key, s]));

// smooth 0..1 between a and b (seconds)
export const ease = (t, a, b) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

// ---------- geometry helpers ----------
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
function strut(a, b, r, color, seg = 6) {
  const A = V(a), B = V(b), dir = B.clone().sub(A), len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), toon(color));
  m.position.copy(A.clone().add(B).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return ink(m, 0.02, false);
}
// painted earth block: top colour + side colour, outlined
function slab(x0, x1, y0, y1, z0, z1, {top = '#7fb061', side = '#8a6a4a', seed = 1} = {}) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const mk = (c, sd, rx, ry) => { const t = paintTex(c, {seed: sd, stains: 10, chips: 12, scratches: 6}); t.repeat.set(Math.max(1, rx), Math.max(1, ry)); return toon('#ffffff', t); };
  const sideX = mk(side, seed, d / 12, h / 8), sideZ = mk(side, seed + 1, w / 12, h / 8), topM = mk(top, seed + 2, w / 12, d / 12);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideX, sideX, topM, sideZ, sideZ, sideZ]);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return ink(m, 0.05, true);
}
function derrick() {
  const g = new THREE.Group();
  const base = 1.5, baseZ = 1.2, top = 0.35, y0 = 0.4, y1 = 9;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(strut([sx * base, y0, sz * baseZ], [sx * top, y1, sz * top], 0.11, '#d9a441'));
  const half = (y) => [base + (top - base) * (y - y0) / (y1 - y0), baseZ + (top - baseZ) * (y - y0) / (y1 - y0)];
  const lv = [1.8, 3.6, 5.4, 7.2];
  for (const y of lv) {
    const [hx, hz] = half(y);
    g.add(box(hx * 2, 0.1, 0.1, '#c98f2e', {y, z: hz, thick: 0.01}), box(hx * 2, 0.1, 0.1, '#c98f2e', {y, z: -hz, thick: 0.01}),
      box(0.1, 0.1, hz * 2, '#c98f2e', {x: hx, y, thick: 0.01}), box(0.1, 0.1, hz * 2, '#c98f2e', {x: -hx, y, thick: 0.01}));
  }
  for (let i = 0; i < lv.length - 1; i++) {
    const [a1, z1] = half(lv[i]), [a2, z2] = half(lv[i + 1]); const f = i % 2 ? 1 : -1;
    g.add(strut([f * a1, lv[i], z1], [-f * a2, lv[i + 1], z2], 0.04, '#c98f2e', 4));
  }
  g.add(box(1.1, 0.7, 1.1, '#8a8f93', {y: y1 + 0.35}));
  return g;
}
const swirlTexture = () => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  g.translate(256, 256); g.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    g.beginPath();
    for (let a = 0; a < 5.2; a += 0.05) { const r = 22 + a * 44, x = r * Math.cos(a + k * 1.2566), y = r * Math.sin(a + k * 1.2566); if (a === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 16; g.stroke();
  }
  g.fillStyle = '#1d3a52'; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const stripeTexture = () => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#cfeaf6'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#ffffff';
  for (let i = 0; i < 8; i++) g.fillRect((i % 2) * 20 + 8, i * 32, 14, 22);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
};
const person = (palette, hat, seed, glasses = false) => character({palette, hat, glasses, seed});

export function buildWorld() {
  const W = new THREE.Group();
  const chars = [];
  const FRONT = 2.2;           // the cut-away front face of the diorama
  const BED = -3.0;            // lake bed (top)

  // ======== EARTH ========
  W.add(slab(-130, -12, -13, 0, -130, FRONT, {seed: 3}));                      // left bank
  W.add(slab(12, 130, -13, 0, -130, FRONT, {seed: 5}));                        // right bank
  W.add(slab(-12, 12, -13, 0, -130, -7, {seed: 7}));                           // back bank (and gallery back wall)
  W.add(slab(-12, 12, -3.4, -3.0, -7, FRONT, {top: '#d9c08a', side: '#c9ad78', seed: 9}));   // lake bed (sand)
  W.add(slab(-12, -0.45, -7, -3.4, -7, FRONT, {top: '#8a6a4a', side: '#8a6a4a', seed: 11}));  // soil above the mine, left of the bore hole
  W.add(slab(0.45, 12, -7, -3.4, -7, FRONT, {top: '#8a6a4a', side: '#8a6a4a', seed: 13}));    // ... and right of it
  W.add(box(0.9, 3.6, 6.4, '#3a2d4c', {x: 0, y: -5.2, z: -3.8, thick: 0.01, edges: false})); // back of the bore-hole slot
  // ======== SALT MINE (open at the front) ========
  W.add(slab(-12, 12, -13, -12, -7, FRONT, {top: '#6a5a52', side: '#8a6a4a', seed: 15}));
  W.add(box(24, 5, 0.1, '#3a2d4c', {x: 0, y: -9.5, z: -6.95, thick: 0.01, edges: false}));
  for (const [x, z] of [[-8, -2.4], [-3.8, -4.6], [3.8, -2.4], [8, -4.6], [-9.8, -5.4], [10, -1.6]]) W.add(box(1.8, 5, 1.8, '#f1ece0', {x, y: -9.5, z, thick: 0.03}));
  for (const x of [-9, -4, 4, 9]) {
    W.add(cyl(0.03, 0.03, 0.5, '#2a2a2a', {x, y: -7.25, z: 0.5}));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({color: '#ffe2a6'})); bulb.position.set(x, -7.6, 0.5); W.add(bulb);
  }
  const mineLight = new THREE.PointLight('#ffd9a0', 7, 26, 1.6); mineLight.position.set(0, -8, 3.5); W.add(mineLight);
  W.add(box(2, 5, 2.5, '#6a7078', {x: -11, y: -9.5, z: -1.5, thick: 0.03}));
  const exitS = sign('EXIT', 2.0, 0.8, {bg: '#3d9a5a', fg: '#fff4dc', w: 512, h: 200}); exitS.position.set(-11, -8.2, -0.2); W.add(exitS);
  const alarmS = sign('ALARM', 2.0, 0.8, {bg: '#c43d32', fg: '#fff4dc', w: 512, h: 200}); alarmS.position.set(3.4, -8.6, -6.8); W.add(alarmS);
  W.add(P.at(P.barrel('#2f6db3'), -6.5, -12, -4.2), P.at(P.barrel('#c43d32'), -5.6, -12, -4.6), P.at(P.barrel('#2f6db3'), 6.4, -12, -3.4), P.at(P.pallet(), 9.5, -12, 0.2));
  // water falling down the bore hole + flood on the mine floor
  const fallMat = new THREE.MeshBasicMaterial({color: '#cfeaf6', transparent: true, opacity: 0.9});
  const fall = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8.6, 0.7), fallMat); fall.position.set(0, -7.7, 0); W.add(fall);
  const floodGeo = new THREE.BoxGeometry(23.6, 1, 8.8); floodGeo.translate(0, 0.5, 0);
  const flood = new THREE.Mesh(floodGeo, new THREE.MeshBasicMaterial({color: '#6bb7d9', transparent: true, opacity: 0.55, depthWrite: false})); flood.position.set(0, -12, -2.4); flood.scale.y = 0.01; W.add(flood);

  // ======== LAKE ========
  const waterMat = toon('#5fb3d9', null, {transparent: true, opacity: 0.7, depthWrite: false}).clone();
  const waterGeo = new THREE.BoxGeometry(24, 3, 9.2); waterGeo.translate(0, 1.5, 0);
  const water = new THREE.Mesh(waterGeo, waterMat); water.position.set(0, -3, -2.4); water.renderOrder = 2; W.add(water);
  // whirlpool + hole in the lake bed
  const swirl = new THREE.Group(); const swirlMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({map: swirlTexture(), transparent: true, depthWrite: false}));
  swirlMesh.rotation.x = -Math.PI / 2; swirl.add(swirlMesh); swirl.renderOrder = 3; W.add(swirl);
  const hole = new THREE.Group(); hole.position.set(0, BED + 0.03, 0);
  const rim = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.28, 40), new THREE.MeshBasicMaterial({color: '#efe9dc'})); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.01;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({color: '#1d1626'})); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02;
  hole.add(rim, disc); W.add(hole);
  // depth post, boats
  const post = new THREE.Group(); post.add(cyl(0.07, 0.07, 4.9, '#6b4430', {y: -0.55}));
  const depthS = sign('10 FT', 1.5, 0.75, {bg: '#f2e6cc', w: 400, h: 200}); depthS.position.set(0, 1.5, 0.12); post.add(depthS); post.position.set(-4.0, 0, 1.4); W.add(post);
  const boats = [[-7.8, 1.0, '#c8463a'], [5.4, -2.5, '#2f6db3']].map(([x, z, c]) => {
    const g = new THREE.Group(); g.add(box(2.2, 0.5, 0.9, c, {y: 0.1}), box(0.5, 0.08, 0.8, '#f2e6cc', {x: 0.2, y: 0.4}), box(0.06, 1.4, 0.06, '#6b4430', {x: -0.7, y: 1.1}));
    g.position.set(x, 0, z); W.add(g); return g;
  });
  // ======== RIG ========
  const rig = new THREE.Group(); W.add(rig);
  rig.add(box(6.4, 0.7, 4.2, '#6b5a4a', {y: 0.05, thick: 0.04}), derrick());
  rig.add(box(2.2, 1.1, 0.8, '#e6e0d0', {x: 2.1, y: 0.95, z: 1.0, thick: 0.03}));
  const texacoS = sign('TEXACO', 2.0, 0.7, {bg: '#c43d32', fg: '#fff4dc', w: 512, h: 190}); texacoS.position.set(2.1, 0.95, 1.45); rig.add(texacoS);
  const pipe = new THREE.Group(); pipe.add(strut([0, 7.5, 0], [0, -8.1, 0], 0.16, '#9aa0a8'));
  const bit = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0, 0.5, 8), toon('#4b4e55')); bit.position.set(0, -8.35, 0); ink(bit, 0.02, false); pipe.add(bit); W.add(pipe);
  const dock = box(8.8, 0.25, 1.2, '#8a5a3b', {x: 7.6, y: 0.1, z: 1.1, thick: 0.03}); W.add(dock);
  const stuckS = sign('STUCK', 1.6, 0.6, {bg: '#e6d39a', fg: '#b3261e', w: 400, h: 150}); stuckS.position.set(1.4, 2.6, 0.8); W.add(stuckS);
  const calS = sign('NOV 20 1980', 3.2, 1.0, {bg: '#f4ead4', w: 640, h: 200}); calS.position.set(-4.6, 4.6, 1.2); W.add(calS);
  const crew = [[-1.4, 'welder', 31], [1.6, 'engineer', 32]].map(([x, pal, sd]) => { const c = person(pal, 'cap', sd); c.userData.x0 = x; W.add(c); chars.push(c); return c; });
  const barges = [[-8.5, -4.2], [6.8, -3.4], [9.4, -0.6]].map(([x, z]) => {
    const g = new THREE.Group(); g.add(box(3.2, 0.55, 1.3, '#6f6a5c', {y: 0.05, thick: 0.03}), box(1.0, 0.7, 0.9, '#c8463a', {x: -0.8, y: 0.65}), box(0.8, 0.5, 0.9, '#4f86b8', {x: 0.5, y: 0.55}));
    g.userData = {a0: Math.atan2(z, x), r0: Math.hypot(x, z)}; g.position.set(x, 0, z); W.add(g); return g;
  });
  const sign3 = new THREE.Group(); sign3.add(cyl(0.07, 0.07, 8.4, '#6b4430', {y: 1.2}));
  const s3a = sign('3 HOURS', 2.6, 0.9, {bg: '#f2e6cc', w: 520, h: 180}); s3a.position.set(0, 4.7, 0.12);
  const s3b = sign('3.5 BILLION GALLONS', 4.6, 0.95, {bg: '#f2e6cc', w: 920, h: 190, font: 'bold 80px Arial, sans-serif'}); s3b.position.set(1.0, 3.5, 0.12);
  sign3.add(s3a, s3b); sign3.position.set(-7.5, 0, 1.0); W.add(sign3);
  // ======== MINERS ========
  const minerDefs = [[6.4, 'mustard'], [4.9, 'teal'], [3.4, 'navy'], [-2.0, 'red'], [-5.0, 'pink'], [7.9, 'student']];
  const miners = minerDefs.map(([x, pal], i) => { const c = person(pal, 'cap', 40 + i); c.userData.x0 = x; c.position.set(x, -11.95, i % 2 ? 1.5 : 0.9); W.add(c); chars.push(c); return c; });
  const worker = person('mustard', 'cap', 49); worker.position.set(1.8, -11.95, 1.2); W.add(worker); chars.push(worker);
  // ======== TEA TABLE (on the dry lake bed) ========
  const tea = new THREE.Group();
  tea.add(box(1.8, 0.1, 1.2, '#8a5a3b', {y: 1.0}));
  for (const [x, z] of [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]]) tea.add(box(0.1, 1.0, 0.1, '#6b4430', {x, y: 0.5, z, thick: 0.01}));
  tea.add(cyl(0.65, 0.65, 0.05, '#f4efe6', {y: 1.08, seg: 24, thick: 0.01}), cyl(0.42, 0.34, 0.5, '#f4efe6', {y: 1.36, seg: 24, thick: 0.02}), cyl(0.38, 0.38, 0.02, '#a8643a', {y: 1.6, seg: 24, thick: 0.002}));
  const cube = box(0.24, 0.24, 0.24, '#ffffff', {x: 0.08, y: 1.58, z: 0, thick: 0.01}); tea.add(cube);
  tea.position.set(3.4, BED, 0.7); W.add(tea);
  // ======== CANAL + WATERFALL (right bank) ========
  const canal = new THREE.Group();
  canal.add(box(14, 0.14, 2.6, '#4fb0a5', {x: 19, y: 0.07, z: 0.3, thick: 0.01}));
  const arrows = [0, 1, 2].map((i) => { const o = new THREE.Group(); const a = arrow('#fff4dc', 1.8); a.rotation.x = -Math.PI / 2; a.position.set(-0.9, 0.14, 0); o.add(a); o.rotation.y = Math.PI; o.position.set(0, 0, 0.3); canal.add(o); return o; });
  const gulfS = sign('GULF', 2.4, 0.9, {bg: '#f2e6cc', w: 480, h: 180}); gulfS.position.set(24.4, 1.9, 1.7); canal.add(cyl(0.07, 0.07, 1.9, '#6b4430', {x: 24.4, y: 0.95, z: 1.6}), gulfS);
  const stripes = stripeTexture();
  const fallMats = Array.from({length: 6}, () => new THREE.MeshBasicMaterial({color: '#dff2fa'})); fallMats[4] = new THREE.MeshBasicMaterial({map: stripes});
  const curtain = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.1, 2.6), fallMats); curtain.position.set(11.3, -1.45, 0.3); canal.add(curtain);
  const foam = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), toon('#f4fbff')); foam.position.set(10.6, -2.8, 1.4); ink(foam, 0.03, false); canal.add(foam);
  W.add(canal);
  // ======== NATURAL GAS (left bank) ========
  const gas = new THREE.Group();
  const tank = new THREE.Mesh(new THREE.SphereGeometry(2.3, 20, 14), toon('#dfe5ea')); tank.position.set(-17.5, 3.5, -1.5); ink(tank, 0.04, false); gas.add(tank);
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) gas.add(cyl(0.18, 0.18, 1.6, '#6a7078', {x: -17.5 + x, y: 0.8, z: -1.5 + z}));
  gas.add(box(6, 0.45, 0.45, '#8a8f93', {x: -14.8, y: 0.45, z: -1.5}), box(0.45, 0.45, 4, '#8a8f93', {x: -17.5, y: 0.45, z: 0.5}));
  const gasS = sign('NATURAL GAS', 3.8, 1.0, {bg: '#f2e6cc', w: 760, h: 200}); gasS.position.set(-14.2, 2.7, 1.8); gas.add(cyl(0.07, 0.07, 2.2, '#6b4430', {x: -14.2, y: 1.1, z: 1.7}), gasS);
  W.add(gas);
  // ======== DRESSING ========
  for (const [x, z, s, sd] of [[-16, -3, 1.4, 1], [-21, -8, 1.6, 2], [-24, 0, 1.3, 3], [16.5, -4, 1.5, 4], [21, -9, 1.6, 5], [14.5, -10, 1.3, 6], [-7, -12, 1.5, 7], [0, -14, 1.7, 8], [7, -11, 1.4, 9], [-14, -14, 1.6, 10], [13, -16, 1.6, 11]]) W.add(P.at(P.tree(s, sd), x, 0, z));
  for (let i = 0; i < 6; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(30 + (i % 3) * 8, 20, 14), toon(['#6aa05a', '#5f9650', '#78ad62'][i % 3])); h.position.set(-120 + i * 48, -8, -95); h.scale.y = 0.42; W.add(h); }
  for (let i = 0; i < 7; i++) W.add(cloud(-90 + i * 30, 62 + (i % 3) * 9, -120, 7));

  // ======== per-frame update ========
  const update = (t, cam, shot) => {
    for (const c of chars) c.userData.update(t, cam.position);
    // water level: drains during whirl..sink, refills during close
    const drain = ease(t, wordT('whirl', 3), S.sink.end), refill = ease(t, S.close.start, wordT('close', 5));
    const lvl = 1 - 0.97 * drain * (1 - refill), surf = -3 + 3 * lvl;
    water.scale.y = lvl; waterMat.color.set(t > wordT('close', 5) ? '#4fb0a5' : '#5fb3d9');
    // whirlpool + hole
    const sw = t > wordT('whirl', 1) && t < S.grow.start - 0.3;
    swirl.visible = sw; swirl.position.set(0, surf + 0.04, 0); swirl.scale.setScalar(0.5 + 1.6 * ease(t, wordT('whirl', 1), S.sink.end)); swirl.rotation.y = -t * 4;
    hole.scale.setScalar(0.35 + 0.45 * drain + 0.5 * ease(t, S.grow.start, S.grow.end) + 0.8 * ease(t, wordT('salt', 11), S.salt.end));
    fall.visible = t > wordT('whirl', 2) && t < S.grow.start + 0.5;
    flood.scale.y = 0.01 + 0.5 * ease(t, wordT('whirl', 3), S.miners.end) * (t < S.close.start ? 1 : 0.01);
    flood.visible = t > wordT('whirl', 2);
    // rig: floats, gets stuck, tilts, falls into the hole
    const tilt = 0.55 * ease(t, wordT('tilt', 7), S.tilt.end + 0.3), fl = ease(t, wordT('sink', 1), wordT('sink', 6));
    const jit = shot === 'stuck' ? Math.sin(t * 35) * 0.006 : 0;
    rig.position.set(1.5 * fl, Math.max(surf, -2.55) - 5.5 * fl, 0); rig.rotation.z = -(tilt + 0.95 * fl) + jit; rig.visible = fl < 0.995;
    pipe.visible = fl < 0.6;
    dock.position.y = Math.max(surf, -2.6) + 0.1; dock.visible = t < S.whirl.start + 1;
    crew.forEach((c, i) => {
      const run = ease(t, wordT('tilt', 7) + i * 0.15, wordT('tilt', 7) + 1.8 + i * 0.15);
      c.position.set(c.userData.x0 + (13.2 - c.userData.x0) * run, Math.max(surf, -2.6) + 0.45, 1.3);
      c.visible = t < S.whirl.start + 1;
      if (shot === 'stuck' && t > wordT('stuck', 5)) { const s = Math.sin(t * 16 + i) * 0.35; c.userData.armR.rotation.z = 2.3 + s; c.userData.armL.rotation.z = -2.3 - s; }
      if (run > 0.02 && run < 0.98) { c.userData.armR.rotation.z = Math.sin(t * 12 + i) * 0.9; c.userData.armL.rotation.z = -Math.sin(t * 12 + i) * 0.9; }
    });
    // barges + boats
    const bp = ease(t, wordT('sink', 5), wordT('sink', 12));
    barges.forEach((g, i) => {
      const a = g.userData.a0 + bp * 7, r = g.userData.r0 * (1 - bp) + 0.3 * bp;
      g.position.set(r * Math.cos(a), Math.max(surf, -2.6) + 0.25 - 1.4 * bp, r * Math.sin(a)); g.rotation.set(0, -a + bp * 3, bp * 0.7 * (i % 2 ? 1 : -1)); g.visible = bp < 0.98 && t < S.grow.start;
    });
    boats.forEach((g, i) => { g.position.y = surf + 0.15 + Math.sin(t * 1.6 + i) * 0.04; g.visible = t < S.whirl.start; });
    // in-world labels
    post.visible = t < S.whirl.start;
    calS.visible = t > wordT('stuck', 1) && t < S.tilt.start + 1.0;
    stuckS.visible = t > wordT('stuck', 9) - 0.1 && t < S.whirl.start;
    const s3 = t > wordT('gone', 1) && t < S.grow.start; sign3.visible = s3;
    s3a.scale.setScalar(Math.max(0.001, ease(t, wordT('gone', 1), wordT('gone', 1) + 0.4)));
    s3b.scale.setScalar(Math.max(0.001, ease(t, wordT('gone', 3), wordT('gone', 3) + 0.4)));
    // miners: alarm, then run to the exit
    const t0 = wordT('miners', 5);
    miners.forEach((c, i) => {
      const x = c.userData.x0 - 4.2 * Math.max(0, t - t0 - i * 0.12);
      c.position.x = x; c.visible = x > -10.3;
      if (t > t0 + i * 0.12) { c.userData.armR.rotation.z = Math.sin(t * 11 + i) * 0.9; c.userData.armL.rotation.z = -Math.sin(t * 11 + i) * 0.9; c.position.y = -11.95 + Math.abs(Math.sin(t * 11 + i)) * 0.06; }
    });
    if (t > wordT('miners', 0) && t < t0) worker.userData.armR.rotation.z = 2.6 + Math.sin(t * 14) * 0.5;
    // tea: the sugar cube dissolves, then the hole widens
    tea.visible = t > S.grow.end && t < S.salt.end + 0.2;
    cube.scale.setScalar(Math.max(0.001, 1 - ease(t, wordT('salt', 7), wordT('salt', 10))));
    // canal: water runs backward, toward the lake
    const showC = t > S.miners.end && t < S.close.start + 2.0;
    canal.visible = showC;
    arrows.forEach((o, i) => { o.position.x = 25 - ((i * 4 + t * 3.2) % 12); });
    stripes.offset.y = -t * 1.6;
    curtain.visible = t < S.close.start + 1.4;
    gas.visible = true;
  };
  return {group: W, update};
}
