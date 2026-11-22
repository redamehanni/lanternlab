/**
 * Lantern Lab E6 — Timeline, Carte, Médias, Simulateur.
 * Les conditions sont évaluées uniquement par l’API (même moteur).
 */
(function () {
  function fileUrl(uri) {
    if (!uri) return '';
    const sep = uri.includes('?') ? '&' : '?';
    return uri + sep + 'simKey=' + encodeURIComponent(window.KEY);
  }

  function situations() {
    const out = [];
    for (const f of window.state.adventure?.floors || []) {
      for (const s of f.situations || []) {
        out.push({ id: s.id, label: `${f.index} · ${s.title || s.letter || s.id}`, floorIndex: f.index });
      }
    }
    return out;
  }

  async function refreshE6() {
    const st = window.state;
    if (!st.adventure) return;
    st.e6 = await window.api('/creator/e6/views', {
      method: 'POST',
      body: JSON.stringify({ adventure: st.adventure }),
    });
  }

  async function inv(kind, payload) {
    const out = await window.api('/creator/inventory/update', {
      method: 'POST',
      body: JSON.stringify({ adventure: window.state.adventure, kind, payload }),
    });
    window.state.adventure = out.adventure;
    window.state.e6 = out.e6 || window.state.e6;
    render();
    return out;
  }

  function select(type, id) {
    window.state.e6Sel = { type, id };
    render();
  }

  function openStory(situationId) {
    window.state.selectedSitId = situationId;
    window.setWorkspace('story');
    window.renderAll();
  }

  function inspectHtml() {
    const st = window.state;
    const esc = window.esc;
    const sel = st.e6Sel || {};
    const e6 = st.e6;
    if (!e6) return '<p class="empty">Chargez une aventure</p>';

    if (sel.type === 'cue') {
      const cue = (e6.timeline.cues || []).find((c) => c.id === sel.id);
      if (!cue) return '<p class="empty">Cue introuvable</p>';
      const fields = [];
      if (cue.editable.includes('at')) {
        fields.push(`<label>Heure</label><input id="e6f_at" type="time" value="${esc((cue.at || '').slice(0, 5))}" />`);
      }
      if (cue.editable.includes('start')) {
        fields.push(`<label>Début</label><input id="e6f_start" type="time" value="${esc((cue.start || '').slice(0, 5))}" />`);
      }
      if (cue.editable.includes('end')) {
        fields.push(`<label>Fin</label><input id="e6f_end" type="time" value="${esc((cue.end || '').slice(0, 5))}" />`);
      }
      if (cue.editable.includes('afterMinutes')) {
        fields.push(`<label>Délai (min)</label><input id="e6f_after" type="number" min="0" value="${esc(cue.afterMinutes)}" />`);
      }
      if (cue.editable.includes('scheduleId')) {
        fields.push(`<label>Identifiant horaire</label><input id="e6f_sid" type="text" value="${esc(cue.scheduleId)}" />`);
      }
      return `
        <p class="kicker">${esc(cue.family)}</p>
        <h3 style="margin:0 0 8px">${esc(cue.label)}</h3>
        <p class="meta">Étage ${cue.floorIndex} · ${esc(cue.situationLabel)}</p>
        <div class="e6-form">${fields.join('')}</div>
        ${fields.length ? '<button type="button" class="btn primary" id="e6SaveCue">Enregistrer</button>' : '<p class="empty">Lecture seule — branchez-le dans Aventure.</p>'}
        <button type="button" class="btn sm" id="e6OpenSit" style="margin-top:8px">Ouvrir la situation</button>
      `;
    }

    if (sel.type === 'zone') {
      const z = (e6.map.zones || []).find((x) => x.id === sel.id);
      if (!z) return '<p class="empty">Lieu introuvable</p>';
      const lat = z.point?.lat ?? z.center?.lat ?? '';
      const lng = z.point?.lng ?? z.center?.lng ?? '';
      return `
        <p class="kicker">Lieu</p>
        <h3 style="margin:0 0 8px">${esc(z.label)}</h3>
        <p class="meta">${esc(z.kind)} · ${esc(z.id)}</p>
        <div class="e6-form">
          <label>Nom</label><input id="e6z_label" type="text" value="${esc(z.label)}" />
          ${z.kind === 'circle' ? `
            <label>Latitude</label><input id="e6z_lat" type="number" step="0.0001" value="${esc(lat)}" />
            <label>Longitude</label><input id="e6z_lng" type="number" step="0.0001" value="${esc(lng)}" />
            <label>Rayon (m)</label><input id="e6z_r" type="number" min="10" value="${esc(z.radiusM || z.point?.radiusM || 100)}" />
          ` : `
            <label>Arrondissement (1–20)</label><input id="e6z_code" type="number" min="1" max="20" value="${esc(z.code)}" />
          `}
        </div>
        <button type="button" class="btn primary" id="e6SaveZone">Enregistrer</button>
        <p class="meta" style="margin-top:10px">Utilisé par ${(z.usedBy || []).length} situation(s)</p>
      `;
    }

    if (sel.type === 'beacon') {
      const b = (e6.map.beacons || []).find((x) => x.id === sel.id);
      if (!b) return '<p class="empty">Balise introuvable</p>';
      const zones = (window.state.adventure.zones || []).map((z) =>
        `<option value="${esc(z.id)}" ${z.id === b.zoneId ? 'selected' : ''}>${esc(z.label)}</option>`
      ).join('');
      return `
        <p class="kicker">Balise ${esc(b.channel)}</p>
        <h3 style="margin:0 0 8px">${esc(b.label)}</h3>
        <div class="e6-form">
          <label>Nom</label><input id="e6b_label" type="text" value="${esc(b.label)}" />
          <label>Canal</label>
          <select id="e6b_ch"><option value="qr" ${b.channel === 'qr' ? 'selected' : ''}>QR</option><option value="nfc" ${b.channel === 'nfc' ? 'selected' : ''}>NFC</option></select>
          <label>Jeton</label><input id="e6b_tok" type="text" value="${esc(b.tokenId)}" />
          <label>Lieu sur la carte</label>
          <select id="e6b_zone"><option value="">—</option>${zones}</select>
        </div>
        <button type="button" class="btn primary" id="e6SaveBeacon">Enregistrer</button>
      `;
    }

    if (sel.type === 'media') {
      const row = (e6.media.items || []).find((x) => x.itemId === sel.id);
      if (!row) return '<p class="empty">Média introuvable</p>';
      const c = row.content;
      const preview = !c ? '' : c.kind === 'text'
        ? `<textarea id="e6m_body" rows="6">${esc(c.body || '')}</textarea>`
        : c.hasFile
          ? (c.kind === 'image'
            ? `<img class="media-preview" alt="" src="${esc(fileUrl(c.uri))}" />`
            : c.kind === 'audio'
              ? `<audio class="media-preview" controls src="${esc(fileUrl(c.uri))}"></audio>`
              : `<video class="media-preview" controls src="${esc(fileUrl(c.uri))}"></video>`)
          : '<p class="empty">Pas encore de fichier. Uploadez une photo, un audio ou une vidéo.</p>';
      return `
        <p class="kicker">Objet → contenu</p>
        <h3 style="margin:0 0 8px">${esc(row.label)}</h3>
        <p class="meta">${esc(row.skin)} · ${esc(row.itemId)}</p>
        <div class="e6-form">
          <label>Titre du contenu</label>
          <input id="e6m_label" type="text" value="${esc(c?.label || row.label)}" />
          <label>Nature</label>
          <select id="e6m_kind">
            ${(e6.media.contentKinds || []).map((k) =>
              `<option value="${k.id}" ${c?.kind === k.id ? 'selected' : ''}>${esc(k.label)}</option>`
            ).join('')}
          </select>
          ${preview}
          <label>Fichier réel (sandbox)</label>
          <input id="e6m_file" type="file" accept="image/*,audio/*,video/*,.txt" />
        </div>
        <button type="button" class="btn primary" id="e6SaveMedia">Enregistrer le texte</button>
        <button type="button" class="btn sm" id="e6Upload" style="margin-top:8px">Uploader le fichier</button>
      `;
    }

    if (st.workspace === 'timeline') {
      const opts = situations().map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
      return `
        <p class="kicker">Nouvelle fenêtre</p>
        <p>Ajoute « il est entre… » à une situation existante. Ça écrit dans l’aventure, pas dans une timeline séparée.</p>
        <div class="e6-form">
          <label>Situation</label><select id="e6add_sit">${opts}</select>
          <label>Début</label><input id="e6add_start" type="time" value="17:00" />
          <label>Fin</label><input id="e6add_end" type="time" value="17:15" />
        </div>
        <button type="button" class="btn primary" id="e6AddWindow">Ajouter la fenêtre</button>
      `;
    }
    if (st.workspace === 'map') {
      return '<p class="empty">Cliquez un lieu ou une balise. Cliquez la carte dans Simuler pour poser le joueur.</p>';
    }
    if (st.workspace === 'media') {
      return '<p class="empty">Cliquez un objet pour coller texte ou fichier.</p>';
    }
    if (st.workspace === 'sim') {
      return '<p>Le moteur tourne <strong>sur le serveur</strong>. Ici tu injectes l’état, tu lances, tu lis la trace.</p>';
    }
    return '<p class="empty">Sélectionnez un élément</p>';
  }

  function bindInspect() {
    const esc = window.esc;
    const st = window.state;
    const sel = st.e6Sel || {};
    const e6 = st.e6;
    const $ = (id) => document.getElementById(id);

    if ($('e6SaveCue') && sel.type === 'cue') {
      const cue = e6.timeline.cues.find((c) => c.id === sel.id);
      $('e6SaveCue').onclick = () => {
        const patch = {};
        if ($('e6f_at')) patch.at = $('e6f_at').value;
        if ($('e6f_start')) patch.start = $('e6f_start').value;
        if ($('e6f_end')) patch.end = $('e6f_end').value;
        if ($('e6f_after')) patch.afterMinutes = Number($('e6f_after').value);
        if ($('e6f_sid')) patch.scheduleId = $('e6f_sid').value;
        const match = {};
        if (cue.at) match.at = cue.at;
        if (cue.start) match.start = cue.start;
        if (cue.end) match.end = cue.end;
        if (cue.scheduleId) match.scheduleId = cue.scheduleId;
        inv('cue', { situationId: cue.situationId, kind: cue.kind, match, patch });
      };
    }
    if ($('e6OpenSit') && sel.type === 'cue') {
      const cue = e6.timeline.cues.find((c) => c.id === sel.id);
      $('e6OpenSit').onclick = () => openStory(cue.situationId);
    }
    if ($('e6SaveZone') && sel.type === 'zone') {
      $('e6SaveZone').onclick = () => {
        const payload = { id: sel.id, label: $('e6z_label').value };
        if ($('e6z_lat')) {
          payload.lat = Number($('e6z_lat').value);
          payload.lng = Number($('e6z_lng').value);
          payload.radiusM = Number($('e6z_r').value);
        }
        if ($('e6z_code')) payload.code = Number($('e6z_code').value);
        inv('zone', payload);
      };
    }
    if ($('e6SaveBeacon') && sel.type === 'beacon') {
      $('e6SaveBeacon').onclick = () => inv('beacon', {
        id: sel.id,
        label: $('e6b_label').value,
        channel: $('e6b_ch').value,
        tokenId: $('e6b_tok').value,
        zoneId: $('e6b_zone').value || null,
      });
    }
    if ($('e6SaveMedia') && sel.type === 'media') {
      $('e6SaveMedia').onclick = async () => {
        const row = e6.media.items.find((x) => x.itemId === sel.id);
        let contentId = row.content?.id;
        if (!contentId) {
          const made = await inv('ensureContent', { id: sel.id, kind: $('e6m_kind').value, label: $('e6m_label').value });
          contentId = made.updated.id;
        }
        await inv('content', {
          id: contentId,
          label: $('e6m_label').value,
          kind: $('e6m_kind').value,
          body: $('e6m_body') ? $('e6m_body').value : undefined,
        });
      };
    }
    if ($('e6Upload') && sel.type === 'media') {
      $('e6Upload').onclick = async () => {
        const input = $('e6m_file');
        if (!input?.files?.[0]) {
          document.getElementById('e6Inspect').insertAdjacentHTML('beforeend', '<p class="empty">Choisissez un fichier d’abord.</p>');
          return;
        }
        const row = e6.media.items.find((x) => x.itemId === sel.id);
        let contentId = row.content?.id;
        if (!contentId) {
          const made = await inv('ensureContent', { id: sel.id, kind: $('e6m_kind').value, label: $('e6m_label').value });
          contentId = made.updated.id;
        }
        const fd = new FormData();
        fd.append('file', input.files[0]);
        fd.append('adventureId', st.adventure.id || 'draft');
        fd.append('contentId', contentId);
        const res = await fetch(window.API + '/creator/media/upload', {
          method: 'POST',
          headers: { 'X-Lantern-Sim-Key': window.KEY },
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText);
        await inv('content', {
          id: contentId,
          uri: data.uri,
          mime: data.mime,
          originalName: data.originalName,
          fileId: data.fileId,
          kind: data.kind || $('e6m_kind').value,
          label: $('e6m_label').value,
        });
      };
    }
    if ($('e6AddWindow')) {
      $('e6AddWindow').onclick = () => inv('cue', {
        situationId: $('e6add_sit').value,
        add: 'clock_between',
        start: $('e6add_start').value,
        end: $('e6add_end').value,
      });
    }
  }

  function renderTimeline() {
    const esc = window.esc;
    const cues = window.state.e6?.timeline?.cues || [];
    const tz = window.state.e6?.timeline?.timezone || 'Europe/Paris';
    const hours = [];
    for (let h = 0; h <= 24; h += 3) {
      hours.push(`<div class="tl-hour" style="left:${(h / 24) * 100}%"><span>${String(h).padStart(2, '0')}h</span></div>`);
    }
    const bars = cues.filter((c) => c.startMin != null).map((c) => {
      const left = (c.startMin / 1440) * 100;
      const width = Math.max(1.2, ((c.durationMin || 1) / 1440) * 100);
      const sel = window.state.e6Sel.id === c.id ? 'sel' : '';
      return `<button type="button" class="tl-cue family-${esc(c.family)} ${sel}" data-cue="${esc(c.id)}" style="left:${left}%;width:${width}%">${esc(c.label)}</button>`;
    }).join('');
    const list = cues.map((c) => `
      <div class="e6-card ${window.state.e6Sel.id === c.id ? 'sel' : ''}" data-cue="${esc(c.id)}">
        <div><strong>${esc(c.label)}</strong></div>
        <div class="meta">Étage ${c.floorIndex} · ${esc(c.situationLabel)} · ${esc(c.kind)}${c.afterMinutes != null && c.startMin == null ? ' · +' + c.afterMinutes + ' min' : ''}</div>
      </div>`).join('') || '<p class="empty">Aucun horaire dans cette aventure. Ajoutez une fenêtre à droite, ou une condition « il est entre » dans Aventure.</p>';
    return `
      <div class="e6-head">
        <h2>Timeline</h2>
        <p>Quand ça se passe — fuseau ${esc(tz)}. Une cue = une situation, pas un second moteur.</p>
      </div>
      <div class="tl-axis">${hours.join('')}${bars}</div>
      <div class="e6-list">${list}</div>
    `;
  }

  function project(lat, lng, w, h, bounds) {
    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * w;
    const y = (1 - (lat - bounds.south) / (bounds.north - bounds.south)) * h;
    return { x, y };
  }

  function renderMap() {
    const esc = window.esc;
    const map = window.state.e6?.map;
    if (!map) return '<p class="empty">Pas de carte</p>';
    const w = 720;
    const h = 520;
    const dots = [];
    (map.zones || []).forEach((z) => {
      if (!z.point) return;
      const p = project(z.point.lat, z.point.lng, w, h, map.bounds);
      const r = Math.max(8, Math.min(42, (z.point.radiusM || 100) / 28));
      const sel = window.state.e6Sel.id === z.id;
      dots.push(`<circle class="map-pin" data-zone="${esc(z.id)}" cx="${p.x}" cy="${p.y}" r="${r}" fill="rgba(61,255,154,${sel ? 0.45 : 0.18})" stroke="${sel ? '#3dff9a' : '#1aa86a'}" stroke-width="2" />`);
      dots.push(`<text x="${p.x + 6}" y="${p.y - 8}" fill="#d8f5e4" font-size="11">${esc(z.label)}</text>`);
    });
    (map.beacons || []).forEach((b) => {
      if (!b.point) return;
      const p = project(b.point.lat, b.point.lng, w, h, map.bounds);
      const sel = window.state.e6Sel.id === b.id;
      dots.push(`<rect data-beacon="${esc(b.id)}" x="${p.x - 5}" y="${p.y - 5}" width="10" height="10" fill="${sel ? '#6ec8ff' : '#3a7aa0'}" />`);
    });
    const listZ = (map.zones || []).map((z) => `
      <div class="e6-card ${window.state.e6Sel.id === z.id ? 'sel' : ''}" data-zone="${esc(z.id)}">
        <div><strong>${esc(z.label)}</strong></div>
        <div class="meta">${esc(z.kind)}${z.point ? ` · ${z.point.lat.toFixed(4)}, ${z.point.lng.toFixed(4)}` : ''}</div>
      </div>`).join('');
    const listB = (map.beacons || []).map((b) => `
      <div class="e6-card ${window.state.e6Sel.id === b.id ? 'sel' : ''}" data-beacon="${esc(b.id)}">
        <div><strong>${esc(b.label)}</strong> · ${esc(b.channel).toUpperCase()}</div>
        <div class="meta">${esc(b.tokenId)}${b.point ? '' : ' · pas encore posée sur la carte (choisir un lieu)'}</div>
      </div>`).join('');
    return `
      <div class="e6-head">
        <h2>Carte</h2>
        <p>Où ça se passe — cercles GPS, arrondissements, balises QR / NFC. Ce n’est pas encore le GPS réel du téléphone.</p>
      </div>
      <div class="map-legend"><span><i></i>Lieu</span><span><i class="b"></i>Balise</span></div>
      <svg class="paris-map" id="parisMap" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${dots.join('')}</svg>
      <div class="e6-grid" style="margin-top:14px">
        <div><p class="kicker">Lieux</p><div class="e6-list">${listZ || '<p class="empty">Aucun lieu — créez-les dans Matériel.</p>'}</div></div>
        <div><p class="kicker">Balises</p><div class="e6-list">${listB || '<p class="empty">Aucune balise.</p>'}</div></div>
      </div>
    `;
  }

  function renderMedia() {
    const esc = window.esc;
    const media = window.state.e6?.media;
    if (!media) return '<p class="empty">Pas de médias</p>';
    const cards = (media.items || []).map((it) => {
      const c = it.content;
      const file = c?.hasFile ? 'fichier réel' : (c?.kind === 'text' && c.body ? 'texte' : 'contenu vide');
      return `
        <div class="e6-card ${window.state.e6Sel.id === it.itemId ? 'sel' : ''}" data-media="${esc(it.itemId)}">
          <div><strong>${esc(it.label)}</strong></div>
          <div class="meta">${esc(it.skin)} → ${c ? esc(c.kind) + ' · ' + esc(c.label) : 'pas de contenu'} · ${file}</div>
        </div>`;
    }).join('');
    const orphans = (media.orphanContents || []).map((c) =>
      `<div class="e6-card"><div><strong>${esc(c.label)}</strong></div><div class="meta">contenu orphelin · ${esc(c.kind)}</div></div>`
    ).join('');
    return `
      <div class="e6-head">
        <h2>Médias</h2>
        <p>Le contenu (texte, photo, audio, vidéo) n’est pas l’objet. La clé USB est l’objet ; le fichier est ici.</p>
      </div>
      <div class="e6-list">${cards || '<p class="empty">Aucun objet — passez par Matériel.</p>'}</div>
      ${orphans ? `<p class="kicker" style="margin-top:16px">Contenus non liés</p><div class="e6-list">${orphans}</div>` : ''}
    `;
  }

  function renderSim() {
    const esc = window.esc;
    const st = window.state;
    const f = st.simForm;
    const items = (st.adventure?.mediaItems || []).map((m) =>
      `<option value="${esc(m.id)}" ${f.mediaItemId === m.id ? 'selected' : ''}>${esc(m.label)}</option>`
    ).join('');
    const beacons = (st.adventure?.beacons || []).map((b) =>
      `<option value="${esc(b.id)}" ${f.beaconId === b.id ? 'selected' : ''}>${esc(b.label)}</option>`
    ).join('');
    const zones = (st.adventure?.zones || []).map((z) =>
      `<option value="${esc(z.id)}">${esc(z.label)}</option>`
    ).join('');
    const res = f.result;
    let log = '';
    if (res) {
      const steps = res.humanSteps || [];
      log = steps.map((s) => {
        const h = s.human || {};
        const ok = h.status === 'triggered';
        const why = (h.why || []).map((w) => `<div>${esc(w.text || w)}</div>`).join('');
        const what = (h.whatHappens || []).map((w) => `<div>→ ${esc(w.text || w)}</div>`).join('');
        return `<div class="${ok ? 'ok' : 'bad'}"><strong>${ok ? 'Déclenché' : esc((h.status || s.kind || 'trace').toUpperCase())}</strong>${why}${what || ''}</div>`;
      }).join('') || '<p class="empty">Pas de trace</p>';
      const fired = (res.steps || []).flatMap((s) => s.rulesFired || []);
      if (fired.length) {
        log += `<p class="kicker" style="margin-top:12px">Rules déclenchées</p>` +
          fired.map((r) => `<div class="e6-card">${esc(r.title || r.ruleId || r.id)}</div>`).join('');
      }
    }
    return `
      <div class="e6-head">
        <h2>Simulateur</h2>
        <p>Même moteur que le terrain. Pas de Wallet, pas de push. Position / heure injectées.</p>
      </div>
      <div class="e6-grid">
        <div class="e6-form">
          <label>Date et heure (local)</label>
          <input id="sim_now" type="datetime-local" value="${esc(f.now)}" />
          <label>Événement</label>
          <select id="sim_evt">
            <option value="geo.heartbeat" ${f.eventType === 'geo.heartbeat' ? 'selected' : ''}>Le joueur se déplace</option>
            <option value="media.discovered" ${f.eventType === 'media.discovered' ? 'selected' : ''}>Découvre un objet</option>
            <option value="media.consumed" ${f.eventType === 'media.consumed' ? 'selected' : ''}>Consomme un objet</option>
            <option value="media.opened" ${f.eventType === 'media.opened' ? 'selected' : ''}>Ouvre un objet</option>
            <option value="beacon.qr" ${f.eventType === 'beacon.qr' ? 'selected' : ''}>Scan QR</option>
            <option value="beacon.nfc" ${f.eventType === 'beacon.nfc' ? 'selected' : ''}>Scan NFC</option>
            <option value="time.schedule" ${f.eventType === 'time.schedule' ? 'selected' : ''}>Heure prévue (tick)</option>
            <option value="run.started" ${f.eventType === 'run.started' ? 'selected' : ''}>L’aventure commence</option>
          </select>
          <label>Objet (si besoin)</label>
          <select id="sim_media"><option value="">—</option>${items}</select>
          <label>Balise (si besoin)</label>
          <select id="sim_beacon"><option value="">—</option>${beacons}</select>
          <label>Se placer dans un lieu</label>
          <select id="sim_zone"><option value="">— garder lat/lng —</option>${zones}</select>
          <label>Latitude</label><input id="sim_lat" type="number" step="0.0001" value="${esc(f.lat)}" />
          <label>Longitude</label><input id="sim_lng" type="number" step="0.0001" value="${esc(f.lng)}" />
          <button type="button" class="btn primary" id="simGo">Simuler</button>
          <p class="meta" style="margin-top:8px">Astuce : dans l’onglet Carte, un clic peut aussi servir à poser le joueur — reviens ici ensuite.</p>
        </div>
        <div class="sim-log">${log || '<p class="empty">Lancez une simulation.</p>'}</div>
      </div>
    `;
  }

  function isoFromLocal(val) {
    if (!val) return new Date().toISOString();
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
  }

  async function runSim() {
    const st = window.state;
    const $ = (id) => document.getElementById(id);
    st.simForm.now = $('sim_now').value;
    st.simForm.eventType = $('sim_evt').value;
    st.simForm.mediaItemId = $('sim_media').value;
    st.simForm.beaconId = $('sim_beacon').value;
    st.simForm.lat = $('sim_lat').value;
    st.simForm.lng = $('sim_lng').value;
    const zoneId = $('sim_zone').value;
    if (zoneId && st.e6?.map) {
      const z = st.e6.map.zones.find((x) => x.id === zoneId);
      if (z?.point) {
        st.simForm.lat = String(z.point.lat);
        st.simForm.lng = String(z.point.lng);
      }
    }
    const type = st.simForm.eventType;
    const now = isoFromLocal(st.simForm.now);
    const payload = {};
    if (st.simForm.mediaItemId) payload.mediaItemId = st.simForm.mediaItemId;
    if (st.simForm.beaconId) {
      payload.beaconId = st.simForm.beaconId;
      const b = (st.adventure.beacons || []).find((x) => x.id === st.simForm.beaconId);
      if (b?.tokenId) payload.tokenId = b.tokenId;
    }
    const body = {
      adventure: st.adventure,
      now,
      lat: Number(st.simForm.lat),
      lng: Number(st.simForm.lng),
    };
    if (type === 'time.schedule') {
      body.tickTo = now;
    } else {
      body.event = { type, source: 'lab_sim', at: now, payload };
    }
    const out = await window.api('/creator/adventures/simulate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    st.simForm.result = out;
    render();
  }

  function bindView() {
    const root = document.getElementById('viewE6');
    if (!root) return;
    root.querySelectorAll('[data-cue]').forEach((el) => {
      el.onclick = () => select('cue', el.dataset.cue);
    });
    root.querySelectorAll('[data-zone]').forEach((el) => {
      el.onclick = (e) => { e.stopPropagation(); select('zone', el.dataset.zone); };
    });
    root.querySelectorAll('[data-beacon]').forEach((el) => {
      el.onclick = (e) => { e.stopPropagation(); select('beacon', el.dataset.beacon); };
    });
    root.querySelectorAll('[data-media]').forEach((el) => {
      el.onclick = () => select('media', el.dataset.media);
    });
    const go = document.getElementById('simGo');
    if (go) go.onclick = () => runSim().catch((err) => { document.getElementById('e6Inspect').innerHTML = `<p class="empty">${window.esc(err.message)}</p>`; });
  }

  async function render() {
    const st = window.state;
    const root = document.getElementById('viewE6');
    const insp = document.getElementById('e6Inspect');
    if (!root) return;
    const on = ['timeline', 'map', 'media', 'sim'].includes(st.workspace);
    if (!on) return;
    if (!st.adventure) {
      root.innerHTML = '<p class="empty">Chargez une aventure</p>';
      if (insp) insp.innerHTML = '<p class="empty">—</p>';
      return;
    }
    try { await refreshE6(); } catch (e) {
      root.innerHTML = `<p class="empty">${window.esc(e.message)}</p>`;
      return;
    }
    if (st.workspace === 'timeline') root.innerHTML = renderTimeline();
    else if (st.workspace === 'map') root.innerHTML = renderMap();
    else if (st.workspace === 'media') root.innerHTML = renderMedia();
    else if (st.workspace === 'sim') root.innerHTML = renderSim();
    if (insp) insp.innerHTML = inspectHtml();
    bindView();
    bindInspect();
  }

  window.LanternE6 = { render, select, refreshE6 };
})();
