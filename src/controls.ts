// Ask the browser to capture the mouse (pointer lock) for first-person look.
export function lockPointer() {
  const c = document.querySelector('canvas');
  if (!c) return;
  try {
    const p: any = (c as any).requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch {
    /* ignore */
  }
}

// Where the player is right now (updated every frame; read by the waypoint arrow)
export const pose = { x: 0, z: 0, yaw: 0 };
