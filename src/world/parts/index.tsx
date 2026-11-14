// One entry point for every spacecraft part: GLB if available, else detailed procedural, else the simple model.
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import type { Cat } from '../../design';
import { Safe } from './kit';
import { WithAsset } from './assets';
import { Bus } from './Bus';
import { Solar } from './Solar';
import { Engine } from './Engines';
import { Antenna } from './Antennas';
import { Battery } from './Batteries';
import { Instrument as DetailedInstrument } from './Instruments';
import * as Simple from './simple';

export { loadAssetManifest } from './assets';

type Glow = MutableRefObject<THREE.MeshStandardMaterial[]>;
const noGlow: Glow = { current: [] };

function simple(cat: Cat, id: string, glow: Glow) {
  if (cat === 'structure') return <Simple.Structure id={id} />;
  if (cat === 'power') return <Simple.Power id={id} />;
  if (cat === 'propulsion') return <Simple.Propulsion id={id} glow={glow} />;
  if (cat === 'comms') return <Simple.Comms id={id} />;
  if (cat === 'battery') return <Simple.Battery id={id} />;
  return <Simple.Instrument id={id} />;
}
function detailed(cat: Cat, id: string, glow: Glow) {
  if (cat === 'structure') return <Bus id={id} />;
  if (cat === 'power') return <Solar id={id} />;
  if (cat === 'propulsion') return <Engine id={id} glow={glow} />;
  if (cat === 'comms') return <Antenna id={id} />;
  if (cat === 'battery') return <Battery id={id} />;
  return <DetailedInstrument id={id} />;
}

export function PartView({ cat, id, glow = noGlow }: { cat: Cat; id: string; glow?: Glow }) {
  return (
    <WithAsset cat={cat} id={id}>
      <Safe fallback={simple(cat, id, glow)}>{detailed(cat, id, glow)}</Safe>
    </WithAsset>
  );
}
