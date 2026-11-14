# Optional 3D model files (GLB)

The game already works without any files here. It draws every spacecraft part with built-in procedural models.

If you want to use real models instead, put `.glb` files in this folder and list them in `manifest.json`.
The game checks the list when it starts. A part that is not in the list (or whose file fails to load) uses the built-in model.

## manifest.json format

Keys are `category.partId`. Valid keys:

- `structure.light`, `structure.standard`, `structure.reinforced`
- `power.compact`, `power.advanced`, `power.highcap`
- `propulsion.chemical`, `propulsion.ion`, `propulsion.advprop`
- `comms.basic`, `comms.highgain`, `comms.deep`
- `battery.compact`, `battery.standard`, `battery.advanced`
- `payload.spectrometer`, `payload.seismic`, `payload.analyzer`, `payload.camera`

Example:

```json
{
  "comms.highgain": { "url": "/models/highgain.glb", "scale": 1, "rotation": [0, 0, 0], "position": [0, 0, 0] }
}
```

- `scale`, `rotation` (radians) and `position` are optional.
- Anchors (the game places your model here): propulsion at z = -2.6 (aft end of the bus), comms at (0, 1.3, 0.9), battery at (0, -1.5, -0.6). Structure, power (both wings) and payload models are placed at the origin / their hardpoint.
- The ship points along +Z (nose at +Z, engine at -Z). Antenna and instrument models should be centered on the origin.
- Use small files (under 2 MB each) with no Draco compression.

## Where to find free models (check the license of each file)

- NASA 3D Resources: https://nasa3d.arc.nasa.gov/models (NASA models are generally free to use. Read their usage note.)
- Poly Pizza (CC0 and CC-BY models): https://poly.pizza
- Kenney assets (CC0): https://kenney.nl/assets

Keep the license text and credit the author when the license asks for it.


## Crew suit (other players)
`crew-suit.glb` is the suit worn by the other players in multiplayer. It is Draco-compressed, so `npm install` / `npm run dev` copies the decoder into `public/draco` (script: `scripts/copy-draco.mjs`). It is scaled to a person's height automatically. If it faces backwards, use SETTINGS > FLIP DIRECTION. With Model detail LOW, the simple astronaut is used instead.
