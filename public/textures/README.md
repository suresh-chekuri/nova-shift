# Real planet pictures (optional)

The game draws the Moon and Earth by code. It looks fine without any file here.
To use real NASA pictures, add these files to this folder:

- `moon.jpg` – Moon colour map (NASA CGI Moon Kit colour map, 2:1, centred on 0° longitude)
- `moon_bump.jpg` – Moon height map, grey (NASA CGI Moon Kit displacement map)
- `earth.jpg` – Earth colour map (equirectangular, 2:1)
- `earth_clouds.jpg` – Earth clouds (white clouds on black)

Where to get them (free):
- NASA Visible Earth: https://visibleearth.nasa.gov
- NASA SVS Moon maps (LRO): https://svs.gsfc.nasa.gov/4720
- Solar System Scope textures: https://www.solarsystemscope.com/textures (check the licence)

Use 2048x1024 or smaller for phones. Missing files are ignored.

## NASA Moon maps (LRO)
The NASA CGI Moon Kit maps are centred on 0° longitude, like the game's Moon, so the near side faces the ship.
Convert the colour map to a JPG about 4096x2048 (or 2048x1024 for phones) and the displacement map to a grey JPG, then use the names above.
The ship windows paint the sunlight and crater shadows into the picture. Credit: NASA/Goddard/Scientific Visualization Studio.
If `public/models/moon.glb` also exists, the 3D model is used instead of these maps.
