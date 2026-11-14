// Shows a readable message instead of a blank white page when something crashes.
import { Component, useEffect, useState, type ReactNode } from 'react';

const box: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 99999, background: '#02040a', color: '#e2e8f0', padding: 24,
  fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 14, overflow: 'auto',
};
const btn: React.CSSProperties = { marginTop: 16, padding: '10px 18px', fontSize: 14, cursor: 'pointer', background: '#38bdf8', border: 0, borderRadius: 4, color: '#02040a' };

function Report({ message, stack }: { message: string; stack?: string }) {
  return (
    <div style={box}>
      <h2 style={{ color: '#fb923c', marginTop: 0 }}>NOVA SHIFT hit a problem</h2>
      <p>Please send a screenshot of this screen to the developer.</p>
      <pre style={{ whiteSpace: 'pre-wrap', color: '#fca5a5' }}>{message}</pre>
      {stack && <pre style={{ whiteSpace: 'pre-wrap', opacity: 0.7, fontSize: 12 }}>{stack.split('\n').slice(0, 12).join('\n')}</pre>}
      <button style={btn} onClick={() => window.location.reload()}>RELOAD THE GAME</button>
    </div>
  );
}

/** Catches errors that happen while drawing the page. */
export class CrashGuard extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error('[NOVA SHIFT] crash:', err); }
  render() {
    return this.state.err ? <Report message={String(this.state.err.message || this.state.err)} stack={this.state.err.stack} /> : this.props.children;
  }
}

/** Shows a small banner for errors outside drawing (network, loading, 3D graphics lost). */
export function ErrorBanner() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const onErr = (e: ErrorEvent) => setMsg(e.message || 'Unknown error');
    const onRej = (e: PromiseRejectionEvent) => setMsg(String((e.reason && e.reason.message) || e.reason || 'Unknown error'));
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => { window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej); };
  }, []);
  if (!msg) return null;
  return (
    <div style={{ position: 'fixed', left: 8, bottom: 8, right: 8, zIndex: 99998, background: 'rgba(60,10,10,0.92)', color: '#fecaca', padding: '8px 12px', borderRadius: 6, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }}>
      Problem: {msg} <button onClick={() => setMsg('')} style={{ marginLeft: 8 }}>OK</button>
    </div>
  );
}
