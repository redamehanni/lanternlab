import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function WorldPage() {
  const [recipes, setRecipes] = useState([]);
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    try {
      const [r, b] = await Promise.all([api.recipes(), api.batches()]);
      setRecipes(r.recipes || []);
      setBatches(b.batches || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function runRecipe(recipeId, params) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.run(recipeId, params);
      setNotice(`Monde généré : ${res.label} — ${JSON.stringify(res.counts)}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reset(batchId) {
    if (!confirm(batchId ? 'Réinitialiser ce batch ?' : 'Réinitialiser TOUT le monde de démonstration ?')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.reset(batchId);
      setNotice(`Reset effectué : ${JSON.stringify(res)}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 24 }}>
      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      <div>
        <div className="section-title">Recettes de monde</div>
        <div className="grid cols">
          {recipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} busy={busy} onRun={runRecipe} />
          ))}
          {recipes.length === 0 ? <div className="muted">Aucune recette déclarée.</div> : null}
        </div>
      </div>

      <div>
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>Batches générés</div>
          <div className="spacer" />
          <button className="danger small" disabled={busy} onClick={() => reset(null)}>Reset tout</button>
        </div>
        <div className="card" style={{ padding: 0 }}>
          {batches.length === 0 ? (
            <div style={{ padding: 16 }} className="muted">Aucun batch. Lancez une recette.</div>
          ) : (
            batches.map((b) => (
              <div key={b.id} className="list-item" style={{ padding: '12px 16px' }}>
                <div className="row">
                  <div>
                    <strong>{b.label}</strong>{' '}
                    <span className={`pill ${b.status}`}>{b.status}</span>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {b.recipeId} · {b.entityCount} entités · {new Date(b.createdAt).toLocaleString('fr-FR')}
                    </div>
                  </div>
                  <div className="spacer" />
                  {b.status === 'active' ? (
                    <button className="subtle small" disabled={busy} onClick={() => reset(b.id)}>Reset</button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function RecipeCard({ recipe, busy, onRun }) {
  const [params, setParams] = useState(() => {
    const init = {};
    Object.entries(recipe.params || {}).forEach(([key, def]) => {
      init[key] = def.default ?? '';
    });
    return init;
  });

  return (
    <div className="card">
      <h3>{recipe.label}</h3>
      <div className="desc">{recipe.description}</div>

      {Object.entries(recipe.params || {}).map(([key, def]) => (
        <div className="field" key={key}>
          <label>{key}{def.min != null ? ` (${def.min}–${def.max})` : ''}</label>
          <input
            type={def.type === 'number' ? 'number' : 'text'}
            value={params[key]}
            min={def.min}
            max={def.max}
            onChange={(e) => setParams((p) => ({ ...p, [key]: e.target.value }))}
          />
        </div>
      ))}

      <button
        disabled={busy}
        style={{ marginTop: 6 }}
        onClick={() => onRun(recipe.id, normalize(recipe.params, params))}
      >
        Générer ce monde
      </button>
    </div>
  );
}

function normalize(defs = {}, values = {}) {
  const out = {};
  Object.entries(defs).forEach(([key, def]) => {
    const raw = values[key];
    out[key] = def.type === 'number' ? Number(raw) : raw;
  });
  return out;
}
