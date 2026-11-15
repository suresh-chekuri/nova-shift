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
export function moonMaps(w: number, sun?: Sun) {
  const h = w / 2;
  const color = canvas(w, h), bump = canvas(w, h);
  const cc = color.getContext('2d')!, bc = bump.getContext('2d')!;
  const ci = cc.createImageData(w, h), bi = bc.createImageData(w, h);
  const n = [0, 0, 0];
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      spherePoint(px, py, w, h, n);
      const x = n[0], y = n[1], z = n[2];
      // dark lava plains (the "seas"), mostly away from the poles
      const sea = fbm(x * 1.5 + 3.1, y * 1.5 + 1.7, z * 1.5 + 5.3, 4, 11);
      const mare = smooth(0.5, 0.6, sea) * (1 - smooth(0.6, 0.92, Math.abs(y)));
      const detail = fbm(x * 9, y * 9, z * 9, 4, 23);
      const grain = noise3(x * 90, y * 90, z * 90, 5);
      const hi = 0.6 + 0.16 * (detail - 0.5) + 0.05 * (grain - 0.5);
      const lo = 0.3 + 0.1 * (detail - 0.5) + 0.04 * (grain - 0.5);
      const v = mix(hi, lo, mare);
      const i = (py * w + px) * 4;
      // grey with a slight warm tint on the highlands and a cool tint on the plains
      ci.data[i] = 255 * v * mix(1.0, 0.93, mare);
      ci.data[i + 1] = 255 * v * mix(0.99, 0.96, mare);
      ci.data[i + 2] = 255 * v * mix(0.96, 1.0, mare);
      ci.data[i + 3] = 255;
      // bumps: rough highlands, smooth plains
      const hgt = 0.5 + (detail - 0.5) * mix(0.34, 0.1, mare) + (grain - 0.5) * 0.05;
      const g = 255 * clamp01(hgt);
      bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = g; bi.data[i + 3] = 255;
    }
  }
  cc.putImageData(ci, 0, 0);
  bc.putImageData(bi, 0, 0);

  // craters: many small ones and a few big ones
  const rand = rng(777);
  const count = Math.round((w * h) / 650);
  const scale = w / 1024;
  const drawCrater = (x: number, y: number, r: number, fresh: boolean, age: number) => {
    if (fresh) {
      // bright splash of dust around young craters
      const gl = cc.createRadialGradient(x, y, r, x, y, r * 2.8);
      gl.addColorStop(0, 'rgba(240,240,235,0.26)'); gl.addColorStop(1, 'rgba(240,240,235,0)');
      cc.fillStyle = gl; cc.beginPath(); cc.arc(x, y, r * 2.8, 0, 7); cc.fill();
    }
    // the floor is a little darker. Most of the shape comes from the bump picture.
    const gc = cc.createRadialGradient(x, y, 0, x, y, r);
    gc.addColorStop(0, 'rgba(40,40,44,0.16)'); gc.addColorStop(0.8, 'rgba(45,45,50,0.07)'); gc.addColorStop(1, 'rgba(45,45,50,0)');
    cc.fillStyle = gc; cc.beginPath(); cc.arc(x, y, r, 0, 7); cc.fill();
    // height: bowl inside, raised rim, then back to the ground. Small craters are shallow.
    const depth = Math.min(1, 0.45 + r / (24 * scale)) * (0.4 + 0.6 * age);
    const lo = Math.round(128 - 80 * depth), mid = Math.round(128 - 42 * depth), rim = Math.round(128 + 80 * Math.min(1, depth + 0.1));
    const gb = bc.createRadialGradient(x, y, 0, x, y, r * 1.2);
    gb.addColorStop(0, `rgba(${lo},${lo},${lo},0.95)`); gb.addColorStop(0.55, `rgba(${mid},${mid},${mid},0.9)`);
    gb.addColorStop(0.8, `rgba(${rim},${rim},${rim},0.95)`); gb.addColorStop(0.92, `rgba(150,150,150,0.55)`); gb.addColorStop(1, 'rgba(128,128,128,0)');
    bc.fillStyle = gb; bc.beginPath(); bc.arc(x, y, r * 1.2, 0, 7); bc.fill();
  };
  for (let i = 0; i < count; i++) {
    const x = rand() * w, y = rand() * h;
    // craters near the poles are stretched on the sphere picture, so make them narrower there
    const r = (1 + Math.pow(rand(), 4.2) * 40) * scale;
    const fresh = r > 7 * scale && rand() < 0.3;
    const age = rand();
    drawCrater(x, y, r, fresh, age);
    if (x < r * 2.6) drawCrater(x + w, y, r, fresh, age);
    if (x > w - r * 2.6) drawCrater(x - w, y, r, fresh, age);
  }
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
