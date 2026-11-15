// On-screen controls for phones and tablets: a floating move stick (left), drag to look (right), and a USE button.
import { useRef } from 'react';
import { Hand } from 'lucide-react';
import { useGame, useUI } from '../store';
import { isTouch } from '../device';
import { touch, interactNow } from '../touch';
import { sfx } from '../sfx';

const R = 56; // stick radius in pixels

export function TouchControls() {
  const screen = useUI((s) => s.screen);
  const panel = useUI((s) => s.panel);
  const nearby = useUI((s) => s.nearby);
  const phase = useGame((s) => s.phase);
  const ring = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);

  if (!isTouch || screen !== 'game' || phase !== 'playing' || panel) {
    touch.moveX = 0; touch.moveY = 0;
    return null;
  }

  // ---- move stick: it appears where the thumb lands ----
  const stickDown = (e: React.PointerEvent) => {
    if (stick.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    if (ring.current) { ring.current.style.display = 'block'; ring.current.style.left = e.clientX - R + 'px'; ring.current.style.top = e.clientY - R + 'px'; }
    if (knob.current) knob.current.style.transform = 'translate(0px, 0px)';
  };
  const stickMove = (e: React.PointerEvent) => {
    const s = stick.current;
    if (!s || e.pointerId !== s.id) return;
    let dx = e.clientX - s.x, dy = e.clientY - s.y;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
    touch.moveX = dx / R;
    touch.moveY = -dy / R;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const stickUp = (e: React.PointerEvent) => {
    if (!stick.current || e.pointerId !== stick.current.id) return;
    stick.current = null;
    touch.moveX = 0; touch.moveY = 0;
    if (ring.current) ring.current.style.display = 'none';
  };

  // ---- look: drag a finger on the right side ----
  const lookDown = (e: React.PointerEvent) => {
    if (look.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const lookMove = (e: React.PointerEvent) => {
    const l = look.current;
    if (!l || e.pointerId !== l.id) return;
    touch.lookX += e.clientX - l.x;
    touch.lookY += e.clientY - l.y;
    l.x = e.clientX; l.y = e.clientY;
  };
  const lookUp = (e: React.PointerEvent) => {
    if (look.current && e.pointerId === look.current.id) look.current = null;
  };

  return (
    <div className="touch-ui">
      <div className="touch-look" onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} />
      <div className="touch-stick-zone" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp} />
      <div className="touch-ring" ref={ring}><div className="touch-knob" ref={knob} /></div>
      <button
        className={'touch-use' + (nearby ? ' ready' : '')}
        onPointerDown={(e) => { e.preventDefault(); if (nearby) { sfx.click(); interactNow(); } }}
      >
        <Hand size={26} />
        <span>USE</span>
      </button>
      <div className="touch-rotate">Please turn your phone sideways (landscape).</div>
    </div>
  );
}
