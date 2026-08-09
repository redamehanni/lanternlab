import type { MaterialModule, Params } from '../materials/types';
import { ControlField, setParam } from './ControlField';

type Props = {
  material: MaterialModule;
  params: Params;
  activeGroup: string;
  onGroupChange: (id: string) => void;
  onParamsChange: (next: Params) => void;
};

export function ParamPanel({
  material,
  params,
  activeGroup,
  onGroupChange,
  onParamsChange,
}: Props) {
  const group = material.groups.find((g) => g.id === activeGroup) ?? material.groups[0];

  return (
    <aside className="panel param-panel">
      <div className="tabs">
        {material.groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={g.id === group.id ? 'tab active' : 'tab'}
            onClick={() => onGroupChange(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="panel-body">
        <h2>{group.label}</h2>
        {group.controls.map((control) => (
          <ControlField
            key={`${group.id}.${control.key}`}
            control={control}
            value={params[group.id]?.[control.key] ?? control.value}
            onChange={(value) => onParamsChange(setParam(params, group.id, control.key, value))}
          />
        ))}
      </div>
    </aside>
  );
}
