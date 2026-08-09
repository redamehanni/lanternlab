/**
 * Champs texte de carte avec etat local pendant la frappe.
 * Evite que les re-renders Stage/params cassent la composition clavier (accents FR).
 */
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

type TextFields = {
  eyebrow: string;
  title: string;
  body: string;
};

type Props = {
  cardId: string;
  eyebrow: string;
  title: string;
  body: string;
  onChange: (patch: Partial<TextFields>) => void;
};

export function CardTextEditor({ cardId, eyebrow, title, body, onChange }: Props) {
  const [draft, setDraft] = useState<TextFields>({ eyebrow, title, body });
  const focused = useRef(false);
  const composing = useRef(false);

  useEffect(() => {
    if (focused.current || composing.current) return;
    setDraft({ eyebrow, title, body });
  }, [cardId, eyebrow, title, body]);

  const patch = (key: keyof TextFields, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (!composing.current) onChange({ [key]: value });
  };

  const bind = (key: keyof TextFields) => ({
    value: draft[key],
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      onChange({ [key]: draft[key] });
    },
    onCompositionStart: () => {
      composing.current = true;
    },
    onCompositionEnd: (e: CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      composing.current = false;
      const value = e.currentTarget.value;
      setDraft((prev) => ({ ...prev, [key]: value }));
      onChange({ [key]: value });
    },
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      patch(key, e.target.value);
    },
    onKeyDown: (e: KeyboardEvent) => {
      e.stopPropagation();
    },
    onPointerDown: (e: PointerEvent) => {
      e.stopPropagation();
    },
  });

  return (
    <>
      <h3 className="subhead">Texte de la carte</h3>
      <label className="field">
        <div className="field-head">
          <span>Sur-titre</span>
        </div>
        <input type="text" placeholder="EN COURS" {...bind('eyebrow')} />
      </label>
      <label className="field">
        <div className="field-head">
          <span>Titre</span>
        </div>
        <input type="text" placeholder="Titre de la carte" {...bind('title')} />
      </label>
      <label className="field">
        <div className="field-head">
          <span>Corps</span>
        </div>
        <textarea
          className="card-text-editor"
          rows={4}
          placeholder="Texte / citation…"
          {...bind('body')}
        />
      </label>
    </>
  );
}
