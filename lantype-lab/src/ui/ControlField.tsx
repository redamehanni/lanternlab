import type { Control, ControlValue, Params } from '../materials/types';

type Props = {
  control: Control;
  value: ControlValue;
  onChange: (value: ControlValue) => void;
};

export function ControlField({ control, value, onChange }: Props) {
  if (control.kind === 'slider') {
    const num = typeof value === 'number' ? value : control.value;
    return (
      <label className="field">
        <div className="field-head">
          <span>{control.label}</span>
          <span className="field-value">
            {format(num, control.step)}
            {control.unit ? ` ${control.unit}` : ''}
          </span>
        </div>
        <input
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={num}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {control.hint ? <p className="field-hint">{control.hint}</p> : null}
      </label>
    );
  }

  if (control.kind === 'color') {
    const hex = typeof value === 'string' ? value : control.value;
    return (
      <label className="field field-row">
        <span>{control.label}</span>
        <input type="color" value={normalizeHex(hex)} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }

  if (control.kind === 'toggle') {
    const on = typeof value === 'boolean' ? value : control.value;
    return (
      <label className="field field-row">
        <span>{control.label}</span>
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      </label>
    );
  }

  if (control.kind === 'select') {
    const selected = typeof value === 'number' ? value : control.value;
    return (
      <label className="field">
        <div className="field-head">
          <span>{control.label}</span>
        </div>
        <select value={selected} onChange={(e) => onChange(Number(e.target.value))}>
          {control.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {control.hint ? <p className="field-hint">{control.hint}</p> : null}
      </label>
    );
  }

  if (control.kind === 'angle') {
    const deg = typeof value === 'number' ? value : control.value;
    return (
      <label className="field">
        <div className="field-head">
          <span>{control.label}</span>
          <span className="field-value">{Math.round(deg)}°</span>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={((deg % 360) + 360) % 360}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    );
  }

  if (control.kind === 'point') {
    const [x, y] = Array.isArray(value) ? (value as [number, number]) : control.value;
    return (
      <div className="field">
        <div className="field-head">
          <span>{control.label}</span>
          <span className="field-value">
            {x.toFixed(2)}, {y.toFixed(2)}
          </span>
        </div>
        <div className="point-grid">
          <label>
            X
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={x}
              onChange={(e) => onChange([Number(e.target.value), y])}
            />
          </label>
          <label>
            Y
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={y}
              onChange={(e) => onChange([x, Number(e.target.value)])}
            />
          </label>
        </div>
        {control.hint ? <p className="field-hint">{control.hint}</p> : null}
      </div>
    );
  }

  return null;
}

export function setParam(params: Params, groupId: string, key: string, value: ControlValue): Params {
  return {
    ...params,
    [groupId]: {
      ...params[groupId],
      [key]: value,
    },
  };
}

function format(n: number, step: number) {
  if (step >= 1) return String(Math.round(n));
  if (step >= 0.1) return n.toFixed(1);
  if (step >= 0.01) return n.toFixed(2);
  return n.toFixed(3);
}

function normalizeHex(hex: string) {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .slice(1)
      .split('')
      .map((c) => c + c)
      .join('')}`;
  }
  return '#ffffff';
}
