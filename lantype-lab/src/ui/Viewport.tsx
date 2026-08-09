import { useEffect, useRef } from 'react';
import type { LightEnvironment } from '../lighting/environments';
import type { MaterialModule, Params } from '../materials/types';
import { Stage, type CompareMode, type FrameMode, type LabCard } from '../engine/Stage';
import type { CanvasKit } from '../engine/canvaskit';

type Props = {
  ck: CanvasKit;
  material: MaterialModule;
  params: Params;
  paramsB: Params | null;
  compareMode: CompareMode;
  frameMode: FrameMode;
  split: number;
  layerCode: number;
  environment: LightEnvironment;
  backgroundUrl: string | null;
  draggingReflect: boolean;
  draggingBackground: boolean;
  cards: LabCard[];
  activeCardId: string | null;
  bgZoom: number;
  bgPan: [number, number];
  onReflectDrag: (uv: [number, number]) => void;
  onSplitDrag: (ratio: number) => void;
  onActiveCard: (id: string) => void;
  onCardOffset: (id: string, offset: { offsetX: number; offsetY: number }) => void;
  onBgPan: (pan: [number, number]) => void;
  onBgZoom: (zoom: number) => void;
};

export function Viewport({
  ck,
  material,
  params,
  paramsB,
  compareMode,
  frameMode,
  split,
  layerCode,
  environment,
  backgroundUrl,
  draggingReflect,
  draggingBackground,
  cards,
  activeCardId,
  bgZoom,
  bgPan,
  onReflectDrag,
  onSplitDrag,
  onActiveCard,
  onCardOffset,
  onBgPan,
  onBgZoom,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const stage = new Stage(
      ck,
      canvas,
      {
        material,
        params,
        paramsB,
        compareMode,
        frameMode,
        split,
        layerCode,
        environment,
        draggingReflect,
        draggingBackground,
        cards,
        activeCardId,
        bgZoom,
        bgPan,
      },
      { onReflectDrag, onSplitDrag, onActiveCard, onCardOffset, onBgPan, onBgZoom },
    );
    stageRef.current = stage;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      stage.resize(width, height);
    });
    ro.observe(wrap);
    stage.resize(wrap.clientWidth, wrap.clientHeight);

    return () => {
      ro.disconnect();
      stage.destroy();
      stageRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ck]);

  useEffect(() => {
    stageRef.current?.setConfig({
      material,
      params,
      paramsB,
      compareMode,
      frameMode,
      split,
      layerCode,
      environment,
      draggingReflect,
      draggingBackground,
      cards,
      activeCardId,
      bgZoom,
      bgPan,
    });
  }, [
    material,
    params,
    paramsB,
    compareMode,
    frameMode,
    split,
    layerCode,
    environment,
    draggingReflect,
    draggingBackground,
    cards,
    activeCardId,
    bgZoom,
    bgPan,
  ]);

  useEffect(() => {
    stageRef.current?.setCallbacks({
      onReflectDrag,
      onSplitDrag,
      onActiveCard,
      onCardOffset,
      onBgPan,
      onBgZoom,
    });
  }, [onReflectDrag, onSplitDrag, onActiveCard, onCardOffset, onBgPan, onBgZoom]);

  useEffect(() => {
    void stageRef.current?.setBackground(backgroundUrl);
  }, [backgroundUrl]);

  return (
    <div className={`viewport frame-${frameMode}`} ref={wrapRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}
