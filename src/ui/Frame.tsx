import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { closePanel } from '../store';
import { lockPointer } from '../controls';
import { isTouch } from '../device';

export function Frame({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  const close = () => { closePanel(); lockPointer(); };
  return (
    <div className="backdrop">
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">{icon}{title}</div>
          <button className="btn small" onClick={close}><X size={14} /> {isTouch ? 'CLOSE' : 'CLOSE (ESC)'}</button>
        </div>
        {children}
      </div>
    </div>
  );
}
