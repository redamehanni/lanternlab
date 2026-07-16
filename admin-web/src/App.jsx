import React, { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import LoginPage from './pages/LoginPage';
import WorldPage from './pages/WorldPage';
import ExplorerPage from './pages/ExplorerPage';

export default function App() {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('world');

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const { admin } = await api.me();
          setAdmin(admin);
        } catch {
          setToken(null);
        }
      }
      setReady(true);
    })();
  }, []);

  if (!ready) return null;

  if (!admin) {
    return <LoginPage onAuthed={setAdmin} />;
  }

  function logout() {
    setToken(null);
    setAdmin(null);
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          Ma Zone — Laboratoire
          <small>Vivre le monde avant ses habitants</small>
        </div>
        <div className="tabs">
          <button className={tab === 'world' ? 'on' : ''} onClick={() => setTab('world')}>Monde</button>
          <button className={tab === 'explorer' ? 'on' : ''} onClick={() => setTab('explorer')}>Explorateur</button>
        </div>
        <div className="spacer" />
        <span className="muted">{admin.name || admin.email}</span>
        <button className="ghost" onClick={logout}>Déconnexion</button>
      </div>

      <div className="content">
        {tab === 'world' ? <WorldPage /> : <ExplorerPage />}
      </div>
    </div>
  );
}
