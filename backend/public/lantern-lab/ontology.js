/**
 * Vue Ontologie — graphe immersif (cartes + filaments).
 * Présentation uniquement : lit le modèle créateur, n’évalue pas le moteur.
 */
(function (global) {
  const KIND_META = {
    sit: { label: 'Situation', glyph: 'S' },
    item: { label: 'Objet', glyph: '●' },
    imposed: { label: 'Média imposé', glyph: '◆' },
    bureau: { label: 'Bureau', glyph: '▤' },
    container: { label: 'Contenant', glyph: '▣' },
    zone: { label: 'Lieu', glyph: '⌖' },
    beacon: { label: 'Balise', glyph: '⌁' },
    code: { label: 'Code', glyph: '#' },
    flag: { label: 'État', glyph: '⚑' },
  };

  const EDGE_META = {
    quand: 'QUAND',
    si: 'SI',
    alors: 'ALORS',
    sinon: 'SINON',
    range: 'RANGE',
    protege: 'CODE',
    contenu: 'CONTENU',
    debloque: 'DÉBLOQUE',
    lie: 'LIÉ',
  };

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function walkCond(node, visit) {
    if (!node || typeof node !== 'object') return;
    if (node.op === 'and' || node.op === 'or') {
      (node.children || []).forEach((c) => walkCond(c, visit));
      return;
    }
    if (node.op === 'not') {
      walkCond(node.child, visit);
      return;
    }
    visit(node);
  }

  function humanCond(c, labelOf) {
    if (!c) return '';
    if (c.op === 'and') return (c.children || []).map((x) => humanCond(x, labelOf)).join(' ET ');
    if (c.op === 'or') return '(' + (c.children || []).map((x) => humanCond(x, labelOf)).join(' OU ') + ')';
    if (c.op === 'not') return 'PAS (' + humanCond(c.child, labelOf) + ')';
    if (c.kind === 'player_in_place') return `le joueur est dans « ${c.label || labelOf('zone', c.zoneId) || c.zoneId} »`;
    if (c.kind === 'media_consumed') return `« ${c.label || labelOf('mediaItem', c.mediaItemId) || c.mediaItemId} » a été consommé`;
    if (c.kind === 'media_discovered') return `« ${c.label || labelOf('mediaItem', c.mediaItemId) || c.mediaItemId} » a été découvert`;
    if (c.kind === 'media_unlocked') return `« ${c.label || labelOf('mediaItem', c.mediaItemId) || c.mediaItemId} » est déverrouillé`;
    if (c.kind === 'flag_true') return c.label || `« ${c.varId} » est vrai`;
    if (c.kind === 'flag_false') return c.label || `« ${c.varId} » n’est pas encore arrivé`;
    if (c.kind === 'clock_is') return `il est ${c.at}`;
    if (c.kind === 'clock_between') return `il est entre ${c.start} et ${c.end}`;
    if (c.kind === 'floor_open') return `l’étage ${c.floorIndex} est ouvert`;
    if (c.kind === 'choice_equals') return `choix « ${c.choiceId} » = ${c.value}`;
    if (c.kind === 'code_submitted' || c.expected) return `code « ${c.expected} »`;
    return c.kind || c.label || '';
  }

  function humanAct(a, labelOf) {
    if (!a) return '';
    if (a.kind === 'notify') return a.message || 'Message';
    if (a.kind === 'unlock_floor') return `Débloquer l’étage ${a.floorIndex}`;
    if (a.kind === 'unlock_media') return `Débloquer « ${a.label || labelOf('mediaItem', a.mediaItemId) || a.mediaItemId} »`;
    if (a.kind === 'unlock_bureau') return 'Déverrouiller le Bureau (tous ses objets)';
    if (a.kind === 'show_item') return `Afficher « ${a.label || labelOf('mediaItem', a.mediaItemId) || a.mediaItemId} »`;
    if (a.kind === 'play_media') return `Lire « ${a.label || labelOf('mediaContent', a.mediaContentId) || a.mediaContentId} »`;
    if (a.kind === 'show_code_input') return `Afficher la saisie de code (${a.choiceId || 'code'})`;
    if (a.kind === 'show_button') return `Afficher le bouton « ${a.label || a.choiceId} »`;
    if (a.kind === 'add_journal') return `Journal : ${a.message || a.noteId}`;
    if (a.kind === 'set_flag') return a.label || `État « ${a.varId} » → ${JSON.stringify(a.value)}`;
    if (a.kind === 'wait_then') return a.label || `Attendre ${a.afterMinutes} min`;
    return a.kind;
  }

  function humanTrig(t, labelOf) {
    if (!t) return '—';
    const maps = {
      media_discovered: `Le joueur découvre « ${t.label || labelOf('mediaItem', t.mediaItemId) || t.mediaItemId} »`,
      media_consumed: `Le joueur consomme « ${t.label || labelOf('mediaItem', t.mediaItemId) || t.mediaItemId} »`,
      media_opened: `Le joueur ouvre « ${t.label || labelOf('mediaItem', t.mediaItemId) || t.mediaItemId} »`,
      beacon_found: `Le joueur trouve « ${t.label || labelOf('beacon', t.beaconId) || t.beaconId} »`,
      time_reached: `L’heure prévue arrive (${t.scheduleId || ''})`,
      run_started: 'L’aventure commence',
      player_choice: `Le joueur appuie sur « ${t.label || t.choiceId} »`,
      code_submitted: `Le joueur entre le code « ${t.expected || t.choiceId} »`,
      player_moves: 'Le joueur se déplace',
    };
    return maps[t.kind] || t.kind;
  }

  function addNode(map, node) {
    if (!node?.id || map.has(node.id)) {
      if (node?.id && map.has(node.id) && node.meta) {
        Object.assign(map.get(node.id).meta, node.meta);
      }
      return map.get(node.id);
    }
    map.set(node.id, {
      id: node.id,
      kind: node.kind,
      title: node.title || node.id,
      sub: node.sub || '',
      meta: node.meta || {},
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      w: node.kind === 'sit' ? 228 : 176,
      h: node.kind === 'sit' ? 118 : 84,
    });
    return map.get(node.id);
  }

  function addEdge(edges, from, to, rel, extra) {
    if (!from || !to || from === to) return;
    if (edges.some((e) => e.from === from && e.to === to && e.rel === rel)) return;
    edges.push({ from, to, rel, extra: extra || null });
  }

  function labelOfFactory(adv) {
    return function labelOf(type, id) {
      if (!id) return id;
      if (type === 'mediaItem') return (adv.mediaItems || []).find((m) => m.id === id)?.label || id;
      if (type === 'mediaContent') return (adv.mediaContents || []).find((m) => m.id === id)?.label || id;
      if (type === 'zone') return (adv.zones || []).find((z) => z.id === id)?.label || id;
      if (type === 'beacon') return (adv.beacons || []).find((b) => b.id === id)?.label || id;
      if (type === 'variable') return (adv.variables || []).find((v) => v.id === id)?.label || id;
      return id;
    };
  }

  function collectCodesForSit(sit, adv, incoming) {
    const codes = [];
    const t = sit.trigger || {};
    if (t.kind === 'code_submitted' && t.expected) {
      codes.push({ source: 'Déclencheur', value: String(t.expected), choiceId: t.choiceId || null });
    }
    walkCond(sit.conditionsGroup || null, (c) => {
      if (c.expected) codes.push({ source: 'Condition', value: String(c.expected), choiceId: c.choiceId || null });
      if (c.kind === 'choice_equals' && c.value != null) {
        codes.push({ source: 'Choix', value: String(c.value), choiceId: c.choiceId || null });
      }
    });
    (sit.conditions || []).forEach((c) => {
      if (c.expected) codes.push({ source: 'Condition', value: String(c.expected), choiceId: c.choiceId || null });
    });
    for (const a of [...(sit.thenActions || []), ...(sit.elseActions || [])]) {
      if (a.kind === 'show_code_input' && a.choiceId) {
        const inter = (adv.interactions || []).find((i) => i.id === a.choiceId);
        codes.push({
          source: 'Saisie affichée',
          value: inter?.expected || '(à saisir)',
          choiceId: a.choiceId,
        });
      }
    }
    incoming.forEach((n) => {
      if (n.kind === 'code' && n.meta?.expected) {
        codes.push({ source: n.title, value: String(n.meta.expected), choiceId: n.meta.choiceId || n.id });
      }
      if (n.kind === 'container' && n.meta?.code) {
        codes.push({ source: `Boîte « ${n.title} »`, value: String(n.meta.code), choiceId: n.meta.codeChoiceId || null });
      }
    });
    const seen = new Set();
    return codes.filter((c) => {
      const k = `${c.value}|${c.choiceId || ''}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function buildGraph(adv) {
    const nodes = new Map();
    const edges = [];
    const labelOf = labelOfFactory(adv);

    (adv.mediaItems || []).forEach((m) => {
      const imposed = m.role === 'imposed' || m.policy === 'imposed' || m.policy === 'required';
      const bureau = !imposed && (m.role === 'bureau' || m.slot === 'bureau');
      const isBox = m.role === 'container' || (adv.containers || []).some((c) => c.id === m.id || c.mediaItemId === m.id);
      addNode(nodes, {
        id: `item:${m.id}`,
        kind: imposed ? 'imposed' : isBox ? 'container' : bureau ? 'bureau' : 'item',
        title: m.label || m.id,
        sub: imposed ? 'Média imposé' : isBox ? 'Contenant' : bureau ? 'Bureau' : (m.skin || 'objet'),
        meta: { mediaItemId: m.id, skin: m.skin, policy: m.policy, contentId: m.contentId, role: m.role },
      });
    });

    (adv.containers || []).forEach((box) => {
      const bid = `item:${box.mediaItemId || box.id}`;
      addNode(nodes, {
        id: bid,
        kind: 'container',
        title: box.label || box.id,
        sub: box.lockWithCode ? 'Protégé par code' : 'Contenant',
        meta: {
          mediaItemId: box.mediaItemId || box.id,
          code: box.code,
          lockWithCode: box.lockWithCode,
          codeChoiceId: box.codeChoiceId,
          contains: box.contains || [],
        },
      });
      (box.contains || []).forEach((cid) => {
        const node = nodes.get(`item:${cid}`);
        if (node && node.kind !== 'container') {
          node.sub = `${node.sub || 'objet'} · dans une boîte`;
        }
        addEdge(edges, bid, `item:${cid}`, 'range');
      });
      if (box.lockWithCode && box.code) {
        const codeId = `code:${box.codeChoiceId || box.id}`;
        addNode(nodes, {
          id: codeId,
          kind: 'code',
          title: box.code,
          sub: `Code — ${box.label || box.id}`,
          meta: { expected: box.code, choiceId: box.codeChoiceId, containerId: box.id },
        });
        addEdge(edges, codeId, bid, 'protege');
      }
    });

    (adv.zones || []).forEach((z) => {
      addNode(nodes, {
        id: `zone:${z.id}`,
        kind: 'zone',
        title: z.label || z.id,
        sub: z.kind === 'arrondissement' ? `Arr. ${z.code}` : 'Lieu',
        meta: { zoneId: z.id },
      });
    });

    (adv.beacons || []).forEach((b) => {
      addNode(nodes, {
        id: `beacon:${b.id}`,
        kind: 'beacon',
        title: b.label || b.id,
        sub: (b.channel || 'qr').toUpperCase(),
        meta: { beaconId: b.id },
      });
    });

    (adv.interactions || []).forEach((it) => {
      if (it.kind !== 'code' && !it.expected) return;
      if (it.kind === 'code' || it.expected) {
        addNode(nodes, {
          id: `code:${it.id}`,
          kind: 'code',
          title: it.expected || it.label || it.id,
          sub: it.label || 'Saisie de code',
          meta: { expected: it.expected, choiceId: it.id },
        });
      }
    });

    for (const floor of adv.floors || []) {
      for (const sit of floor.situations || []) {
        addNode(nodes, {
          id: `sit:${sit.id}`,
          kind: 'sit',
          title: sit.title || sit.id,
          sub: `Situation ${sit.letter || ''} · étage ${floor.index}`.trim(),
          meta: { sitId: sit.id, floorIndex: floor.index, letter: sit.letter, floorTitle: floor.title },
        });

        const t = sit.trigger || {};
        if (t.mediaItemId) {
          addNode(nodes, { id: `item:${t.mediaItemId}`, kind: 'item', title: labelOf('mediaItem', t.mediaItemId) || t.mediaItemId, sub: 'Objet' });
          addEdge(edges, `item:${t.mediaItemId}`, `sit:${sit.id}`, 'quand', humanTrig(t, labelOf));
        }
        if (t.beaconId) {
          addNode(nodes, { id: `beacon:${t.beaconId}`, kind: 'beacon', title: labelOf('beacon', t.beaconId) || t.beaconId, sub: 'Balise' });
          addEdge(edges, `beacon:${t.beaconId}`, `sit:${sit.id}`, 'quand', humanTrig(t, labelOf));
        }
        if (t.kind === 'code_submitted' || t.choiceId) {
          const cid = t.choiceId || `code_${sit.id}`;
          const codeNode = `code:${cid}`;
          addNode(nodes, {
            id: codeNode,
            kind: t.kind === 'code_submitted' || t.expected ? 'code' : 'code',
            title: t.expected || t.label || cid,
            sub: t.kind === 'code_submitted' ? 'Code à entrer' : 'Choix',
            meta: { expected: t.expected, choiceId: cid },
          });
          addEdge(edges, codeNode, `sit:${sit.id}`, 'quand', humanTrig(t, labelOf));
        }

        const conds = [];
        if (sit.conditionsGroup) conds.push(sit.conditionsGroup);
        (sit.conditions || []).forEach((c) => conds.push(c));
        conds.forEach((root) => {
          walkCond(root, (c) => {
            if (c.zoneId) {
              addNode(nodes, { id: `zone:${c.zoneId}`, kind: 'zone', title: labelOf('zone', c.zoneId) || c.zoneId, sub: 'Lieu' });
              addEdge(edges, `zone:${c.zoneId}`, `sit:${sit.id}`, 'si', humanCond(c, labelOf));
            }
            if (c.mediaItemId) {
              addNode(nodes, { id: `item:${c.mediaItemId}`, kind: 'item', title: labelOf('mediaItem', c.mediaItemId) || c.mediaItemId, sub: 'Objet' });
              addEdge(edges, `item:${c.mediaItemId}`, `sit:${sit.id}`, 'si', humanCond(c, labelOf));
            }
            if (c.varId && c.kind !== 'floor_open') {
              addNode(nodes, { id: `flag:${c.varId}`, kind: 'flag', title: c.label || c.varId, sub: 'État' });
              addEdge(edges, `flag:${c.varId}`, `sit:${sit.id}`, 'si', humanCond(c, labelOf));
            }
            if (c.choiceId && c.expected) {
              addNode(nodes, { id: `code:${c.choiceId}`, kind: 'code', title: c.expected, sub: 'Code', meta: { expected: c.expected, choiceId: c.choiceId } });
              addEdge(edges, `code:${c.choiceId}`, `sit:${sit.id}`, 'si');
            }
          });
        });

        const emitActs = (list, rel) => {
          (list || []).forEach((a) => {
            if (a.mediaItemId) {
              addNode(nodes, { id: `item:${a.mediaItemId}`, kind: 'item', title: labelOf('mediaItem', a.mediaItemId) || a.mediaItemId, sub: 'Objet' });
              addEdge(edges, `sit:${sit.id}`, `item:${a.mediaItemId}`, rel, humanAct(a, labelOf));
            }
            if (a.kind === 'unlock_floor' && a.floorIndex != null) {
              const next = (adv.floors || []).find((f) => f.index === Number(a.floorIndex));
              (next?.situations || []).forEach((ns) => {
                addEdge(edges, `sit:${sit.id}`, `sit:${ns.id}`, 'debloque', `Ouvre l’étage ${a.floorIndex}`);
              });
            }
            if (a.kind === 'set_flag' && a.varId) {
              addNode(nodes, { id: `flag:${a.varId}`, kind: 'flag', title: a.label || a.varId, sub: 'État' });
              addEdge(edges, `sit:${sit.id}`, `flag:${a.varId}`, rel, humanAct(a, labelOf));
            }
            if (a.kind === 'show_code_input' && a.choiceId) {
              addNode(nodes, { id: `code:${a.choiceId}`, kind: 'code', title: a.choiceId, sub: 'Saisie', meta: { choiceId: a.choiceId } });
              addEdge(edges, `sit:${sit.id}`, `code:${a.choiceId}`, rel, humanAct(a, labelOf));
            }
            if (a.kind === 'add_journal' && a.noteId) {
              addNode(nodes, { id: `flag:journal_${a.noteId}`, kind: 'flag', title: a.message || a.noteId, sub: 'Journal' });
              addEdge(edges, `sit:${sit.id}`, `flag:journal_${a.noteId}`, rel);
            }
          });
        };
        emitActs(sit.thenActions, 'alors');
        emitActs(sit.elseActions, 'sinon');

        if (sit.transition?.unlockFloor != null) {
          const next = (adv.floors || []).find((f) => f.index === Number(sit.transition.unlockFloor));
          (next?.situations || []).forEach((ns) => {
            addEdge(edges, `sit:${sit.id}`, `sit:${ns.id}`, 'debloque', `Transition → étage ${sit.transition.unlockFloor}`);
          });
        }
      }

      if (floor.unlockNext) {
        const next = (adv.floors || []).find((f) => f.index === floor.index + 1);
        const lastSit = (floor.situations || [])[floor.situations.length - 1];
        if (next && lastSit) {
          (next.situations || []).forEach((ns) => {
            addEdge(edges, `sit:${lastSit.id}`, `sit:${ns.id}`, 'debloque', 'Condition d’étage');
          });
        }
      }
    }

    return { nodes: [...nodes.values()], edges, labelOf };
  }

  function layout(nodes, edges) {
    const sits = nodes.filter((n) => n.kind === 'sit');
    const others = nodes.filter((n) => n.kind !== 'sit');
    const byId = new Map(nodes.map((n) => [n.id, n]));

    sits.forEach((n, i) => {
      const a = (i / Math.max(sits.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const r = 280 + Math.min(sits.length, 18) * 18;
      n.x = Math.cos(a) * r * 1.25;
      n.y = Math.sin(a) * r * 0.82;
    });

    others.forEach((n) => {
      const nb = edges.filter((e) => e.from === n.id || e.to === n.id);
      const sit = nb
        .map((e) => byId.get(e.from === n.id ? e.to : e.from))
        .find((x) => x && x.kind === 'sit');
      const ang = Math.random() * Math.PI * 2;
      if (sit) {
        n.x = sit.x + Math.cos(ang) * 210;
        n.y = sit.y + Math.sin(ang) * 150;
      } else {
        n.x = Math.cos(ang) * 520;
        n.y = Math.sin(ang) * 380;
      }
    });

    const rest = { quand: 200, si: 190, alors: 200, sinon: 190, range: 150, protege: 140, debloque: 260, lie: 180, contenu: 120 };
    for (let k = 0; k < 110; k++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[j].x - nodes[i].x;
          let dy = nodes[j].y - nodes[i].y;
          const d2 = dx * dx + dy * dy || 40;
          const d = Math.sqrt(d2);
          const minD = (nodes[i].w + nodes[j].w) * 0.42;
          if (d < minD * 2.4) {
            const f = ((minD * 2.4 - d) / d) * 0.35;
            dx /= d;
            dy /= d;
            nodes[i].x -= dx * f * 12;
            nodes[i].y -= dy * f * 12;
            nodes[j].x += dx * f * 12;
            nodes[j].y += dy * f * 12;
          }
        }
      }
      for (const e of edges) {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const target = rest[e.rel] || 190;
        const f = (d - target) * 0.035;
        dx /= d;
        dy /= d;
        a.x += dx * f;
        a.y += dy * f;
        b.x -= dx * f;
        b.y -= dy * f;
      }
    }
  }

  function fingerprint(adv) {
    if (!adv) return '';
    return [
      adv.id,
      (adv.floors || []).map((f) => (f.situations || []).map((s) => s.id).join(',')).join('|'),
      (adv.mediaItems || []).map((m) => m.id).join(','),
      (adv.containers || []).map((c) => c.id).join(','),
      (adv.zones || []).map((z) => z.id).join(','),
    ].join('/');
  }

  function bezier(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const c1x = x1 + dx * 0.38;
    const c1y = y1 + dy * 0.08 - Math.min(Math.abs(dx), 80) * 0.15;
    const c2x = x1 + dx * 0.62;
    const c2y = y2 - dy * 0.08 + Math.min(Math.abs(dx), 80) * 0.15;
    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
  }

  function create(root, hooks) {
    const onto = {
      panX: 0,
      panY: 0,
      scale: 0.72,
      nodes: [],
      edges: [],
      labelOf: () => '',
      selectedId: null,
      filters: { sit: true, item: true, container: true, zone: true, beacon: true, code: true, flag: true },
      fp: '',
      dragging: false,
      lastX: 0,
      lastY: 0,
      dragMoved: false,
      detailId: null,
    };

    root.innerHTML = `
      <div class="onto-root" id="ontoRoot">
        <div class="onto-hud">
          <div class="onto-hint">Trackpad : glisser pour naviguer · pincer / ⌃ molette pour zoomer · ✕ ou clic dans le vide pour tout réafficher</div>
          <div class="onto-tools">
            <button type="button" class="btn sm" data-onto="clear">Tout afficher</button>
            <button type="button" class="btn sm" data-onto="fit">Recadrer</button>
            <button type="button" class="btn sm" data-onto="zin">+</button>
            <button type="button" class="btn sm" data-onto="zout">−</button>
            <span class="onto-zoom" id="ontoZoom">72%</span>
          </div>
          <div class="onto-filters" id="ontoFilters"></div>
        </div>
        <div class="onto-viewport" id="ontoViewport">
          <div class="onto-space" id="ontoSpace">
            <svg class="onto-svg" id="ontoSvg" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="phosGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="2.4" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <g id="ontoFilaments"></g>
            </svg>
            <div class="onto-cards" id="ontoCards"></div>
          </div>
        </div>
        <aside class="onto-float hidden" id="ontoFloat"></aside>
      </div>
    `;

    const viewport = root.querySelector('#ontoViewport');
    const space = root.querySelector('#ontoSpace');
    const svgG = root.querySelector('#ontoFilaments');
    const cardsEl = root.querySelector('#ontoCards');
    const floatEl = root.querySelector('#ontoFloat');
    const zoomEl = root.querySelector('#ontoZoom');
    const filtersEl = root.querySelector('#ontoFilters');

    function visibleKinds() {
      return onto.filters;
    }

    function isVisible(node) {
      if (!node) return false;
      return onto.filters[node.kind] !== false;
    }

    function applyCam() {
      space.style.transform = `translate(${onto.panX}px, ${onto.panY}px) scale(${onto.scale})`;
      if (zoomEl) zoomEl.textContent = `${Math.round(onto.scale * 100)}%`;
    }

    function fit() {
      const vis = onto.nodes.filter(isVisible);
      if (!vis.length) return;
      const pad = 80;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      vis.forEach((n) => {
        minX = Math.min(minX, n.x - n.w / 2);
        minY = Math.min(minY, n.y - n.h / 2);
        maxX = Math.max(maxX, n.x + n.w / 2);
        maxY = Math.max(maxY, n.y + n.h / 2);
      });
      const rw = viewport.clientWidth || 800;
      const rh = viewport.clientHeight || 560;
      const bw = maxX - minX + pad * 2;
      const bh = maxY - minY + pad * 2;
      onto.scale = Math.min(1.15, Math.max(0.28, Math.min(rw / bw, rh / bh)));
      onto.panX = rw / 2 - ((minX + maxX) / 2) * onto.scale;
      onto.panY = rh / 2 - ((minY + maxY) / 2) * onto.scale;
      applyCam();
    }

    function neighborsOf(id) {
      const set = new Set([id]);
      onto.edges.forEach((e) => {
        if (e.from === id) set.add(e.to);
        if (e.to === id) set.add(e.from);
      });
      return set;
    }

    function paintFilaments() {
      const visN = new Set(onto.nodes.filter(isVisible).map((n) => n.id));
      const byId = new Map(onto.nodes.map((n) => [n.id, n]));
      const hi = onto.selectedId ? neighborsOf(onto.selectedId) : null;
      svgG.innerHTML = onto.edges.map((e, i) => {
        if (!visN.has(e.from) || !visN.has(e.to)) return '';
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return '';
        const dim = hi && !hi.has(e.from) && !hi.has(e.to);
        const hot = hi && hi.has(e.from) && hi.has(e.to);
        const d = bezier(a.x, a.y, b.x, b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - 8;
        return `<path class="onto-fil ${dim ? 'dim' : ''} ${hot ? 'hot' : ''}" data-ei="${i}" d="${d}" />
          <text class="onto-elab ${dim ? 'dim' : ''}" x="${mx}" y="${my}">${esc(EDGE_META[e.rel] || e.rel)}</text>`;
      }).join('');
    }

    function paintCards() {
      const hi = onto.selectedId ? neighborsOf(onto.selectedId) : null;
      cardsEl.innerHTML = onto.nodes.filter(isVisible).map((n) => {
        const meta = KIND_META[n.kind] || KIND_META.item;
        const dim = hi && !hi.has(n.id);
        const sel = n.id === onto.selectedId;
        return `<article class="onto-card kind-${n.kind} ${sel ? 'selected' : ''} ${dim ? 'dim' : ''}"
          data-nid="${esc(n.id)}" style="width:${n.w}px;left:${n.x - n.w / 2}px;top:${n.y - n.h / 2}px">
          <div class="onto-k"><span>${esc(meta.glyph)}</span>${esc(meta.label)}</div>
          <h3>${esc(n.title)}</h3>
          <p>${esc(n.sub)}</p>
          <button type="button" class="btn sm onto-det" data-det="${esc(n.id)}">Afficher les détails</button>
        </article>`;
      }).join('');

      cardsEl.querySelectorAll('.onto-card').forEach((el) => {
        el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
        el.addEventListener('click', (ev) => {
          if (ev.target.closest('[data-det]')) return;
          select(el.dataset.nid);
        });
      });
      cardsEl.querySelectorAll('[data-det]').forEach((b) => {
        b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          select(b.dataset.det);
          openDetail(b.dataset.det);
        });
      });
    }

    function select(id) {
      onto.selectedId = id;
      const n = onto.nodes.find((x) => x.id === id);
      if (n?.kind === 'sit' && n.meta.sitId && hooks.onSelectSit) {
        hooks.onSelectSit(n.meta.sitId, n.meta.floorIndex);
      }
      paintFilaments();
      paintCards();
    }

    function incoming(id) {
      return onto.edges.filter((e) => e.to === id).map((e) => ({
        edge: e,
        node: onto.nodes.find((n) => n.id === e.from),
      })).filter((x) => x.node);
    }
    function outgoing(id) {
      return onto.edges.filter((e) => e.from === id).map((e) => ({
        edge: e,
        node: onto.nodes.find((n) => n.id === e.to),
      })).filter((x) => x.node);
    }

    function openDetail(id) {
      const n = onto.nodes.find((x) => x.id === id);
      if (!n) return;
      onto.detailId = id;
      const adv = hooks.getAdventure();
      const labelOf = onto.labelOf;
      const inn = incoming(id);
      const out = outgoing(id);
      let body = '';

      if (n.kind === 'sit') {
        const found = (adv.floors || []).flatMap((f) => (f.situations || []).map((s) => ({ s, f }))).find((x) => x.s.id === n.meta.sitId);
        const sit = found?.s;
        const codes = sit ? collectCodesForSit(sit, adv, inn.map((x) => x.node)) : [];
        body += `<section><h4>D’où ça vient</h4>`;
        if (sit?.trigger) body += `<p class="onto-line"><b>QUAND</b> ${esc(humanTrig(sit.trigger, labelOf))}</p>`;
        const condTxt = sit?.conditionsGroup
          ? humanCond(sit.conditionsGroup, labelOf)
          : (sit?.conditions || []).map((c) => humanCond(c, labelOf)).filter(Boolean).join(' ET ');
        if (condTxt) body += `<p class="onto-line"><b>SI</b> ${esc(condTxt)}</p>`;
        if (!sit?.trigger && !condTxt) body += `<p class="onto-muted">Aucun déclencheur renseigné.</p>`;
        inn.forEach((x) => {
          body += `<button type="button" class="onto-link" data-jump="${esc(x.node.id)}">${esc(EDGE_META[x.edge.rel] || x.edge.rel)} ← ${esc(x.node.title)}</button>`;
        });
        body += `</section><section><h4>Codes pour y arriver</h4>`;
        if (codes.length) {
          body += codes.map((c) => `<p class="onto-code"><span>${esc(c.source)}</span><strong>${esc(c.value)}</strong></p>`).join('');
        } else {
          body += `<p class="onto-muted">Aucun code n’est requis pour cette situation.</p>`;
        }
        body += `</section><section><h4>Ce qu’elle engendre</h4>`;
        (sit?.thenActions || []).forEach((a) => {
          body += `<p class="onto-line"><b>ALORS</b> ${esc(humanAct(a, labelOf))}</p>`;
        });
        (sit?.elseActions || []).forEach((a) => {
          body += `<p class="onto-line"><b>SINON</b> ${esc(humanAct(a, labelOf))}</p>`;
        });
        if (sit?.transition?.unlockFloor != null) {
          body += `<p class="onto-line"><b>DONC</b> débloque l’étage ${esc(sit.transition.unlockFloor)}</p>`;
        }
        if (!(sit?.thenActions || []).length && !(sit?.elseActions || []).length && sit?.transition == null) {
          body += `<p class="onto-muted">Pas d’effet déclaré.</p>`;
        }
        out.forEach((x) => {
          body += `<button type="button" class="onto-link" data-jump="${esc(x.node.id)}">${esc(EDGE_META[x.edge.rel] || x.edge.rel)} → ${esc(x.node.title)}</button>`;
        });
        body += `</section>`;
      } else if (n.kind === 'container' || n.kind === 'item' || n.kind === 'imposed' || n.kind === 'bureau') {
        const box = (adv.containers || []).find((c) => `item:${c.mediaItemId || c.id}` === n.id);
        const item = (adv.mediaItems || []).find((m) => `item:${m.id}` === n.id);
        const heading = n.kind === 'imposed' ? 'Média imposé' : n.kind === 'bureau' ? 'Objet du bureau' : 'Objet';
        const intro = n.kind === 'imposed'
          ? 'Point de départ · visible dès l’étage 0'
          : n.kind === 'bureau'
            ? 'Bureau · apparaît quand le Bureau est déverrouillé'
            : (item?.skin || n.kind);
        body += `<section><h4>${heading}</h4>
          <p class="onto-line">${esc(intro)} · ${esc(item?.policy || '')}</p>`;
        if (item?.contentId) body += `<p class="onto-line">Contenu : ${esc(labelOf('mediaContent', item.contentId))}</p>`;
        if (box?.lockWithCode) body += `<p class="onto-code"><span>Code de la boîte</span><strong>${esc(box.code)}</strong></p>`;
        if (box?.contains?.length) {
          body += `<p class="onto-line">Range : ${esc(box.contains.map((id) => labelOf('mediaItem', id)).join(', '))}</p>`;
        }
        body += `</section><section><h4>Rôle dans l’aventure</h4>`;
        inn.forEach((x) => {
          body += `<button type="button" class="onto-link" data-jump="${esc(x.node.id)}">vient de ${esc(x.node.title)}</button>`;
        });
        out.forEach((x) => {
          body += `<button type="button" class="onto-link" data-jump="${esc(x.node.id)}">${esc(EDGE_META[x.edge.rel] || '')} → ${esc(x.node.title)}</button>`;
        });
        if (!inn.length && !out.length) body += `<p class="onto-muted">Pas encore branché à une situation.</p>`;
        body += `</section>`;
      } else if (n.kind === 'code') {
        body += `<section><h4>Code</h4>
          <p class="onto-code"><span>${esc(n.sub)}</span><strong>${esc(n.meta.expected || n.title)}</strong></p>
          ${n.meta.choiceId ? `<p class="onto-muted">Identifiant de saisie : ${esc(n.meta.choiceId)}</p>` : ''}
        </section><section><h4>Ouvre / déclenche</h4>`;
        out.forEach((x) => {
          body += `<button type="button" class="onto-link" data-jump="${esc(x.node.id)}">→ ${esc(x.node.title)}</button>`;
        });
        inn.forEach((x) => {
          body += `<button type="button" class="onto-link" data-jump="${esc(x.node.id)}">posé par ${esc(x.node.title)}</button>`;
        });
        body += `</section>`;
      } else {
        body += `<section><h4>${esc(KIND_META[n.kind]?.label || n.kind)}</h4>
          <p class="onto-line">${esc(n.sub)}</p></section><section><h4>Liens</h4>`;
        inn.concat(out).forEach((x) => {
          body += `<button type="button" class="onto-link" data-jump="${esc(x.node.id)}">${esc(x.node.title)}</button>`;
        });
        if (!inn.length && !out.length) body += `<p class="onto-muted">Isolé pour l’instant.</p>`;
        body += `</section>`;
      }

      floatEl.classList.remove('hidden');
      floatEl.innerHTML = `
        <header>
          <div>
            <div class="onto-k">${esc(KIND_META[n.kind]?.label || n.kind)}</div>
            <h3>${esc(n.title)}</h3>
          </div>
          <button type="button" class="btn sm" data-close-float>✕</button>
        </header>
        <div class="onto-float-body">${body}</div>
      `;
      floatEl.querySelector('[data-close-float]').onclick = closeDetail;
      floatEl.querySelectorAll('[data-jump]').forEach((b) => {
        b.onclick = () => {
          focusNode(b.dataset.jump);
          openDetail(b.dataset.jump);
        };
      });
    }

    function closeDetail() {
      onto.detailId = null;
      onto.selectedId = null;
      floatEl.classList.add('hidden');
      floatEl.innerHTML = '';
      paintFilaments();
      paintCards();
    }

    function focusNode(id) {
      const n = onto.nodes.find((x) => x.id === id);
      if (!n) return;
      const rw = viewport.clientWidth || 800;
      const rh = viewport.clientHeight || 560;
      onto.panX = rw / 2 - n.x * onto.scale;
      onto.panY = rh / 2 - n.y * onto.scale;
      applyCam();
      select(id);
    }

    function paintFilters() {
      const keys = [
        ['sit', 'Situations'],
        ['item', 'Objets'],
        ['container', 'Contenants'],
        ['zone', 'Lieux'],
        ['beacon', 'Balises'],
        ['code', 'Codes'],
        ['flag', 'États'],
      ];
      filtersEl.innerHTML = keys.map(([k, lab]) =>
        `<button type="button" class="onto-chip ${onto.filters[k] ? 'on' : ''}" data-fk="${k}">${lab}</button>`
      ).join('');
      filtersEl.querySelectorAll('[data-fk]').forEach((b) => {
        b.onclick = () => {
          onto.filters[b.dataset.fk] = !onto.filters[b.dataset.fk];
          paintFilters();
          paintFilaments();
          paintCards();
        };
      });
    }

    function zoomAt(cx, cy, factor) {
      const rect = viewport.getBoundingClientRect();
      const lx = cx - rect.left;
      const ly = cy - rect.top;
      const wx = (lx - onto.panX) / onto.scale;
      const wy = (ly - onto.panY) / onto.scale;
      onto.scale = Math.min(2.2, Math.max(0.22, onto.scale * factor));
      onto.panX = lx - wx * onto.scale;
      onto.panY = ly - wy * onto.scale;
      applyCam();
    }

    root.querySelector('[data-onto="clear"]').onclick = closeDetail;
    root.querySelector('[data-onto="fit"]').onclick = fit;
    root.querySelector('[data-onto="zin"]').onclick = () => {
      const r = viewport.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.18);
    };
    root.querySelector('[data-onto="zout"]').onclick = () => {
      const r = viewport.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.18);
    };

    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 0.92 : 1.08);
      } else {
        onto.panX -= e.deltaX;
        onto.panY -= e.deltaY;
        applyCam();
      }
    }, { passive: false });

    viewport.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.onto-card') || e.target.closest('.onto-float')) return;
      onto.dragging = true;
      onto.dragMoved = false;
      onto.lastX = e.clientX;
      onto.lastY = e.clientY;
      viewport.classList.add('grabbing');
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!onto.dragging) return;
      const dx = e.clientX - onto.lastX;
      const dy = e.clientY - onto.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) onto.dragMoved = true;
      onto.panX += dx;
      onto.panY += dy;
      onto.lastX = e.clientX;
      onto.lastY = e.clientY;
      applyCam();
    });
    viewport.addEventListener('pointerup', () => {
      const wasClick = onto.dragging && !onto.dragMoved;
      onto.dragging = false;
      onto.dragMoved = false;
      viewport.classList.remove('grabbing');
      if (wasClick && (onto.selectedId || onto.detailId)) closeDetail();
    });
    viewport.addEventListener('pointercancel', () => {
      onto.dragging = false;
      viewport.classList.remove('grabbing');
    });

    document.addEventListener('keydown', (e) => {
      if (root.closest('.hidden')) return;
      if (!root.offsetParent && root.closest('#viewGraph')?.classList.contains('hidden')) return;
      const host = document.getElementById('viewGraph');
      if (!host || host.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeDetail();
      if (e.key === '+' || e.key === '=') {
        const r = viewport.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.12);
      }
      if (e.key === '-' || e.key === '_') {
        const r = viewport.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.12);
      }
      if (e.key === '0') fit();
    });

    function load(adv, opts = {}) {
      if (!adv) {
        cardsEl.innerHTML = '<p class="empty">Chargez une aventure</p>';
        return;
      }
      const fp = fingerprint(adv);
      const rebuilt = fp !== onto.fp || opts.force;
      if (rebuilt) {
        const g = buildGraph(adv);
        onto.nodes = g.nodes;
        onto.edges = g.edges;
        onto.labelOf = g.labelOf;
        onto.fp = fp;
        layout(onto.nodes, onto.edges);
        paintFilters();
        paintFilaments();
        paintCards();
        requestAnimationFrame(fit);
      } else {
        paintFilaments();
        paintCards();
      }
    }

    paintFilters();
    applyCam();

    return { load, fit, select, openDetail, closeDetail, focusNode };
  }

  global.LanternOnto = { create };
})(window);
