import { useState, useRef } from "react";

export function clampWidth(raw: number): { width: number; iconOnly: boolean } {
  if (raw < 80) return { width: 48, iconOnly: true };
  return { width: Math.min(300, Math.max(120, raw)), iconOnly: false };
}

interface UseSidebarResizeOpts {
  initialWidth: number;
  initialIconOnly: boolean;
  onWidthChange: (width: number, iconOnly: boolean) => void;
  onWidthCommit: (width: number, iconOnly: boolean) => void;
}

interface HandleProps {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

interface UseSidebarResizeResult {
  width: number;
  iconOnly: boolean;
  isDragging: boolean;
  handleProps: HandleProps;
}

export function useSidebarResize(opts: UseSidebarResizeOpts): UseSidebarResizeResult {
  const { initialWidth, initialIconOnly, onWidthChange, onWidthCommit } = opts;

  const [width, setWidth] = useState(initialWidth);
  const [iconOnly, setIconOnly] = useState(initialIconOnly);
  const [isDragging, setIsDragging] = useState(false);

  const isDraggingRef = useRef(false);
  const finalStateRef = useRef({ width: initialWidth, iconOnly: initialIconOnly });

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;
    const clamped = clampWidth(e.clientX);
    setWidth(clamped.width);
    setIconOnly(clamped.iconOnly);
    finalStateRef.current = clamped;
    onWidthChange(clamped.width, clamped.iconOnly);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDraggingRef.current = false;
    setIsDragging(false);
    const { width: w, iconOnly: io } = finalStateRef.current;
    onWidthCommit(w, io);
  }

  return {
    width,
    iconOnly,
    isDragging,
    handleProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
  };
}
