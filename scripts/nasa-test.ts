import { parseFlares, parseNeo, parseApod, nasaLines, missionAlert, SAMPLE } from '../src/nasaCore';
let bad = 0; const ok = (n: string, c: boolean) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) bad++; };
const fl = parseFlares([{ classType: 'M2.1', peakTime: '2026-11-10T04:00Z' }, { classType: 'C5.0', beginTime: '2026-11-12T01:00Z' }, { x: 1 }]);
ok('flares sorted newest first', fl.length === 2 && fl[0].cls === 'C5.0');
ok('flares ignore bad input', parseFlares(null).length === 0 && parseFlares({}).length === 0);
const neo = parseNeo({ near_earth_objects: { '2026-11-15': [
  { name: '(2020 AB)', is_potentially_hazardous_asteroid: true, estimated_diameter: { meters: { estimated_diameter_min: 100, estimated_diameter_max: 200 } }, close_approach_data: [{ miss_distance: { lunar: '12.34' }, relative_velocity: { kilometers_per_second: '9.87' } }] },
  { name: 'far', estimated_diameter: { meters: { estimated_diameter_min: 10, estimated_diameter_max: 20 } }, close_approach_data: [{ miss_distance: { lunar: '3.2' }, relative_velocity: { kilometers_per_second: '5' } }] },
  { name: 'nodata' }] } });
ok('neo parsed and sorted by distance', neo.length === 2 && neo[0].name === 'far' && neo[1].meters === 150 && neo[1].lunar === 12.3 && neo[1].hazard);
ok('neo bad input', parseNeo(null).length === 0 && parseNeo({ near_earth_objects: 5 }).length === 0);
ok('apod', parseApod({ title: 'Hello', date: '2026-11-15' })?.title === 'Hello' && parseApod({}) === null);
const lines = nasaLines({ flares: fl, asteroids: neo, apod: { title: 'Hello', date: '' }, source: 'live', at: 1 });
ok('ticker lines', lines.length === 3 && lines[0].startsWith('NASA'));
ok('sample is labelled', nasaLines(SAMPLE).every((l) => l.startsWith('SAMPLE')));
ok('mission alert', !!missionAlert(SAMPLE, 0) && !!missionAlert(SAMPLE, 1));
process.exit(bad ? 1 : 0);
