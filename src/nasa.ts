// Real NASA data for the game (NASA Open APIs, api.nasa.gov).
//  * DONKI  -> recent solar flares  (space weather)
//  * NeoWs  -> near-Earth asteroids passing today
//  * APOD   -> Astronomy Picture of the Day title
// Every call is optional. If the network, the key or NASA fails, the game uses the built-in sample data below
// and keeps working. Results are cached in the browser for 3 hours so we do not call NASA too often.
// Key: set VITE_NASA_API_KEY at build time (free at api.nasa.gov). Without it, the shared DEMO_KEY is used (small limit).
import { create } from 'zustand';

import type { NasaData } from './nasaCore';
import { SAMPLE, parseFlares, parseNeo, parseApod } from './nasaCore';
export * from './nasaCore';

const KEY = (import.meta as any).env?.VITE_NASA_API_KEY || 'DEMO_KEY';
const CACHE_KEY = 'nova-nasa-v1';
const TTL = 3 * 3600 * 1000;

export const useNasa = create<{ data: NasaData }>(() => ({ data: SAMPLE }));

// ---------------------------------------------------------------- loading
const day = (d: Date) => d.toISOString().slice(0, 10);
async function get(url: string): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

let started = false;
/** Call once when the app starts. Never throws. */
export async function loadNasa() {
  if (started) return;
  started = true;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as NasaData;
      if (c && Date.now() - c.at < TTL) { useNasa.setState({ data: { ...c, source: 'cache' } }); return; }
    }
  } catch { /* no cache */ }
  const now = new Date(), ago = new Date(Date.now() - 30 * 864e5);
  const [fl, neo, ap] = await Promise.allSettled([
    get(`https://api.nasa.gov/DONKI/FLR?startDate=${day(ago)}&endDate=${day(now)}&api_key=${KEY}`),
    get(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${day(now)}&end_date=${day(now)}&api_key=${KEY}`),
    get(`https://api.nasa.gov/planetary/apod?api_key=${KEY}`),
  ]);
  const flares = fl.status === 'fulfilled' ? parseFlares(fl.value) : [];
  const asteroids = neo.status === 'fulfilled' ? parseNeo(neo.value) : [];
  const apod = ap.status === 'fulfilled' ? parseApod(ap.value) : null;
  if (!flares.length && !asteroids.length && !apod) { console.warn('[NOVA SHIFT] NASA data not available. Using sample data.'); return; }
  const data: NasaData = { flares: flares.length ? flares : SAMPLE.flares, asteroids: asteroids.length ? asteroids : SAMPLE.asteroids, apod, source: 'live', at: Date.now() };
  useNasa.setState({ data });
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* storage full */ }
}

// ---------------------------------------------------------------- text for the game
