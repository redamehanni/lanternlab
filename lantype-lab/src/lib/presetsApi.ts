/** Client HTTP vers le plugin Vite /__lab (ecriture disque des presets et fonds). */

export type PresetFile = {
  id: string;
  name: string;
  material: string;
  updatedAt: string;
  params: Record<string, Record<string, unknown>>;
};

export async function listPresets(material: string): Promise<PresetFile[]> {
  const res = await fetch(`/__lab/presets/${material}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.presets as PresetFile[];
}

export async function savePreset(preset: PresetFile): Promise<void> {
  const res = await fetch(`/__lab/presets/${preset.material}/${preset.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deletePreset(material: string, id: string): Promise<void> {
  const res = await fetch(`/__lab/presets/${material}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

export async function listBackgrounds(): Promise<string[]> {
  const res = await fetch('/__lab/backgrounds');
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.backgrounds as string[];
}

export async function uploadBackground(file: File): Promise<string> {
  const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  const res = await fetch(`/__lab/backgrounds/${safe}`, {
    method: 'POST',
    body: await file.arrayBuffer(),
  });
  if (!res.ok) throw new Error(await res.text());
  return safe;
}
