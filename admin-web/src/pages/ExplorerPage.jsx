import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { MOBILE_WEB_URL } from '../config';

const ROLES = [
  { id: '', label: 'Tous' },
  { id: 'client', label: 'Habitants' },
  { id: 'merchant', label: 'Commerçants' },
  { id: 'driver', label: 'Livreurs' },
];

export default function ExplorerPage() {
  const [role, setRole] = useState('');
  const [actors, setActors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  async function loadActors() {
    setError('');
    try {
      const q = role ? `type=${role}` : '';
      const { actors } = await api.actors(q);
      setActors(actors || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadActors(); }, [role]);

  async function openActor(id) {
    setError('');
    try {
      const { actor } = await api.actor(id);
      setSelected(actor);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      {error ? <div className="error">{error}</div> : null}

      <div className="row wrap">
        <div className="tabs">
          {ROLES.map((r) => (
            <button key={r.id} className={role === r.id ? 'on' : ''} onClick={() => setRole(r.id)}>{r.label}</button>
          ))}
        </div>
        <div className="spacer" />
        <button className="ghost small" onClick={loadActors}>Rafraîchir</button>
      </div>

      <div className="split">
        <div className="grid" style={{ gap: 10 }}>
          {actors.length === 0 ? (
            <div className="muted">Aucun acteur démo. Générez un monde depuis l'onglet Monde.</div>
          ) : (
            actors.map((a) => (
              <div key={a.id} className="card actor" onClick={() => openActor(a.id)}>
                <div className={`avatar role-${a.role}`}>{(a.name || '?')[0].toUpperCase()}</div>
                <div>
                  <strong>{a.name}</strong> <span className="tag">{a.role}</span>
                  <div className="counts">
                    {Object.entries(a.counts || {}).map(([k, v]) => (
                      <span key={k}>{k}: {v}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          {selected ? (
            <ActorDetail actor={selected} onError={setError} />
          ) : (
            <div className="card muted">Sélectionnez un acteur pour l'explorer et le devenir.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActorDetail({ actor, onError }) {
  const [busy, setBusy] = useState(false);

  async function become() {
    setBusy(true);
    onError('');
    try {
      const { token } = await api.impersonate(actor.id);
      window.open(`${MOBILE_WEB_URL}/#labToken=${encodeURIComponent(token)}`, '_blank');
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="row">
          <div className={`avatar role-${actor.role}`}>{(actor.name || '?')[0].toUpperCase()}</div>
          <div>
            <h3 style={{ margin: 0 }}>{actor.name}</h3>
            <div className="muted" style={{ fontSize: 13 }}>{actor.email} · {actor.role}</div>
          </div>
          <div className="spacer" />
          <button disabled={busy} onClick={become}>Devenir {actor.name?.split(' ')[0]}</button>
        </div>
      </div>

      {actor.role === 'merchant' && (actor.stores || []).map((s) => (
        <div className="card" key={s.id}>
          <h3>{s.name}</h3>
          <div className="desc">{s.category} · {s.address}</div>
          <div className="tag">Produits ({(s.products || []).length})</div>
          {(s.products || []).map((p) => (
            <div className="list-item" key={p.id}>{p.name} — {p.price} € · stock {p.quantity}</div>
          ))}
          <div className="tag" style={{ marginTop: 10 }}>Commandes ({(s.orders || []).length})</div>
          {(s.orders || []).map((o) => (
            <div className="list-item" key={o.id}>{o.status} — {o.total_price} €</div>
          ))}
        </div>
      ))}

      {actor.role === 'client' && (
        <div className="card">
          <div className="tag">Commandes ({(actor.orders || []).length})</div>
          {(actor.orders || []).map((o) => (
            <div className="list-item" key={o.id}>{o.status} — {o.total_price} €</div>
          ))}
          <div className="tag" style={{ marginTop: 10 }}>Favoris ({(actor.favorites || []).length})</div>
          {(actor.favorites || []).map((f) => (
            <div className="list-item" key={f.id}>{f.name} <span className="muted">{f.category}</span></div>
          ))}
        </div>
      )}

      {actor.role === 'driver' && (
        <div className="card">
          <div className="tag">Missions ({(actor.missions || []).length})</div>
          {(actor.missions || []).map((m) => (
            <div className="list-item" key={m.id}>{m.status}</div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="tag">Wallet ({(actor.wallet || []).length})</div>
        {(actor.wallet || []).length === 0 ? (
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Aucun objet numérique.</div>
        ) : (
          (actor.wallet || []).map((o) => (
            <div className="list-item" key={o.id}>
              {(o.display && o.display.title) || o.kind}{' '}
              <span className="pill">{o.status}</span>{' '}
              <span className="muted" style={{ fontSize: 12 }}>{o.family}</span>
            </div>
          ))
        )}
      </div>

      <LabPowers actor={actor} onError={onError} />
    </div>
  );
}

function LabPowers({ actor, onError }) {
  const [actions, setActions] = useState([]);
  const [actionId, setActionId] = useState('');
  const [params, setParams] = useState({});
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.labActions()
      .then(({ actions }) => setActions(actions || []))
      .catch((err) => onError(err.message));
  }, []);

  const current = actions.find((a) => a.id === actionId);

  function defaultFor(def) {
    if (def.type === 'enum') return def.options?.[0]?.value || '';
    if (def.type === 'boolean') return false;
    if (def.type === 'multi') return [];
    return '';
  }

  function selectAction(id) {
    setActionId(id);
    const a = actions.find((x) => x.id === id);
    const init = {};
    Object.entries(a?.params || {}).forEach(([k, def]) => { init[k] = defaultFor(def); });
    setParams(init);
    setNotice('');
    setResult(null);
  }

  function toggleMulti(key, value) {
    setParams((p) => {
      const list = Array.isArray(p[key]) ? p[key] : [];
      return { ...p, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });
  }

  async function run() {
    setBusy(true);
    setNotice('');
    setResult(null);
    onError('');
    try {
      const res = await api.runLabAction(actionId, actor.id, params);
      setNotice(`Action exécutée via l'organe « ${res.organ} ».`);
      setResult(res.result ?? null);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Identifiants utiles renvoyés (ex. eventId pour enchaîner publier/diffuser).
  const resultId = result && (result.id || result.event?.id || result.ticket?.id || result.reward?.id);

  return (
    <div className="card">
      <h3>Pouvoirs du labo</h3>
      <div className="desc">Chaque action passe par un organe réel de Ma Zone. Aucune écriture directe.</div>

      {notice ? <div className="notice" style={{ marginBottom: 12 }}>{notice}</div> : null}
      {result ? (
        <div className="notice" style={{ marginBottom: 12 }}>
          {resultId ? <div><strong>id :</strong> <code>{resultId}</code></div> : null}
          <details style={{ marginTop: 6 }}>
            <summary style={{ cursor: 'pointer' }}>Résultat complet</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 6 }}>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      ) : null}

      <div className="field">
        <label>Action</label>
        <select value={actionId} onChange={(e) => selectAction(e.target.value)}>
          <option value="">— Choisir —</option>
          {actions.map((a) => (
            <option key={a.id} value={a.id}>{a.label}{a.organ ? ` (${a.organ})` : ''}</option>
          ))}
        </select>
      </div>

      {current && Object.entries(current.params || {}).map(([key, def]) => (
        <div className="field" key={key}>
          <label>{def.label || key}{def.required ? ' *' : ''}</label>
          {def.type === 'enum' ? (
            <select value={params[key] || ''} onChange={(e) => setParams((p) => ({ ...p, [key]: e.target.value }))}>
              {(def.options || []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : def.type === 'boolean' ? (
            <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!params[key]}
                onChange={(e) => setParams((p) => ({ ...p, [key]: e.target.checked }))}
              />
              <span className="muted" style={{ fontSize: 13 }}>Oui</span>
            </label>
          ) : def.type === 'multi' ? (
            <div className="grid" style={{ gap: 4 }}>
              {(def.options || []).map((o) => (
                <label key={o.value} className="row" style={{ gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Array.isArray(params[key]) && params[key].includes(o.value)}
                    onChange={() => toggleMulti(key, o.value)}
                  />
                  <span style={{ fontSize: 13 }}>{o.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <input
              type={def.type === 'number' ? 'number' : 'text'}
              value={params[key] ?? ''}
              onChange={(e) => setParams((p) => ({ ...p, [key]: e.target.value }))}
            />
          )}
        </div>
      ))}

      {current ? (
        <button className="success" disabled={busy} onClick={run} style={{ marginTop: 6 }}>
          {busy ? 'Exécution…' : 'Exécuter sur cet acteur'}
        </button>
      ) : null}
    </div>
  );
}
