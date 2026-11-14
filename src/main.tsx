import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { CrashGuard, ErrorBanner } from './CrashGuard';

createRoot(document.getElementById('root')!).render(
  <CrashGuard>
    <App />
    <ErrorBanner />
  </CrashGuard>,
);
