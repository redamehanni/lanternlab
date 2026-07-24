import React, { useState } from 'react';
import { api, setToken } from '../api';

export default function LoginPage({ onAuthed }) {
  const [email, setEmail] = useState('admin@mazone.local');
  const [password, setPassword] = useState('admin1234');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, admin } = await api.login(email, password);
      setToken(token);
      onAuthed(admin);
    } catch (err) {
      setError(err.message || 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <h1>Laboratoire Ma Zone</h1>
        <p>Accès réservé à l'équipe Ma Zone.</p>

        {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}

        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>

        <button type="submit" disabled={loading} style={{ width: '100%', marginTop: 6 }}>
          {loading ? 'Connexion…' : 'Entrer'}
        </button>

        <p className="muted" style={{ marginTop: 14, fontSize: 12, textAlign: 'center' }}>
          Dev local : admin@mazone.local / admin1234
        </p>
      </form>
    </div>
  );
}
