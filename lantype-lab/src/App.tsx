import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadCanvasKit, type CanvasKit } from './engine/canvaskit';
import type { CompareMode, FrameMode, LabCard } from './engine/Stage';
import {
  cloneParams,
  createLabCard,
  defaultCardParams,
  defaultLabCards,
} from './engine/labCards';
import { ENVIRONMENTS, getEnvironment } from './lighting/environments';
import {
  deletePreset,
  listBackgrounds,
  listPresets,
  savePreset,
  uploadBackground,
  type PresetFile,
} from './lib/presetsApi';
import { getMaterial, MATERIALS } from './materials/registry';
import { defaultParams, type Params } from './materials/types';
import { setParam } from './ui/ControlField';
import { ParamPanel } from './ui/ParamPanel';
import { PHONE_FRAME, ToolsBar } from './ui/ToolsBar';
import { Viewport } from './ui/Viewport';

const FRAME_STORAGE_KEY = 'lantyp-lab-frame-mode';

function readStoredFrameMode(): FrameMode {
  try {
    const v = localStorage.getItem(FRAME_STORAGE_KEY);
    if (v === 'phone' || v === 'desktop') return v;
  } catch {
    /* ignore */
  }
  return 'desktop';
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default function App() {
  const [ck, setCk] = useState<CanvasKit | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const [materialId, setMaterialId] = useState('glass');
  const material = useMemo(() => getMaterial(materialId), [materialId]);

  const [activeGroup, setActiveGroup] = useState(material.groups[0]?.id ?? 'matiere');
  const [layerCode, setLayerCode] = useState(0);
  const [compareMode, setCompareMode] = useState<CompareMode>('single');
  const [frameMode, setFrameMode] = useState<FrameMode>(() => readStoredFrameMode());
  const [split, setSplit] = useState(0.5);
  const [environmentId, setEnvironmentId] = useState('neutre');
  const [draggingReflect, setDraggingReflect] = useState(false);
  const [draggingBackground, setDraggingBackground] = useState(false);
  const [cards, setCards] = useState<LabCard[]>(() => defaultLabCards());
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [bgZoom, setBgZoom] = useState(1);
  const [bgPan, setBgPan] = useState<[number, number]>([0, 0]);

  const [backgrounds, setBackgrounds] = useState<string[]>([]);
  const [background, setBackground] = useState<string | null>(null);

  const [presets, setPresets] = useState<PresetFile[]>([]);
  const [comparePresetId, setComparePresetId] = useState<string | null>(null);
  const [status, setStatus] = useState('Pret');

  const environment = getEnvironment(environmentId);
  const backgroundUrl = background ? `/backgrounds/${background}` : null;

  const paramsB = useMemo(() => {
    if (!comparePresetId) return null;
    const found = presets.find((p) => p.id === comparePresetId);
    return found ? (found.params as Params) : null;
  }, [comparePresetId, presets]);

  useEffect(() => {
    let cancelled = false;
    loadCanvasKit()
      .then((kit) => {
        if (!cancelled) setCk(kit);
      })
      .catch((err: Error) => {
        if (!cancelled) setBootError(err.message || String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshPresets = useCallback(async () => {
    const list = await listPresets(material.id);
    setPresets(list);
    return list;
  }, [material.id]);

  const refreshBackgrounds = useCallback(async () => {
    const list = await listBackgrounds();
    setBackgrounds(list);
    setBackground((current) => {
      if (current === 'homme-lanterne.jpg' || current === 'img_2415.jpg') return current;
      if (list.includes('homme-lanterne.jpg')) return 'homme-lanterne.jpg';
      if (list.includes('img_2415.jpg')) return 'img_2415.jpg';
      if (current) return current;
      if (list.includes('atelier.png')) return 'atelier.png';
      return list[0] ?? null;
    });
    return list;
  }, []);

  const stylesBooted = useRef(false);
  useEffect(() => {
    void refreshPresets()
      .then((list) => {
        if (stylesBooted.current) return;
        const v1 = list.find((p) => p.id === 'glass-v1');
        if (!v1) return;
        stylesBooted.current = true;
        setCards((prev) =>
          prev.map((c, index) =>
            index === 0
              ? {
                  ...c,
                  params: cloneParams(v1.params as Params),
                  styleId: v1.id,
                  styleName: v1.name,
                }
              : c,
          ),
        );
      })
      .catch((err) => setStatus(`Presets: ${err.message}`));
    void refreshBackgrounds().catch((err) => setStatus(`Fonds: ${err.message}`));
  }, [refreshPresets, refreshBackgrounds]);

  // Assure une carte active des le demarrage.
  useEffect(() => {
    if (!cards.length) {
      const first = createLabCard('Carte 1');
      setCards([first]);
      setActiveCardId(first.id);
      return;
    }
    if (!activeCardId || !cards.some((c) => c.id === activeCardId)) {
      setActiveCardId(cards[0]!.id);
    }
  }, [cards, activeCardId]);

  const activeCard = useMemo(
    () => cards.find((c) => c.id === activeCardId) ?? cards[0] ?? null,
    [cards, activeCardId],
  );

  const params = activeCard?.params ?? defaultParams(material.groups);
  const activePresetId = activeCard?.styleId ?? null;
  const presetName = activeCard?.styleName ?? 'Style libre';

  const setParams = useCallback(
    (next: Params | ((prev: Params) => Params)) => {
      if (!activeCardId) return;
      setCards((prev) =>
        prev.map((c) => {
          if (c.id !== activeCardId) return c;
          const resolved = typeof next === 'function' ? next(c.params) : next;
          return { ...c, params: resolved };
        }),
      );
    },
    [activeCardId],
  );

  const setPresetName = useCallback(
    (name: string) => {
      if (!activeCardId) return;
      setCards((prev) =>
        prev.map((c) => (c.id === activeCardId ? { ...c, styleName: name } : c)),
      );
    },
    [activeCardId],
  );

  // Homme a la lanterne : mode simple.
  useEffect(() => {
    if (background !== 'homme-lanterne.jpg' && background !== 'img_2415.jpg') return;
    setCompareMode('single');
    setComparePresetId(null);
  }, [background]);

  const handleFrameMode = useCallback((mode: FrameMode) => {
    setFrameMode(mode);
    if (mode === 'phone') {
      setCards((prev) =>
        prev.map((c) => ({
          ...c,
          width: Math.min(c.width, PHONE_FRAME.w - 32),
        })),
      );
    }
    try {
      localStorage.setItem(FRAME_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const resetBackgroundLayout = useCallback(() => {
    setBgZoom(1);
    setBgPan([0, 0]);
  }, []);

  const handleAddCard = useCallback(() => {
    const suggested = `Carte ${cards.length + 1}`;
    const name = window.prompt('Nom de la nouvelle carte', suggested);
    if (name === null) return;
    const source = cards.find((c) => c.id === activeCardId) ?? cards[0];
    const card = createLabCard(name.trim() || suggested, {
      offsetX: (cards.length % 3) * 18,
      offsetY: (cards.length % 3) * 24,
      params: source ? cloneParams(source.params) : defaultCardParams(material.id),
      styleId: source?.styleId ?? null,
      styleName: source?.styleName ?? 'Style libre',
    });
    setCards((prev) => [...prev, card]);
    setActiveCardId(card.id);
    setStatus(`Carte ajoutee : ${card.name}`);
  }, [cards, activeCardId, material.id]);

  const handleRenameCard = useCallback(() => {
    if (!activeCard) return;
    const next = window.prompt('Renommer la carte', activeCard.name);
    if (!next || !next.trim()) return;
    const name = next.trim();
    setCards((prev) => prev.map((c) => (c.id === activeCard.id ? { ...c, name } : c)));
    setStatus(`Carte renommee : ${name}`);
  }, [activeCard]);

  const handleDeleteCard = useCallback(() => {
    if (!activeCard || cards.length <= 1) return;
    if (!window.confirm(`Supprimer « ${activeCard.name} » ?`)) return;
    setCards((prev) => prev.filter((c) => c.id !== activeCard.id));
    setStatus(`Carte supprimee : ${activeCard.name}`);
  }, [activeCard, cards.length]);

  const patchActiveCard = useCallback(
    (
      patch: Partial<
        Pick<
          LabCard,
          | 'name'
          | 'width'
          | 'height'
          | 'offsetX'
          | 'offsetY'
          | 'eyebrow'
          | 'title'
          | 'body'
          | 'showText'
          | 'rotateX'
          | 'rotateY'
          | 'rotateZ'
          | 'perspective'
        >
      >,
    ) => {
      if (!activeCardId) return;
      setCards((prev) =>
        prev.map((c) => (c.id === activeCardId ? { ...c, ...patch } : c)),
      );
    },
    [activeCardId],
  );

  const resetActiveCard = useCallback(() => {
    patchActiveCard({ offsetX: 0, offsetY: 0 });
  }, [patchActiveCard]);

  // Quand on change de type de materiau, on repart des valeurs par defaut
  // (sauf au premier montage, deja gere par l'etat initial + chargement preset).
  const materialBoot = useRef(true);
  useEffect(() => {
    if (materialBoot.current) {
      materialBoot.current = false;
      return;
    }
    const fresh = defaultCardParams(material.id);
    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        params: cloneParams(fresh),
        styleId: null,
        styleName: `${material.label} V1`,
      })),
    );
    setActiveGroup(material.groups[0]?.id ?? 'matiere');
  }, [material]);

  const onReflectDrag = useCallback(
    (uv: [number, number]) => {
      setParams((prev) => setParam(prev, 'reflets', 'position', uv));
    },
    [setParams],
  );

  const onSplitDrag = useCallback((ratio: number) => {
    setSplit(ratio);
  }, []);

  const onCardOffset = useCallback(
    (id: string, offset: { offsetX: number; offsetY: number }) => {
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...offset } : c)),
      );
    },
    [],
  );

  const onActiveCard = useCallback((id: string) => {
    setActiveCardId(id);
  }, []);

  const onBgPan = useCallback((pan: [number, number]) => {
    setBgPan(pan);
  }, []);

  const onBgZoom = useCallback((zoom: number) => {
    setBgZoom(zoom);
  }, []);

  const handleLoadPreset = (id: string) => {
    const found = presets.find((p) => p.id === id);
    if (!found || !activeCardId) return;
    setCards((prev) =>
      prev.map((c) =>
        c.id === activeCardId
          ? {
              ...c,
              params: cloneParams(found.params as Params),
              styleId: found.id,
              styleName: found.name,
            }
          : c,
      ),
    );
    setStatus(`Style « ${found.name} » → ${activeCard?.name ?? 'carte'}`);
  };

  const handleSave = async () => {
    const id = activePresetId ?? (slugify(presetName) || `preset-${Date.now()}`);
    const preset: PresetFile = {
      id,
      name: presetName,
      material: material.id,
      updatedAt: new Date().toISOString(),
      params: deepClone(params),
    };
    await savePreset(preset);
    if (activeCardId) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === activeCardId ? { ...c, styleId: id, styleName: preset.name } : c,
        ),
      );
    }
    await refreshPresets();
    setStatus(`Enregistre : ${preset.name}`);
  };

  const handleDuplicate = async () => {
    const base = presetName.replace(/\s+copie.*$/i, '');
    const name = `${base} copie`;
    const id = `${slugify(name)}-${Date.now().toString(36).slice(-4)}`;
    const preset: PresetFile = {
      id,
      name,
      material: material.id,
      updatedAt: new Date().toISOString(),
      params: deepClone(params),
    };
    await savePreset(preset);
    if (activeCardId) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === activeCardId ? { ...c, styleId: id, styleName: name } : c,
        ),
      );
    }
    await refreshPresets();
    setStatus(`Duplique : ${name}`);
  };

  const handleRename = async () => {
    const name = presetName.trim();
    if (!name) {
      setStatus('Donnez un nom au preset');
      return;
    }
    setPresetName(name);
    if (!activePresetId) {
      setStatus(`Nom pret : ${name} — cliquez Enregistrer`);
      return;
    }
    const preset: PresetFile = {
      id: activePresetId,
      name,
      material: material.id,
      updatedAt: new Date().toISOString(),
      params: deepClone(params),
    };
    await savePreset(preset);
    await refreshPresets();
    setStatus(`Renomme : ${name}`);
  };

  const handleDelete = async () => {
    if (!activePresetId) {
      setStatus('Aucun preset selectionne');
      return;
    }
    if (!window.confirm(`Supprimer « ${presetName} » ?`)) return;
    const deletedId = activePresetId;
    await deletePreset(material.id, deletedId);
    const fallback = defaultCardParams(material.id);
    setCards((prev) =>
      prev.map((c) =>
        c.styleId === deletedId
          ? {
              ...c,
              params: cloneParams(fallback),
              styleId: null,
              styleName: `${material.label} V1`,
            }
          : c,
      ),
    );
    await refreshPresets();
    setStatus('Preset supprime');
  };

  const handleExport = () => {
    const payload = {
      id: activePresetId ?? slugify(presetName),
      name: presetName,
      material: material.id,
      exportedAt: new Date().toISOString(),
      params,
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${payload.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Export telecharge : ${a.download}`);
  };

  const handleUploadBackground = async (file: File) => {
    const name = await uploadBackground(file);
    await refreshBackgrounds();
    setBackground(name);
    setStatus(`Fond ajoute : ${name}`);
  };

  if (bootError) {
    return (
      <div className="boot-error">
        <h1>LANTYP Material Lab</h1>
        <p>Impossible de charger CanvasKit.</p>
        <pre>{bootError}</pre>
      </div>
    );
  }

  if (!ck) {
    return (
      <div className="boot">
        <h1>LANTYP Material Lab</h1>
        <p>Chargement de Skia…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>LANTYP</strong>
          <span>Material Lab</span>
        </div>
        <label className="material-select">
          Materiau
          <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            {MATERIALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div className="chip-row topbar-frame">
          <button
            type="button"
            className={frameMode === 'desktop' ? 'chip active' : 'chip'}
            onClick={() => handleFrameMode('desktop')}
          >
            Ordinateur
          </button>
          <button
            type="button"
            className={frameMode === 'phone' ? 'chip active' : 'chip'}
            onClick={() => handleFrameMode('phone')}
          >
            Telephone
          </button>
        </div>
        <p className="status">{status}</p>
      </header>

      <div className="workspace">
        <ParamPanel
          material={material}
          params={params}
          activeGroup={activeGroup}
          onGroupChange={setActiveGroup}
          onParamsChange={setParams}
        />

        <main className={`stage-wrap frame-${frameMode}`}>
          <div className="stage-frame">
            <Viewport
              key={`${backgroundUrl || 'no-bg'}-${frameMode}`}
              ck={ck}
              material={material}
              params={params}
              paramsB={paramsB}
              compareMode={compareMode}
              frameMode={frameMode}
              split={split}
              layerCode={layerCode}
              environment={environment}
              backgroundUrl={backgroundUrl}
              draggingReflect={draggingReflect}
              draggingBackground={draggingBackground}
              cards={cards}
              activeCardId={activeCardId}
              bgZoom={bgZoom}
              bgPan={bgPan}
              onReflectDrag={onReflectDrag}
              onSplitDrag={onSplitDrag}
              onActiveCard={onActiveCard}
              onCardOffset={onCardOffset}
              onBgPan={onBgPan}
              onBgZoom={onBgZoom}
            />
          </div>
          <p className="stage-hint">
            {material.summary}
            {' — '}
            {frameMode === 'phone'
              ? `telephone ${PHONE_FRAME.w}×${PHONE_FRAME.h}`
              : 'ordinateur'}
            {' — '}
            {cards.length} carte{cards.length > 1 ? 's' : ''}
            {activeCard
              ? ` — ${activeCard.name} ${Math.round(activeCard.width)}×${Math.round(activeCard.height)} · ${activeCard.styleName}`
              : ''}
            {' — '}
            fond {Math.round(bgZoom * 100)}%
            {draggingBackground ? ' — glisser le fond' : ''}
            {draggingReflect ? ' — mode reflet actif' : ''}
            {compareMode === 'beforeAfter' ? ' — glissez le separateur vertical' : ''}
          </p>
        </main>

        <ToolsBar
          layers={material.layers}
          layerCode={layerCode}
          onLayerChange={setLayerCode}
          compareMode={compareMode}
          onCompareMode={setCompareMode}
          frameMode={frameMode}
          onFrameMode={handleFrameMode}
          bgZoom={bgZoom}
          onBgZoom={setBgZoom}
          bgPan={bgPan}
          onBgPan={setBgPan}
          onResetBackground={resetBackgroundLayout}
          draggingBackground={draggingBackground}
          onToggleBackgroundDrag={() => {
            setDraggingBackground((v) => !v);
            setDraggingReflect(false);
          }}
          cards={cards}
          activeCardId={activeCardId}
          onSelectCard={setActiveCardId}
          onAddCard={handleAddCard}
          onRenameCard={handleRenameCard}
          onDeleteCard={handleDeleteCard}
          onPatchActiveCard={patchActiveCard}
          onResetActiveCard={resetActiveCard}
          environments={ENVIRONMENTS}
          environmentId={environmentId}
          onEnvironment={setEnvironmentId}
          backgrounds={backgrounds}
          background={background}
          onBackground={setBackground}
          onUploadBackground={(file) => {
            void handleUploadBackground(file);
          }}
          presets={presets}
          activePresetId={activePresetId}
          comparePresetId={comparePresetId}
          onLoadPreset={handleLoadPreset}
          onComparePreset={setComparePresetId}
          onSave={() => {
            void handleSave().catch((err) => setStatus(err.message));
          }}
          onDuplicate={() => {
            void handleDuplicate().catch((err) => setStatus(err.message));
          }}
          onDelete={() => {
            void handleDelete().catch((err) => setStatus(err.message));
          }}
          onRename={() => {
            void handleRename().catch((err) => setStatus(err.message));
          }}
          onExport={handleExport}
          draggingReflect={draggingReflect}
          onToggleReflectDrag={() => {
            setDraggingReflect((v) => !v);
            setDraggingBackground(false);
          }}
          presetName={presetName}
          onPresetNameChange={setPresetName}
        />
      </div>
    </div>
  );
}
