import { useEffect, useState } from 'react';
import Home from './components/Home';
import Session from './components/Session';

function currentPath(): string {
  return window.location.pathname;
}

export function navigate(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function App() {
  const [path, setPath] = useState(currentPath());

  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const match = path.match(/^\/s\/([A-Za-z0-9_-]+)\/?$/);
  if (match) {
    return <Session token={match[1]} />;
  }
  return <Home />;
}
