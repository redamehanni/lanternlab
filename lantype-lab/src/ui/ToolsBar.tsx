import type { LayerDef } from '../materials/types';
import type { CompareMode, FrameMode, LabCard } from '../engine/Stage';
import {
  PERSPECTIVE_PRESETS,
  type PerspectivePresetId,
} from '../engine/cardPerspective';
import type { LightEnvironment } from '../lighting/environments';
import type { PresetFile } from '../lib/presetsApi';
import { CardTextEditor } from './CardTextEditor';

type CardPatch = Partial<
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
>;

/** Points logiques iPhone (proche iPhone 14/15/16 Pro). */
export const PHONE_FRAME = { w: 393, h: 852 } as const;

type Props = {
  layers: LayerDef[];
  layerCode: number;
  onLayerChange: (code: number) => void;
  compareMode: CompareMode;
  onCompareMode: (mode: CompareMode) => void;
  frameMode: FrameMode;
  onFrameMode: (mode: FrameMode) => void;
  bgZoom: number;
  onBgZoom: (zoom: number) => void;
  bgPan: [number, number];
  onBgPan: (pan: [number, number]) => void;
  onResetBackground: () => void;
  draggingBackground: boolean;
  onToggleBackgroundDrag: () => void;
  cards: LabCard[];
  activeCardId: string | null;
  onSelectCard: (id: string) => void;
  onAddCard: () => void;
  onRenameCard: () => void;
  onDeleteCard: () => void;
  onPatchActiveCard: (patch: CardPatch) => void;
  onResetActiveCard: () => void;
  environments: LightEnvironment[];
  environmentId: string;
  onEnvironment: (id: string) => void;
  backgrounds: string[];
  background: string | null;
  onBackground: (name: string | null) => void;
  onUploadBackground: (file: File) => void;
  presets: PresetFile[];
  activePresetId: string | null;
  comparePresetId: string | null;
  onLoadPreset: (id: string) => void;
  onComparePreset: (id: string | null) => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRename: () => void;
  onExport: () => void;
  draggingReflect: boolean;
  onToggleReflectDrag: () => void;
  presetName: string;
  onPresetNameChange: (name: string) => void;
};

export function ToolsBar({
  layers,
  layerCode,
  onLayerChange,
  compareMode,
  onCompareMode,
  frameMode,
  onFrameMode,
  bgZoom,
  onBgZoom,
  bgPan,
  onBgPan,
  onResetBackground,
  draggingBackground,
  onToggleBackgroundDrag,
  cards,
  activeCardId,
  onSelectCard,
  onAddCard,
  onRenameCard,
  onDeleteCard,
  onPatchActiveCard,
  onResetActiveCard,
  environments,
  environmentId,
  onEnvironment,
  backgrounds,
  background,
  onBackground,
  onUploadBackground,
  presets,
  activePresetId,
  comparePresetId,
  onLoadPreset,
  onComparePreset,
  onSave,
  onDuplicate,
  onDelete,
  onRename,
  onExport,
  draggingReflect,
  onToggleReflectDrag,
  presetName,
  onPresetNameChange,
}: Props) {
  const active = cards.find((c) => c.id === activeCardId) ?? cards[0] ?? null;

  return (
    <aside className="panel tools-panel">
      <section>
        <h2>Simulateur</h2>
        <div className="chip-row">
          <button
            type="button"
            className={frameMode === 'desktop' ? 'chip active' : 'chip'}
            onClick={() => onFrameMode('desktop')}
          >
            Ordinateur
          </button>
          <button
            type="button"
            className={frameMode === 'phone' ? 'chip active' : 'chip'}
            onClick={() => onFrameMode('phone')}
          >
            Telephone
          </button>
        </div>
        <p className="field-hint">
          {frameMode === 'phone'
            ? `Cadre ${PHONE_FRAME.w}×${PHONE_FRAME.h} — meme ratio / cover que l’app iOS.`
            : 'Panneau plein — pratique pour inspecter les couches.'}
        </p>

        <h3 className="subhead">Fond derriere le cadre</h3>
        <label className="field">
          <div className="field-head">
            <span>Zoom fond</span>
            <span>{Math.round(bgZoom * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.35}
            max={2.5}
            step={0.01}
            value={bgZoom}
            onChange={(e) => onBgZoom(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <div className="field-head">
            <span>Fond X</span>
            <span>{Math.round(bgPan[0])}px</span>
          </div>
          <input
            type="range"
            min={-500}
            max={500}
            step={1}
            value={bgPan[0]}
            onChange={(e) => onBgPan([Number(e.target.value), bgPan[1]])}
          />
        </label>
        <label className="field">
          <div className="field-head">
            <span>Fond Y</span>
            <span>{Math.round(bgPan[1])}px</span>
          </div>
          <input
            type="range"
            min={-500}
            max={500}
            step={1}
            value={bgPan[1]}
            onChange={(e) => onBgPan([bgPan[0], Number(e.target.value)])}
          />
        </label>
        <div className="chip-row">
          <button
            type="button"
            className={draggingBackground ? 'chip active' : 'chip'}
            onClick={onToggleBackgroundDrag}
          >
            Glisser le fond
          </button>
          <button type="button" className="chip" onClick={onResetBackground}>
            Reset fond
          </button>
        </div>
        <p className="field-hint">Molette = zoom. « Glisser le fond » puis drag dans le cadre.</p>

        <h3 className="subhead">Cartes verre</h3>
        <div className="chip-row">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={card.id === activeCardId ? 'chip active' : 'chip'}
              onClick={() => onSelectCard(card.id)}
              title={card.styleName || 'Style libre'}
            >
              {card.name}
            </button>
          ))}
        </div>
        {active ? (
          <p className="field-hint" style={{ marginTop: 6 }}>
            Style de « {active.name} » : {active.styleName || 'Style libre'}
          </p>
        ) : null}
        <div className="btn-row">
          <button type="button" onClick={onAddCard}>
            + Ajouter
          </button>
          <button type="button" onClick={onRenameCard} disabled={!active}>
            Renommer
          </button>
          <button type="button" className="danger" onClick={onDeleteCard} disabled={!active || cards.length <= 1}>
            Supprimer
          </button>
        </div>

        {active ? (
          <>
            <label className="field" style={{ marginTop: 10 }}>
              <div className="field-head">
                <span>Nom de la carte</span>
              </div>
              <input
                type="text"
                value={active.name}
                placeholder="Nom de la carte"
                onChange={(e) => onPatchActiveCard({ name: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              />
            </label>
            <label className="field">
              <div className="field-head">
                <span>Largeur</span>
                <span>{Math.round(active.width)}px</span>
              </div>
              <input
                type="range"
                min={120}
                max={420}
                step={1}
                value={active.width}
                onChange={(e) => onPatchActiveCard({ width: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <div className="field-head">
                <span>Hauteur</span>
                <span>{Math.round(active.height)}px</span>
              </div>
              <input
                type="range"
                min={80}
                max={320}
                step={1}
                value={active.height}
                onChange={(e) => onPatchActiveCard({ height: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <div className="field-head">
                <span>Position X</span>
                <span>{Math.round(active.offsetX)}px</span>
              </div>
              <input
                type="range"
                min={-400}
                max={400}
                step={1}
                value={active.offsetX}
                onChange={(e) => onPatchActiveCard({ offsetX: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <div className="field-head">
                <span>Position Y</span>
                <span>{Math.round(active.offsetY)}px</span>
              </div>
              <input
                type="range"
                min={-500}
                max={500}
                step={1}
                value={active.offsetY}
                onChange={(e) => onPatchActiveCard({ offsetY: Number(e.target.value) })}
              />
            </label>
            <div className="chip-row">
              <button type="button" className="chip" onClick={onResetActiveCard}>
                Recentrer
              </button>
              <button
                type="button"
                className={active.showText !== false ? 'chip active' : 'chip'}
                onClick={() => onPatchActiveCard({ showText: !active.showText })}
              >
                Afficher texte
              </button>
            </div>

            <h3 className="subhead">Perspective 3/4</h3>
            <div className="chip-row">
              {(Object.keys(PERSPECTIVE_PRESETS) as PerspectivePresetId[]).map((id) => {
                const preset = PERSPECTIVE_PRESETS[id];
                const v = preset.values;
                const activePreset =
                  Math.round(active.rotateX ?? 0) === v.rotateX &&
                  Math.round(active.rotateY ?? 0) === v.rotateY &&
                  Math.round(active.rotateZ ?? 0) === v.rotateZ;
                return (
                  <button
                    key={id}
                    type="button"
                    className={activePreset ? 'chip active' : 'chip'}
                    onClick={() => onPatchActiveCard({ ...v })}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <label className="field">
              <div className="field-head">
                <span>Pivot Y (3/4)</span>
                <span>{Math.round(active.rotateY ?? 0)}°</span>
              </div>
              <input
                type="range"
                min={-55}
                max={55}
                step={1}
                value={active.rotateY ?? 0}
                onChange={(e) => onPatchActiveCard({ rotateY: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <div className="field-head">
                <span>Pivot X (plongée)</span>
                <span>{Math.round(active.rotateX ?? 0)}°</span>
              </div>
              <input
                type="range"
                min={-40}
                max={40}
                step={1}
                value={active.rotateX ?? 0}
                onChange={(e) => onPatchActiveCard({ rotateX: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <div className="field-head">
                <span>Roullis Z</span>
                <span>{Math.round(active.rotateZ ?? 0)}°</span>
              </div>
              <input
                type="range"
                min={-25}
                max={25}
                step={1}
                value={active.rotateZ ?? 0}
                onChange={(e) => onPatchActiveCard({ rotateZ: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <div className="field-head">
                <span>Profondeur</span>
                <span>{Math.round(active.perspective ?? 1200)}</span>
              </div>
              <input
                type="range"
                min={500}
                max={2200}
                step={20}
                value={active.perspective ?? 1200}
                onChange={(e) => onPatchActiveCard({ perspective: Number(e.target.value) })}
              />
            </label>
            <p className="field-hint">
              Incline la carte comme une plaque de verre flottante (simulation labo).
            </p>

            <CardTextEditor
              cardId={active.id}
              eyebrow={active.eyebrow ?? ''}
              title={active.title ?? ''}
              body={active.body ?? ''}
              onChange={(patch) => onPatchActiveCard({ ...patch, showText: true })}
            />
            <p className="field-hint">Glissez la carte (ou son point) dans le cadre pour la deplacer.</p>
          </>
        ) : null}
      </section>

      <section>
        <h2>Inspect</h2>
        <div className="chip-row">
          {layers.map((layer) => (
            <button
              key={layer.id}
              type="button"
              className={layer.code === layerCode ? 'chip active' : 'chip'}
              onClick={() => onLayerChange(layer.code)}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Comparaison</h2>
        <div className="chip-row">
          {(
            [
              ['single', 'Simple'],
              ['ab', 'A / B'],
              ['beforeAfter', 'Before / After'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={compareMode === mode ? 'chip active' : 'chip'}
              onClick={() => onCompareMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        {compareMode !== 'single' ? (
          <label className="field">
            <div className="field-head">
              <span>Preset B</span>
            </div>
            <select
              value={comparePresetId ?? ''}
              onChange={(e) => onComparePreset(e.target.value || null)}
            >
              <option value="">— choisir —</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section>
        <h2>Eclairage</h2>
        <div className="chip-row">
          {environments.map((env) => (
            <button
              key={env.id}
              type="button"
              className={env.id === environmentId ? 'chip active' : 'chip'}
              onClick={() => onEnvironment(env.id)}
            >
              {env.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Fonds</h2>
        <div className="chip-row">
          <button
            type="button"
            className={!background ? 'chip active' : 'chip'}
            onClick={() => onBackground(null)}
          >
            Aucun
          </button>
          {backgrounds.map((name) => (
            <button
              key={name}
              type="button"
              className={background === name ? 'chip active' : 'chip'}
              onClick={() => onBackground(name)}
            >
              {prettyName(name)}
            </button>
          ))}
        </div>
        <label className="upload">
          Ajouter un fond
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadBackground(file);
              e.target.value = '';
            }}
          />
        </label>
      </section>

      <section>
        <h2>Presets</h2>
        <p className="field-hint">
          Le style choisi s&apos;applique a la carte active uniquement — chaque
          carte peut avoir un preset different.
        </p>
        <label className="field">
          <div className="field-head">
            <span>Nom du preset</span>
          </div>
          <input
            type="text"
            value={presetName}
            placeholder="Nom du preset"
            onChange={(e) => onPresetNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onRename();
              }
            }}
          />
        </label>
        <div className="chip-row">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={p.id === activePresetId ? 'chip active' : 'chip'}
              onClick={() => onLoadPreset(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="btn-row">
          <button type="button" onClick={onSave}>
            Enregistrer
          </button>
          <button type="button" onClick={onDuplicate}>
            Dupliquer
          </button>
          <button type="button" onClick={onRename}>
            Appliquer le nom
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            Supprimer
          </button>
        </div>
        <button type="button" className="export" onClick={onExport}>
          Exporter JSON
        </button>
      </section>

      <section>
        <h2>Outils</h2>
        <div className="chip-row">
          <button
            type="button"
            className={draggingReflect ? 'chip active' : 'chip'}
            onClick={onToggleReflectDrag}
          >
            Deplacer le reflet
          </button>
        </div>
        <p className="field-hint">
          Cliquez une carte pour la selectionner. Glissez-la pour bouger le fond a travers le verre.
        </p>
      </section>
    </aside>
  );
}

function prettyName(file: string) {
  return file.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
}
