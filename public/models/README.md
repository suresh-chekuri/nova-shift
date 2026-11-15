# Moon model (you must add this file)

The game looks for **`public/models/moon.glb`**.
If the file is missing or broken, the game uses the built-in Moon made by code, and prints a report in the browser console (F12). The game still works.

## Steps
1. Open https://sketchfab.com/3d-models/moon-blend-e706ce13b917471797479ef1f6dccc0c
2. Log in to Sketchfab (free) and click **Download 3D model**.
3. Choose the **glTF** format (`.glb` is best). If you get a `.zip`, unzip it. If you get `.gltf` + `.bin` + textures, convert to one `.glb` (for example with https://gltf.report or Blender).
4. Name it **`moon.glb`** and put it in this folder.
5. Run `npm run dev` again, or `git push` so Render rebuilds.

## Credit (required by the CC BY 4.0 license)
"Moon (blend)" by ThePangel, CC BY 4.0. The credit is shown in the Settings screen.

## Size and speed
The model has about 499,000 triangles. This is heavy for a normal laptop.
- Best: reduce it to about 50,000–100,000 triangles (Blender "Decimate", or gltf.report "Simplify").
- Shrink the texture to 2048 × 1024 or smaller.
- Target: a file under 10 MB.

## Turning the model
The Moon is scaled and centred by code. If the wrong side faces the ship, change `MOON_ROTATION_Y` in `src/world/MoonModel.tsx`.
