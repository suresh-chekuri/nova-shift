# Moon model (you must add this file)

The game looks for **`public/models/moon.glb`**.
If the file is missing or broken, the game shows the built-in Moon made by code, and prints a report in the browser console (F12).

## Steps
1. Open https://sketchfab.com/3d-models/moon-blend-e706ce13b917471797479ef1f6dccc0c
2. Log in (free) and click **Download 3D model**. Choose **glTF** (`.glb` is best).
3. If you get a `.zip`, unzip it. Use the `.glb` inside. If you get `.gltf` + `.bin` + textures, convert to one `.glb` (https://gltf.report or Blender).
4. Name it **`moon.glb`** and put it in this folder (`public/models/`).
5. Stop and restart `npm run dev`. For Render: `git add`, `git commit`, `git push` (check the file is not ignored by git).

## Credit (required by CC BY 4.0)
"Moon (blend)" by ThePangel, CC BY 4.0. The credit is shown in Settings.

## Size and speed
The model has about 499,000 triangles. That is heavy for a normal laptop.
- Reduce it to about 50,000–100,000 triangles (Blender "Decimate" or gltf.report "Simplify").
- Make the texture 2048 × 1024 or smaller. Keep the file under 10 MB.

## Turning the model
If the wrong side faces the ship, change `MOON_ROTATION_Y` in `src/world/MoonModel.tsx`.
