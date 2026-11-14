import { useEffect, useState } from 'react';
import { useUI } from '../store';

export function Toast() {
  const toast = useUI((s) => s.toast);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => tick((n) => n + 1), 3600);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast || Date.now() - toast.at > 3500) return null;
  return <div className="toast">{toast.text}</div>;
}
