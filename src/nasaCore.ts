// Pure helpers for the NASA data (no network, no store). Tested in scripts/nasa-test.ts.
export interface Flare { cls: string; time: string }
export interface Asteroid { name: string; meters: number; lunar: number; kps: number; hazard: boolean }
export interface Apod { title: string; date: string }
export interface NasaData { flares: Flare[]; asteroids: Asteroid[]; apod: Apod | null; source: 'live' | 'cache' | 'sample'; at: number }


// Built-in sample (used when offline). Clearly marked as "sample" in the game.
export const SAMPLE: NasaData = {
  flares: [{ cls: 'M1.2', time: '' }],
  asteroids: [{ name: '2024 XK', meters: 85, lunar: 6.4, kps: 11.2, hazard: false }],
  apod: null,
  source: 'sample',
  at: 0,
};


// ---------------------------------------------------------------- parsers (pure, tested without the network)
export function parseFlares(json: any): Flare[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((f) => f && typeof f.classType === 'string')
    .map((f) => ({ cls: String(f.classType), time: String(f.peakTime || f.beginTime || '') }))
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 8);
}
export function parseNeo(json: any): Asteroid[] {
  const days = json && json.near_earth_objects;
  if (!days || typeof days !== 'object') return [];
  const out: Asteroid[] = [];
  for (const day of Object.keys(days)) {
    for (const o of days[day] || []) {
      const ca = (o.close_approach_data || [])[0];
      const d = o.estimated_diameter && o.estimated_diameter.meters;
      if (!ca || !d) continue;
      out.push({
        name: String(o.name || '').replace(/[()]/g, '').trim(),
        meters: Math.round((Number(d.estimated_diameter_min) + Number(d.estimated_diameter_max)) / 2),
        lunar: Math.round(Number(ca.miss_distance && ca.miss_distance.lunar) * 10) / 10,
        kps: Math.round(Number(ca.relative_velocity && ca.relative_velocity.kilometers_per_second) * 10) / 10,
        hazard: !!o.is_potentially_hazardous_asteroid,
      });
    }
  }
  return out.filter((a) => isFinite(a.lunar) && a.name).sort((a, b) => a.lunar - b.lunar).slice(0, 8);
}
export function parseApod(json: any): Apod | null {
  return json && typeof json.title === 'string' ? { title: json.title, date: String(json.date || '') } : null;
}


// ---------------------------------------------------------------- text for the game
const fmtDay = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? '' : d.toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };

/** Short lines for the Command display ticker and for mission alerts. */
export function nasaLines(d: NasaData): string[] {
  const tag = d.source === 'sample' ? 'SAMPLE DATA' : 'NASA';
  const out: string[] = [];
  const f = d.flares[0];
  if (f) out.push(`${tag} · SOLAR FLARE ${f.cls}${f.time ? ' · ' + fmtDay(f.time) : ''}`);
  const a = d.asteroids[0];
  if (a) out.push(`${tag} · ASTEROID ${a.name} · ${a.meters} m · ${a.lunar} MOON-DISTANCES AWAY`);
  if (d.apod) out.push(`${tag} · PICTURE OF THE DAY: ${d.apod.title.toUpperCase()}`);
  return out;
}
/** One plain-English alert for the start of a mission. */
export function missionAlert(d: NasaData, pick: number): string | null {
  const live = d.source !== 'sample';
  const a = d.asteroids[0], f = d.flares[0];
  const opts: string[] = [];
  if (f) opts.push(`${live ? 'NASA DONKI' : 'Sample'}: a class ${f.cls} solar flare${f.time ? ' on ' + fmtDay(f.time) : ''}. Flares can cause radio noise.`);
  if (a) opts.push(`${live ? 'NASA NeoWs' : 'Sample'}: asteroid ${a.name} (${a.meters} m) passes ${a.lunar}× the Moon's distance from Earth.`);
  return opts.length ? opts[pick % opts.length] : null;
}

/** Learning cards, one per room. */
export const ROOM_FACTS: Record<string, string> = {
  'COMMAND DECK': 'Did you know? NASA\'s Lunar Reconnaissance Orbiter has mapped the Moon from orbit since 2009. Its maps help plan landings.',
  'ENGINEERING': 'Did you know? Real spacecraft make power with solar panels and store it in batteries, like this ship.',
  'SCIENCE LAB': 'Did you know? Apollo 11 landed in the Sea of Tranquility in 1969 and brought home about 21 kg of Moon rock.',
  'COMMUNICATIONS': 'Did you know? A radio signal takes about 1.3 seconds to travel from the Moon to Earth.',
  'AIRLOCK': 'Did you know? An airlock lets astronauts go outside without letting the air out of the ship.',
};
