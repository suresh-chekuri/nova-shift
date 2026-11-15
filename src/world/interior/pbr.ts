// Surface maps for the ship interior, all drawn by code (no image files).
// Each surface gets a colour map, a bump map (relief) and a roughness map, so
// metal looks brushed, paint looks sprayed, and plates have real seams.
import * as THREE from 'three';

// A small fixed random generator, so the textures look the same on every run.
let seed = 20240611;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};
function toTex(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}
const store: Record<string, THREE.CanvasTexture> = {};
const once = (key: string, make: () => THREE.CanvasTexture) => (store[key] ??= make());
const gray = (v: number) => `rgb(${v},${v},${v})`;

// ------------------------------------------------------------ small tiling grain maps (used on every prop)
/** Fine streaks, like brushed aluminium. Grey image: used for bump and roughness. */
export function brushedMap() {
  return once('brushed', () => {
    const c = canvas(256, 256), g = c.getContext('2d')!;
    g.fillStyle = gray(200); g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const y = rnd() * 256, x = rnd() * 256, len = 20 + rnd() * 110;
      g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rnd() * 0.07})`;
      g.fillRect(x, y, len, 1);
      if (x + len > 256) g.fillRect(x - 256, y, len, 1); // wrap so the tile has no seam
    }
    return toTex(c, false);
  });
}
/** Fine orange-peel speckle, like sprayed paint. */
export function speckleMap() {
  return once('speckle', () => {
    const c = canvas(256, 256), g = c.getContext('2d')!;
    g.fillStyle = gray(190); g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5200; i++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + rnd() * 0.09})`;
      g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    return toTex(c, false);
  });
}
/** Crinkled foil, like gold thermal blanket. */
export function crinkleMap() {
  return once('crinkle', () => {
    const c = canvas(256, 256), g = c.getContext('2d')!;
    g.fillStyle = gray(150); g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 520; i++) {
      const x = rnd() * 256, y = rnd() * 256, r = 6 + rnd() * 22;
      const v = Math.floor(70 + rnd() * 150);
      g.fillStyle = `rgba(${v},${v},${v},0.55)`;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) g.lineTo(x + (rnd() - 0.5) * 2 * r, y + (rnd() - 0.5) * 2 * r);
      g.closePath(); g.fill();
    }
    return toTex(c, false);
  });
}
/** Soft rubber / composite weave. */
export function weaveMap() {
  return once('weave', () => {
    const c = canvas(128, 128), g = c.getContext('2d')!;
    g.fillStyle = gray(160); g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 8) {
      g.fillStyle = (x + y) % 16 ? gray(200) : gray(110);
      g.fillRect(x, y, 7, 7);
    }
    return toTex(c, false);
  });
}

// ------------------------------------------------------------ wall panels (one tile = 2 m wide, 4 m tall)
const PX = 256; // pixels per metre
function drawRivets(g: CanvasRenderingContext2D, xs: number[], y: number, bump: boolean) {
  for (const x of xs) {
    g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2);
    g.fillStyle = bump ? gray(235) : 'rgba(45,50,58,0.85)';
    g.fill();
    if (!bump) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x - 1, y - 1, 1.2, 0, Math.PI * 2); g.fill(); }
  }
}
function wallPair() {
  const W = 2 * PX, Hh = 4 * PX;
  const col = canvas(W, Hh), bmp = canvas(W, Hh), rgh = canvas(W, Hh);
  const c = col.getContext('2d')!, b = bmp.getContext('2d')!, r = rgh.getContext('2d')!;
  // y runs from the top of the tile (ceiling) down to the floor
  const yTop = (m: number) => Hh - m * PX; // metres above floor -> pixel
  c.fillStyle = '#aeb3b9'; c.fillRect(0, 0, W, Hh);
  b.fillStyle = gray(150); b.fillRect(0, 0, W, Hh);
  r.fillStyle = gray(190); r.fillRect(0, 0, W, Hh);
  // bands: dado (0-1.1 m) darker, main field (1.1-2.9 m) light, trunk band (2.9-4 m) mid grey
  c.fillStyle = '#8f959c'; c.fillRect(0, yTop(1.1), W, 1.1 * PX);
  c.fillStyle = '#9ba1a8'; c.fillRect(0, 0, W, yTop(2.9));
  // main field: two recessed panels, each with a bevelled frame
  for (const x0 of [14, PX + 14]) {
    const px = x0, py = yTop(2.82), pw = PX - 28, ph = 1.64 * PX;
    c.fillStyle = '#b9bec4'; c.fillRect(px, py, pw, ph);
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
    c.strokeStyle = 'rgba(25,30,38,0.55)'; c.lineWidth = 3; c.strokeRect(px + 5, py + 5, pw - 10, ph - 10);
    b.fillStyle = gray(105); b.fillRect(px + 6, py + 6, pw - 12, ph - 12); // recessed centre
    b.strokeStyle = gray(235); b.lineWidth = 4; b.strokeRect(px + 2, py + 2, pw - 4, ph - 4); // raised frame
    b.strokeStyle = gray(60); b.lineWidth = 3; b.strokeRect(px + 7, py + 7, pw - 14, ph - 14);
    // fastener rows
    const xs: number[] = []; for (let x = px + 18; x < px + pw - 10; x += 38) xs.push(x);
    drawRivets(c, xs, py + 12, false); drawRivets(b, xs, py + 12, true);
    drawRivets(c, xs, py + ph - 12, false); drawRivets(b, xs, py + ph - 12, true);
    r.fillStyle = gray(150); r.fillRect(px + 6, py + 6, pw - 12, ph - 12);
  }
  // horizontal stringers at the band edges
  for (const m of [1.1, 2.9]) {
    const y = yTop(m);
    c.fillStyle = '#6d737b'; c.fillRect(0, y - 6, W, 12);
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(0, y - 6, W, 2);
    b.fillStyle = gray(225); b.fillRect(0, y - 6, W, 12);
    b.fillStyle = gray(70); b.fillRect(0, y + 6, W, 2);
    r.fillStyle = gray(120); r.fillRect(0, y - 6, W, 12);
  }
  // trunk band: louvre slits and a cable channel
  c.fillStyle = '#7e848c'; c.fillRect(0, 12, W, yTop(2.9) - 24);
  for (let y = 24; y < yTop(2.9) - 40; y += 18) {
    c.fillStyle = 'rgba(15,18,24,0.55)'; c.fillRect(30, y, W - 60, 5);
    b.fillStyle = gray(55); b.fillRect(30, y, W - 60, 5);
  }
  // dado: kick-plate screws and a dark foot line
  const xs2: number[] = []; for (let x = 24; x < W; x += 64) xs2.push(x);
  drawRivets(c, xs2, yTop(0.9), false); drawRivets(b, xs2, yTop(0.9), true);
  // vertical seams at the tile edges
  c.fillStyle = '#4c525a'; c.fillRect(0, 0, 5, Hh); c.fillRect(W - 5, 0, 5, Hh); c.fillRect(PX - 2, yTop(2.9), 4, 1.8 * PX);
  b.fillStyle = gray(45); b.fillRect(0, 0, 5, Hh); b.fillRect(W - 5, 0, 5, Hh); b.fillRect(PX - 2, yTop(2.9), 4, 1.8 * PX);
  // light grime: darker near the floor, a little streaking
  const gr = c.createLinearGradient(0, Hh * 0.6, 0, Hh);
  gr.addColorStop(0, 'rgba(10,12,16,0)'); gr.addColorStop(1, 'rgba(10,12,16,0.3)');
  c.fillStyle = gr; c.fillRect(0, Hh * 0.6, W, Hh * 0.4);
  for (let i = 0; i < 2200; i++) {
    c.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.05})`;
    c.fillRect(rnd() * W, rnd() * Hh, 1 + rnd() * 2, 4 + rnd() * 14);
    b.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.05})`;
    b.fillRect(rnd() * W, rnd() * Hh, 2, 2);
  }
  return { col, bmp, rgh };
}

// ------------------------------------------------------------ floor plates (one tile = 2 m x 2 m, four 1 m plates)
function floorPair() {
  const S = 512, P = S / 2;
  const col = canvas(S, S), bmp = canvas(S, S), rgh = canvas(S, S);
  const c = col.getContext('2d')!, b = bmp.getContext('2d')!, r = rgh.getContext('2d')!;
  c.fillStyle = '#3a3f46'; c.fillRect(0, 0, S, S);
  b.fillStyle = gray(150); b.fillRect(0, 0, S, S);
  r.fillStyle = gray(170); r.fillRect(0, 0, S, S);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const x0 = i * P, y0 = j * P, tread = (i + j) % 2 === 0;
    const tone = tread ? 60 : 52;
    c.fillStyle = `rgb(${tone},${tone + 4},${tone + 10})`; c.fillRect(x0 + 3, y0 + 3, P - 6, P - 6);
    if (tread) {
      // diamond tread: crossed diagonal ribs
      c.save(); b.save();
      c.beginPath(); c.rect(x0 + 4, y0 + 4, P - 8, P - 8); c.clip();
      b.beginPath(); b.rect(x0 + 4, y0 + 4, P - 8, P - 8); b.clip();
      c.strokeStyle = 'rgba(150,158,168,0.42)'; b.strokeStyle = gray(225); c.lineWidth = 2; b.lineWidth = 3;
      for (let k = -P; k < P * 2; k += 16) {
        c.beginPath(); c.moveTo(x0 + k, y0); c.lineTo(x0 + k + P, y0 + P); c.stroke();
        b.beginPath(); b.moveTo(x0 + k, y0); b.lineTo(x0 + k + P, y0 + P); b.stroke();
      }
      c.restore(); b.restore();
      r.fillStyle = gray(215); r.fillRect(x0 + 3, y0 + 3, P - 6, P - 6);
    } else {
      // smooth plate with a bevelled frame and a fine grain
      c.strokeStyle = 'rgba(190,198,208,0.28)'; c.lineWidth = 2; c.strokeRect(x0 + 14, y0 + 14, P - 28, P - 28);
      b.strokeStyle = gray(210); b.lineWidth = 3; b.strokeRect(x0 + 14, y0 + 14, P - 28, P - 28);
      r.fillStyle = gray(120); r.fillRect(x0 + 3, y0 + 3, P - 6, P - 6);
    }
    // seam groove and corner bolts
    c.strokeStyle = 'rgba(6,8,12,0.95)'; c.lineWidth = 6; c.strokeRect(x0 + 2, y0 + 2, P - 4, P - 4);
    b.strokeStyle = gray(25); b.lineWidth = 6; b.strokeRect(x0 + 2, y0 + 2, P - 4, P - 4);
    for (const [bx, by] of [[18, 18], [P - 18, 18], [18, P - 18], [P - 18, P - 18]]) {
      c.fillStyle = '#9aa1a9'; c.beginPath(); c.arc(x0 + bx, y0 + by, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1d22'; c.fillRect(x0 + bx - 3, y0 + by - 0.8, 6, 1.6);
      b.fillStyle = gray(240); b.beginPath(); b.arc(x0 + bx, y0 + by, 5, 0, Math.PI * 2); b.fill();
    }
  }
  for (let i = 0; i < 3000; i++) {
    c.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.05})`;
    c.fillRect(rnd() * S, rnd() * S, 2, 2);
  }
  // scuffs where people walk
  for (let i = 0; i < 40; i++) {
    c.fillStyle = `rgba(190,196,204,${0.03 + rnd() * 0.05})`;
    c.fillRect(rnd() * S, rnd() * S, 20 + rnd() * 50, 2);
  }
  return { col, bmp, rgh };
}

// ------------------------------------------------------------ ceiling composite panels (2 m x 2 m)
function ceilPair() {
  const S = 512;
  const col = canvas(S, S), bmp = canvas(S, S), rgh = canvas(S, S);
  const c = col.getContext('2d')!, b = bmp.getContext('2d')!, r = rgh.getContext('2d')!;
  c.fillStyle = '#7f858d'; c.fillRect(0, 0, S, S);
  b.fillStyle = gray(150); b.fillRect(0, 0, S, S);
  r.fillStyle = gray(200); r.fillRect(0, 0, S, S);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const x0 = i * 256, y0 = j * 256;
    c.fillStyle = (i + j) % 2 ? '#838990' : '#7a8088'; c.fillRect(x0 + 4, y0 + 4, 248, 248);
    c.strokeStyle = 'rgba(8,10,14,0.85)'; c.lineWidth = 5; c.strokeRect(x0 + 2, y0 + 2, 252, 252);
    b.strokeStyle = gray(30); b.lineWidth = 5; b.strokeRect(x0 + 2, y0 + 2, 252, 252);
    for (let k = 20; k < 250; k += 36) for (const yy of [14, 242]) {
      c.fillStyle = 'rgba(30,34,40,0.8)'; c.beginPath(); c.arc(x0 + k, y0 + yy, 3, 0, Math.PI * 2); c.fill();
      b.fillStyle = gray(235); b.beginPath(); b.arc(x0 + k, y0 + yy, 3, 0, Math.PI * 2); b.fill();
    }
  }
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.05})`;
    c.fillRect(rnd() * S, rnd() * S, 2, 2);
  }
  return { col, bmp, rgh };
}

// ------------------------------------------------------------ materials for the shell
interface Set3 { map: THREE.CanvasTexture; bump: THREE.CanvasTexture; rough: THREE.CanvasTexture }
function build(kind: string, pair: () => { col: HTMLCanvasElement; bmp: HTMLCanvasElement; rgh: HTMLCanvasElement }): Set3 {
  const p = pair();
  return {
    map: once(kind + ':c', () => toTex(p.col, true)),
    bump: once(kind + ':b', () => toTex(p.bmp, false)),
    rough: once(kind + ':r', () => toTex(p.rgh, false)),
  };
}
const sets: Record<string, Set3> = {};
const matCache: Record<string, THREE.MeshStandardMaterial> = {};
const lazySet = (kind: string, pair: () => { col: HTMLCanvasElement; bmp: HTMLCanvasElement; rgh: HTMLCanvasElement }) => (sets[kind] ??= build(kind, pair));

/** Wall material. rx = tile repeats along the wall (length / 2 m), ry and oy pick a vertical slice of the 4 m tile. */
export function wallMat(rx: number, ry = 1, oy = 0) {
  const key = `wall:${rx.toFixed(3)}:${ry}:${oy}`;
  if (matCache[key]) return matCache[key];
  const s = lazySet('wall', wallPair);
  const clone = (t: THREE.CanvasTexture) => { const n = t.clone(); n.needsUpdate = true; n.repeat.set(Math.max(0.05, rx), ry); n.offset.set(0, oy); return n; };
  return (matCache[key] = new THREE.MeshStandardMaterial({
    map: clone(s.map), bumpMap: clone(s.bump), bumpScale: 1.4, roughnessMap: clone(s.rough), roughness: 0.82, metalness: 0.25,
  }));
}
/** Floor plates. w, d in metres (the plane's size). */
export function floorMat(w: number, d: number) {
  const key = `floor:${w.toFixed(2)}:${d.toFixed(2)}`;
  if (matCache[key]) return matCache[key];
  const s = lazySet('floor', floorPair);
  const clone = (t: THREE.CanvasTexture) => { const n = t.clone(); n.needsUpdate = true; n.repeat.set(w / 2, d / 2); return n; };
  return (matCache[key] = new THREE.MeshStandardMaterial({
    map: clone(s.map), bumpMap: clone(s.bump), bumpScale: 1.8, roughnessMap: clone(s.rough), roughness: 0.9, metalness: 0.55,
  }));
}
export function ceilMat(w: number, d: number) {
  const key = `ceil:${w.toFixed(2)}:${d.toFixed(2)}`;
  if (matCache[key]) return matCache[key];
  const s = lazySet('ceil', ceilPair);
  const clone = (t: THREE.CanvasTexture) => { const n = t.clone(); n.needsUpdate = true; n.repeat.set(w / 2, d / 2); return n; };
  return (matCache[key] = new THREE.MeshStandardMaterial({
    map: clone(s.map), bumpMap: clone(s.bump), bumpScale: 1.2, roughnessMap: clone(s.rough), roughness: 0.9, metalness: 0.25,
  }));
}

// ------------------------------------------------------------ soft contact shadow (fake ambient occlusion under big objects)
export function blobMap() {
  return once('blob', () => {
    const c = canvas(128, 128), g = c.getContext('2d')!;
    const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = toTex(c, true);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}
