// Procedural Moon and Earth pictures (textures). No image files and no internet needed.
// Everything is drawn with a seeded random number generator, so the planets look the same every time.
//
// `sun` is optional. If you give it, the sun light is painted into the picture ("baked").
// That is used for the planets seen through the ship windows, which do not use real lights.

export interface Sun { dir: [number, number, number]; rotY: number }

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 3D value noise (smooth random numbers in 3D space) ----
function hash3(x: number, y: number, z: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function noise3(x: number, y: number, z: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const a = hash3(ix, iy, iz, seed), b = hash3(ix + 1, iy, iz, seed);
  const c = hash3(ix, iy + 1, iz, seed), d = hash3(ix + 1, iy + 1, iz, seed);
  const e = hash3(ix, iy, iz + 1, seed), f = hash3(ix + 1, iy, iz + 1, seed);
  const g = hash3(ix, iy + 1, iz + 1, seed), h = hash3(ix + 1, iy + 1, iz + 1, seed);
  const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (h - g) * u;
  const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
  return y1 + (y2 - y1) * w;
}
export function fbm(x: number, y: number, z: number, oct: number, seed: number) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * noise3(x * f, y * f, z * f, seed + i * 17);
    norm += amp; amp *= 0.5; f *= 2.03;
  }
  return s / norm;
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Point on the sphere for a pixel. This matches how three.js maps a picture onto a sphere.
function spherePoint(px: number, py: number, w: number, h: number, out: number[]) {
  const phi = ((px + 0.5) / w) * Math.PI * 2;
  const theta = ((py + 0.5) / h) * Math.PI;
  const st = Math.sin(theta);
  out[0] = -Math.cos(phi) * st;
  out[1] = Math.cos(theta);
  out[2] = Math.sin(phi) * st;
}

/** Paint sun light into a finished picture. */
function bakeSun(c: HTMLCanvasElement, sun: Sun, ambient: number, relief?: HTMLCanvasElement) {
  const w = c.width, h = c.height;
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hd = relief ? relief.getContext('2d')!.getImageData(0, 0, w, h).data : null;
  const cr = Math.cos(sun.rotY), sr = Math.sin(sun.rotY);
  const n = [0, 0, 0];
  const len = Math.hypot(...sun.dir);
  const sx = sun.dir[0] / len, sy = sun.dir[1] / len, sz = sun.dir[2] / len;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      spherePoint(px, py, w, h, n);
      let nx = n[0], ny = n[1], nz = n[2];
      if (hd) {
        // relief: tilt the surface direction using the slope of the height picture
        const l = hd[(py * w + ((px + w - 1) % w)) * 4], r = hd[(py * w + ((px + 1) % w)) * 4];
        const u = hd[(Math.max(0, py - 1) * w + px) * 4], dn = hd[(Math.min(h - 1, py + 1) * w + px) * 4];
        const hx = Math.max(-1, Math.min(1, ((r - l) / 255) * 3.2)), hy = Math.max(-1, Math.min(1, ((dn - u) / 255) * 3.2));
        const phi = ((px + 0.5) / w) * Math.PI * 2, theta = ((py + 0.5) / h) * Math.PI;
        const ex = Math.sin(phi), ez = Math.cos(phi);
        const sx2 = -Math.cos(phi) * Math.cos(theta), sy2 = -Math.sin(theta), sz2 = Math.sin(phi) * Math.cos(theta);
        nx -= hx * ex + hy * sx2; ny -= hy * sy2; nz -= hx * ez + hy * sz2;
        const ln = Math.hypot(nx, ny, nz) || 1; nx /= ln; ny /= ln; nz /= ln;
      }
      const wx = nx * cr + nz * sr, wz = -nx * sr + nz * cr;
      const dot = wx * sx + ny * sy + wz * sz;
      const f = ambient + (1 - ambient) * smooth(-0.04, 0.35, dot) * (0.75 + 0.25 * clamp01(dot));
      const i = (py * w + px) * 4;
      d[i] = 255 * Math.pow(Math.pow(d[i] / 255, 2.2) * f, 1 / 2.2);
      d[i + 1] = 255 * Math.pow(Math.pow(d[i + 1] / 255, 2.2) * f, 1 / 2.2);
      d[i + 2] = 255 * Math.pow(Math.pow(d[i + 2] / 255, 2.2) * f, 1 / 2.2);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// =============================================================== MOON
// Made to look like the real Moon seen from Earth:
//  * grey highlands and dark "seas" (maria) in the real places (Imbrium, Serenitatis, Crisium, Tranquillitatis ...),
//  * ring walls around the big basins, wrinkle ridges in the seas,
//  * many craters with raised rims, flat floors and central peaks (a power-law mix of sizes),
//  * bright young craters with long rays (Tycho, Copernicus, Kepler, Aristarchus),
//  * the far side is almost all highlands, like the real thing.
// Map layout: the middle of the picture is the near side (longitude 0). East is to the right. North is at the top.
interface Mare { lon: number; lat: number; rx: number; ry: number; k: number }
const MARIA: Mare[] = [
  { lon: -16, lat: 34, rx: 17, ry: 14, k: 1.0 },    // Imbrium
  { lon: 18, lat: 28, rx: 9, ry: 8, k: 1.0 },       // Serenitatis
  { lon: 31, lat: 8, rx: 12, ry: 9, k: 0.95 },      // Tranquillitatis
  { lon: 52, lat: -5, rx: 9, ry: 10, k: 0.85 },     // Fecunditatis
  { lon: 59, lat: 17, rx: 6, ry: 5, k: 1.0 },       // Crisium
  { lon: 34, lat: -15, rx: 5, ry: 5, k: 0.9 },      // Nectaris
  { lon: -55, lat: 18, rx: 24, ry: 24, k: 0.82 },   // Oceanus Procellarum
  { lon: -16, lat: -21, rx: 9, ry: 7, k: 0.9 },     // Nubium
  { lon: -39, lat: -24, rx: 6, ry: 6, k: 0.95 },    // Humorum
  { lon: -23, lat: -9, rx: 6, ry: 5, k: 0.85 },     // Cognitum
  { lon: 3, lat: 13, rx: 6, ry: 5, k: 0.9 },        // Vaporum
  { lon: -20, lat: 8, rx: 8, ry: 6, k: 0.88 },      // Insularum
  { lon: -48, lat: 36, rx: 12, ry: 10, k: 0.8 },    // Procellarum north
  { lon: -62, lat: -8, rx: 10, ry: 14, k: 0.78 },   // Procellarum south
  { lon: 10, lat: 40, rx: 10, ry: 6, k: 0.8 },      // Lacus / Serenitatis link
  { lon: 0, lat: 59, rx: 22, ry: 4, k: 0.7 },       // Frigoris
  { lon: 87, lat: 2, rx: 4, ry: 3, k: 0.7 },        // Smythii
  { lon: -93, lat: -19, rx: 4, ry: 4, k: 0.8 },     // Orientale (far-side edge)
  { lon: 129, lat: 20, rx: 4, ry: 3, k: 0.6 },      // far-side small seas
  { lon: 147, lat: -20, rx: 3, ry: 3, k: 0.65 },    // Tsiolkovskiy
  { lon: 148, lat: 28, rx: 3, ry: 3, k: 0.55 },     // Moscoviense
];
// Ring basins (wall only, the sea floor inside is flooded): lon, lat, radius in degrees
const BASINS = [
  [-16, 34, 17], [18, 28, 9.5], [59, 17, 7], [34, -15, 5.5], [-39, -24, 6.5], [-93, -19, 8], [-93, -19, 4.5], [-16, -21, 9],
];
// Young bright craters with rays: lon, lat, radius deg, ray length deg
const RAYED = [
  [-11, -43, 1.7, 42], [-20, 9.7, 1.3, 20], [-38, 8, 0.9, 12], [-47, 23.7, 0.8, 9], [-9, 49, 0.7, 7], [-68, -3, 0.9, 12],
];

export function moonMaps(w: number, sun?: Sun) {
  const h = w / 2;
  const color = canvas(w, h), bump = canvas(w, h);
  const cc = color.getContext('2d')!, bc = bump.getContext('2d')!;
  const ci = cc.createImageData(w, h), bi = bc.createImageData(w, h);
  const ppd = w / 360;                      // pixels per degree
  const scale = w / 1024;
  const H = new Float32Array(w * h);        // height (craters add to it)
  const A = new Float32Array(w * h);        // brightness added by young craters
  const M = new Float32Array(w * h);        // how much "sea" (0 highland .. 1 sea)
  const n = [0, 0, 0];
  const lonOf = (px: number) => ((px + 0.5) / w - 0.5) * 360;
  const latOf = (py: number) => 90 - ((py + 0.5) / h) * 180;
  const dlon = (a: number, b: number) => { let d = a - b; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };

  // ---- 1. seas (and how deep the highland relief is)
  const base = new Float32Array(w * h);
  for (let py = 0; py < h; py++) {
    const lat = latOf(py), cl = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
    for (let px = 0; px < w; px++) {
      const lon = lonOf(px);
      spherePoint(px, py, w, h, n);
      const wob = fbm(n[0] * 4 + 9, n[1] * 4, n[2] * 4, 4, 31);    // ragged coastlines
      const wob2 = fbm(n[0] * 11, n[1] * 11 + 5, n[2] * 11, 3, 41);
      let m = 0;
      for (let k = 0; k < MARIA.length; k++) {
        const s = MARIA[k];
        const dx = (dlon(lon, s.lon) * cl) / (s.rx * 1.3), dy = (lat - s.lat) / (s.ry * 1.3);
        const d = Math.sqrt(dx * dx + dy * dy) + (wob - 0.5) * 0.85 + (wob2 - 0.5) * 0.3;
        const v = (1 - smooth(0.7, 1.1, d)) * s.k;
        if (v > m) m = v;
      }
      const i = py * w + px;
      M[i] = m;
      base[i] = fbm(n[0] * 3, n[1] * 3, n[2] * 3, 5, 61);
    }
  }

  // ---- 2. craters (height field)
  const rand = rng(777);
  const addCrater = (cx: number, cy: number, r: number, o: { basin?: boolean; fresh?: number; peak?: boolean; age?: number } = {}) => {
    const age = o.age ?? 1;                               // 1 = sharp and young, small = worn down
    const lat = 90 - (cy / h) * 180;
    const cl = Math.max(0.12, Math.cos((lat * Math.PI) / 180));
    const reach = r * (o.fresh ? 3.2 : 2.6);
    const D = o.basin ? 0 : (0.12 + 0.11 * Math.min(1, r / (16 * scale))) * (0.35 + 0.65 * age);
    const R = o.basin ? 0.2 : D * (0.3 + 0.35 * age);
    const y0 = Math.max(0, Math.floor(cy - reach)), y1 = Math.min(h - 1, Math.ceil(cy + reach));
    const xr = Math.ceil(reach / cl);
    for (let py = y0; py <= y1; py++) {
      const dy = (py + 0.5 - cy);
      for (let xx = -xr; xx <= xr; xx++) {
        const dx = xx * cl;
        const d = Math.sqrt(dx * dx + dy * dy) / r;
        if (d > reach / r) continue;
        const px = (((Math.floor(cx) + xx) % w) + w) % w;
        let hh = 0;
        if (d < 1) {
          if (!o.basin) {
            hh -= D * (1 - d * d);
            if (r > 12 * scale) hh = Math.max(hh, -D * 0.72);        // flat floor in large craters
            if (o.peak !== false && r > 15 * scale) hh += D * 0.4 * Math.exp(-Math.pow(d / 0.13, 2));
          }
          hh += R * Math.exp(-Math.pow((d - 1) / 0.17, 2)) * (d > 0.75 ? 1 : 0);
        } else {
          hh += R * Math.exp(-Math.pow((d - 1) / 0.17, 2));
          hh += R * 0.1 * Math.pow(d, -3);                        // blanket of thrown-out rock
        }
        const i = py * w + px;
        H[i] += hh;
        if (o.fresh) A[i] += o.fresh * (d < 1 ? 0.5 : 0.7 * Math.pow(Math.max(0, 1 - (d - 1) / 2.2), 1.6)) * (0.8 + 0.4 * rand());
      }
    }
  };
  const px2 = (lon: number) => (lon / 360 + 0.5) * w, py2 = (lat: number) => (0.5 - lat / 180) * h;
  // basins first (oldest)
  BASINS.forEach(([lo, la, rd]) => addCrater(px2(lo), py2(la), rd * ppd, { basin: true }));
  // random craters: many small, few large (power law). Old ones are shallow; seas have fewer.
  const count = Math.round((w * h) / 190);
  const rmin = 0.85 * scale;
  const list: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.min(48 * scale, rmin / Math.pow(1 - rand() * 0.9995, 1 / 1.35));
    const x = rand() * w, y = rand() * h;
    list.push([x, y, r]);
  }
  list.sort((a, b) => b[2] - a[2]);                              // big (old) first, small on top
  for (const [x, y, r] of list) {
    const m = M[Math.min(h - 1, Math.floor(y)) * w + Math.min(w - 1, Math.floor(x))];
    if (m > 0.5 && r < 9 * scale && rand() < 0.75) continue;     // the seas are younger: fewer small craters
    const fresh = r > 3 * scale && rand() < 0.07 ? 0.18 : 0;
    addCrater(x, y, r, { fresh, age: fresh ? 1 : Math.pow(rand(), 0.8) });
  }
  // the famous bright craters
  RAYED.forEach(([lo, la, rd], i) => addCrater(px2(lo), py2(la), Math.max(2.5, rd * ppd), { fresh: i === 0 ? 0.5 : 0.4, peak: true }));

  // ---- 3. final colours and height picture
  const rays = RAYED.map(([lo, la, rd, len], i) => {
    const phi = (lo / 360 + 0.5) * Math.PI * 2, th = (0.5 - la / 180) * Math.PI;
    return { x: -Math.cos(phi) * Math.sin(th), y: Math.cos(th), z: Math.sin(phi) * Math.sin(th), len: (len * Math.PI) / 180, rd: (rd * Math.PI) / 180, s: i * 13 + 5, k: i === 0 ? 1 : 0.7 };
  });
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      spherePoint(px, py, w, h, n);
      const i = py * w + px;
      const m = M[i];
      const detail = fbm(n[0] * 14, n[1] * 14, n[2] * 14, 4, 23);
      const grain = noise3(n[0] * 160, n[1] * 160, n[2] * 160, 5);
      const patch = base[i];
      // albedo
      let hi = 0.6 + 0.2 * (patch - 0.5) + 0.12 * (detail - 0.5) + 0.05 * (grain - 0.5);
      let lo = 0.26 + 0.12 * (patch - 0.5) + 0.05 * (detail - 0.5) + 0.03 * (grain - 0.5);
      // sea tint: some bluish (Tranquillitatis), some brownish (Procellarum)
      const tint = fbm(n[0] * 2 + 7, n[1] * 2, n[2] * 2, 2, 71) - 0.5;
      let r = mix(hi * 1.0, lo * (1.0 - tint * 0.35), m), g = mix(hi * 0.985, lo * 0.975, m), b = mix(hi * 0.95, lo * (1.0 + tint * 0.5), m);
      let bright = A[i];
      // rays (angle from the crater, with streaks that depend on direction)
      for (let q = 0; q < rays.length; q++) {
        const c = rays[q];
        const dot = n[0] * c.x + n[1] * c.y + n[2] * c.z;
        if (dot < 0.2) continue;
        const ang = Math.acos(Math.min(1, dot));
        if (ang > c.len || ang < c.rd) continue;
        // direction around the crater: a stable number from the position difference
        // east/north directions at the crater, then the angle around it
        let e1x = c.z, e1y = 0, e1z = -c.x; const el = Math.hypot(e1x, e1z) || 1; e1x /= el; e1z /= el;
        const e2x = c.y * e1z - c.z * e1y, e2y = c.z * e1x - c.x * e1z, e2z = c.x * e1y - c.y * e1x;
        const az = Math.atan2(n[0] * e2x + n[1] * e2y + n[2] * e2z, n[0] * e1x + n[1] * e1y + n[2] * e1z);
        const streak = Math.pow(Math.max(0, noise3(Math.cos(az) * 2.4 + c.s, Math.sin(az) * 2.4, c.s, 3) - 0.42) * 2.6, 1.2);
        const fall = Math.pow(1 - (ang - c.rd) / (c.len - c.rd), 1.4);
        bright += streak * fall * 0.3 * c.k * (0.5 + 0.5 * noise3(n[0] * 40, n[1] * 40, n[2] * 40, c.s));
      }
      // shading hint from crater height: floors a little darker, rims brighter
      const hh = H[i];
      bright += Math.max(0, hh) * 0.1 - Math.max(0, -hh) * 0.1;
      const f = 1 + bright * 1.5;
      const o = i * 4;
      ci.data[o] = Math.min(255, 255 * r * f);
      ci.data[o + 1] = Math.min(255, 255 * g * f);
      ci.data[o + 2] = Math.min(255, 255 * b * f);
      ci.data[o + 3] = 255;
      // relief: rough highlands, smooth seas with wrinkle ridges
      const ridge = 1 - Math.abs(2 * fbm(n[0] * 7 + 2, n[1] * 7, n[2] * 7, 3, 83) - 1);
      const rel = (detail - 0.5) * mix(0.22, 0.05, m) + (patch - 0.5) * 0.12 + Math.pow(ridge, 6) * 0.06 * m + (grain - 0.5) * 0.035 + hh;
      const gv = 255 * clamp01(0.5 + rel);
      bi.data[o] = bi.data[o + 1] = bi.data[o + 2] = gv; bi.data[o + 3] = 255;
    }
  }
  cc.putImageData(ci, 0, 0);
  bc.putImageData(bi, 0, 0);
  if (sun) bakeSun(color, sun, 0.03, bump);
  return { color, bump };
}

// =============================================================== EARTH
export function earthMaps(w: number, sun?: Sun, withClouds = false) {
  const h = w / 2;
  const color = canvas(w, h), rough = canvas(w, h);
  const cc = color.getContext('2d')!, rc = rough.getContext('2d')!;
  const ci = cc.createImageData(w, h), ri = rc.createImageData(w, h);
  const n = [0, 0, 0];
  const SEA = 0.535;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      spherePoint(px, py, w, h, n);
      const x = n[0], y = n[1], z = n[2];
      const lat = Math.asin(y) * 57.2958;
      const alat = Math.abs(lat);
      // continents: big smooth shapes plus smaller detail
      const e = fbm(x * 1.35 + 7, y * 1.35 + 2, z * 1.35 + 4, 6, 3) * 0.82 + fbm(x * 4, y * 4, z * 4, 4, 41) * 0.18;
      const i = (py * w + px) * 4;
      let r: number, g: number, b: number, rough255: number;
      if (e < SEA) {
        // ocean: shallow near coasts, deep far away
        const d = clamp01((SEA - e) / 0.2);
        const t = Math.pow(d, 0.55);
        r = mix(48, 6, t); g = mix(150, 32, t); b = mix(172, 84, t);
        rough255 = 55;
        // sea ice
        const ice = smooth(68, 76, alat + (noise3(x * 8, y * 8, z * 8, 9) - 0.5) * 10);
        if (ice > 0) { r = mix(r, 236, ice); g = mix(g, 242, ice); b = mix(b, 248, ice); rough255 = mix(rough255, 190, ice); }
      } else {
        const elev = (e - SEA) / (1 - SEA);
        // wet or dry: deserts near 25 degrees, rain forest near the equator
        let m = fbm(x * 2.2 + 11, y * 2.2 + 5, z * 2.2 + 1, 5, 71);
        m -= 0.38 * Math.exp(-Math.pow((alat - 26) / 10, 2));
        m += 0.22 * Math.exp(-Math.pow(lat / 11, 2));
        const mt = fbm(x * 5 + 2, y * 5 + 9, z * 5 + 3, 4, 53);
        const grainv = 0.88 + 0.24 * noise3(x * 60, y * 60, z * 60, 7);
        if (m < 0.34) { r = 214; g = 184; b = 124; }            // desert sand
        else if (m < 0.46) { r = mix(214, 150, (m - 0.34) / 0.12); g = mix(184, 148, (m - 0.34) / 0.12); b = mix(124, 78, (m - 0.34) / 0.12); } // dry grass
        else if (m < 0.6) { r = mix(150, 66, (m - 0.46) / 0.14); g = mix(148, 118, (m - 0.46) / 0.14); b = mix(78, 52, (m - 0.46) / 0.14); }   // green
        else { r = 28; g = 88; b = 42; }                          // rain forest
        // patchy variation
        const k = 0.8 + 0.4 * mt;
        r *= k * grainv; g *= k * grainv; b *= k * grainv;
        // mountains: grey rock, then snow on the high peaks
        const rock = smooth(0.12, 0.3, elev * (0.6 + 0.8 * fbm(x * 6, y * 6, z * 6, 3, 19)));
        r = mix(r, 118, rock); g = mix(g, 108, rock); b = mix(b, 98, rock);
        const snow = Math.max(smooth(0.34, 0.5, elev), smooth(58, 70, alat + (mt - 0.5) * 12));
        r = mix(r, 244, snow); g = mix(g, 246, snow); b = mix(b, 250, snow);
        // coast: pale beach line
        const beach = 1 - smooth(0, 0.015, e - SEA);
        r = mix(r, 205, beach * 0.5); g = mix(g, 190, beach * 0.5); b = mix(b, 140, beach * 0.5);
        rough255 = 225;
      }
      ci.data[i] = r; ci.data[i + 1] = g; ci.data[i + 2] = b; ci.data[i + 3] = 255;
      ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = rough255; ri.data[i + 3] = 255;
    }
  }
  cc.putImageData(ci, 0, 0);
  rc.putImageData(ri, 0, 0);

  // clouds: swirly white patches, thicker in bands (storm belts)
  const cw = w, ch = h;
  const clouds = canvas(cw, ch);
  const kc = clouds.getContext('2d')!;
  const ki = kc.createImageData(cw, ch);
  for (let py = 0; py < ch; py++) {
    for (let px = 0; px < cw; px++) {
      spherePoint(px, py, cw, ch, n);
      const x = n[0], y = n[1], z = n[2];
      const wx = fbm(x * 1.7 + 3, y * 1.7, z * 1.7 + 8, 3, 91) - 0.5;
      const wz = fbm(x * 1.7 + 9, y * 1.7 + 4, z * 1.7, 3, 92) - 0.5;
      const c = fbm(x * 2.6 + wx * 1.1, y * 3.4 + wz * 0.6, z * 2.6 + wz * 1.1, 6, 61);
      const band = 0.55 + 0.45 * Math.cos(Math.asin(y) * 5.0);
      const a = smooth(0.46 - 0.06 * band, 0.72, c) * (0.6 + 0.4 * band);
      const i = (py * cw + px) * 4;
      ki.data[i] = ki.data[i + 1] = ki.data[i + 2] = 255;
      ki.data[i + 3] = 255 * clamp01(a);
    }
  }
  kc.putImageData(ki, 0, 0);

  if (withClouds) {
    // paint the clouds into the colour picture (used where only one picture is possible)
    cc.drawImage(clouds, 0, 0);
  }
  if (sun) bakeSun(color, sun, 0.025);
  return { color, rough, clouds };
}

// ---- small cache, so the same picture is only drawn once ----
const cache = new Map<string, any>();
export function cached<T>(key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

/** Picture size for the Model detail setting. */
export function planetSize(quality: 'low' | 'medium' | 'high') {
  return quality === 'high' ? 2048 : quality === 'medium' ? 1024 : 512;
}
