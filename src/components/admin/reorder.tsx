import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GripVertical, Loader2, CheckCircle2 } from 'lucide-react';

// Drag-to-reorder for the admin panels, shared so every list behaves the same.
//
// Dragging uses pointer events rather than the HTML5 drag-and-drop API, so one
// implementation covers mouse, pen and touch (the console gets used from a
// phone). Every handle is paired with up/down arrow buttons: they are the
// keyboard route, and the easy way to move something a long way on a small
// screen.
//
// A move is applied to the screen at once and then saved as the full new order
// of the list; if the save fails the list snaps back and the panel's error
// banner says why. Only one save runs at a time, so the order on screen is
// never ahead of more than a single unconfirmed change.

type AuthedFetch = (url: string, options?: RequestInit) => Promise<Response>;

/** PUTs the full new order of a list and returns the list as the server now holds it. */
export async function putOrder<T>(
  authedFetch: AuthedFetch,
  url: string,
  ids: string[],
  responseKey: string,
  onSessionExpired: () => void
): Promise<T[]> {
  const res = await authedFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });
  if (res.status === 401) {
    onSessionExpired();
    throw new Error('Your session expired. Please log in again.');
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Could not save the new order.');
  return data[responseKey] as T[];
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export interface ReorderApi {
  /** False when the list is empty, has a single item, or reordering is switched off. */
  enabled: boolean;
  saving: boolean;
  saved: boolean;
  handleProps: (id: string) => React.HTMLAttributes<HTMLElement>;
  moveBy: (id: string, delta: -1 | 1) => void;
}

interface UseReorderOptions<T extends { id: string }> {
  items: T[] | null;
  /** Applies a new order to the panel's state. Panels whose rows carry their own order number renumber it here. */
  setItems: (items: T[]) => void;
  /** Persists the new order; may resolve with the list as the server now holds it. */
  save: (ids: string[]) => Promise<T[] | void>;
  onError: (message: string) => void;
  disabled?: boolean;
}

export function useReorder<T extends { id: string }>({ items, setItems, save, onError, disabled }: UseReorderOptions<T>) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [drag, setDrag] = useState<{ id: string; overId: string } | null>(null);

  const busy = useRef(false);
  const dragRef = useRef<{ id: string; overId: string } | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const savedTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  const enabled = !disabled && !!items && items.length > 1;

  const commit = async (next: T[]) => {
    const previous = itemsRef.current;
    if (!previous || busy.current) return;
    busy.current = true;
    setSaving(true);
    setSaved(false);
    setItems(next);
    try {
      const fromServer = await save(next.map((item) => item.id));
      if (fromServer) setItems(fromServer);
      setSaved(true);
      window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setItems(previous);
      onError(err?.message || 'Could not save the new order. Please try again.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const moveBy = (id: string, delta: -1 | 1) => {
    const list = itemsRef.current;
    if (!list || !enabled) return;
    const from = list.findIndex((item) => item.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    commit(moveItem(list, from, to));
  };

  const overIdAt = (x: number, y: number): string | null => {
    const id = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-reorder-id]')?.dataset.reorderId;
    return id && itemsRef.current?.some((item) => item.id === id) ? id : null;
  };

  const refreshOver = (x: number, y: number) => {
    const current = dragRef.current;
    if (!current) return;
    const overId = overIdAt(x, y);
    if (overId && overId !== current.overId) {
      dragRef.current = { ...current, overId };
      setDrag(dragRef.current);
    }
  };

  const stopDrag = () => {
    dragRef.current = null;
    setDrag(null);
  };

  const handleProps = (id: string): React.HTMLAttributes<HTMLElement> => ({
    onPointerDown: (e) => {
      if (!enabled || busy.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      pointer.current = { x: e.clientX, y: e.clientY };
      dragRef.current = { id, overId: id };
      setDrag(dragRef.current);
    },
    onPointerMove: (e) => {
      if (!dragRef.current) return;
      pointer.current = { x: e.clientX, y: e.clientY };
      refreshOver(e.clientX, e.clientY);
    },
    onPointerUp: (e) => {
      const current = dragRef.current;
      stopDrag();
      const list = itemsRef.current;
      if (!current || !list) return;
      const overId = overIdAt(e.clientX, e.clientY) ?? current.overId;
      const from = list.findIndex((item) => item.id === current.id);
      const to = list.findIndex((item) => item.id === overId);
      if (from >= 0 && to >= 0 && from !== to) commit(moveItem(list, from, to));
    },
    onPointerCancel: stopDrag,
    onContextMenu: (e) => e.preventDefault()
  });

  // While a drag is in progress: Escape abandons it, and holding the pointer
  // near the top or bottom edge of the window scrolls the page so a long list
  // can be dragged past what's on screen.
  useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') stopDrag(); };
    const scroller = window.setInterval(() => {
      const edge = 72;
      const { x, y } = pointer.current;
      const fromBottom = window.innerHeight - y;
      if (y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 4));
      else if (fromBottom < edge) window.scrollBy(0, Math.ceil((edge - fromBottom) / 4));
      else return;
      refreshOver(x, y);
    }, 16);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearInterval(scroller);
      window.removeEventListener('keydown', onKey);
    };
  }, [drag?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Spread onto a list row: marks it as a drop target and styles it while it is dragged or targeted. */
  const itemProps = (id: string, baseClass: string) => {
    const state = !drag ? '' : drag.id === id ? 'opacity-50' : drag.overId === id ? 'ring-2 ring-brand-500 ring-offset-2' : '';
    return { 'data-reorder-id': id, className: `${baseClass} transition-shadow ${state}`.trim() };
  };

  return { enabled, saving, saved, handleProps, moveBy, itemProps };
}

// Roomier tap targets on small screens, compact from `sm` up where there's a mouse.
const arrowClass = 'p-1 sm:p-0.5 rounded text-slate-400 hover:text-brand-800 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400';
const gripClass = 'p-1 sm:p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-grab active:cursor-grabbing touch-none';

/** Grip handle plus move-up/down (or left/right) buttons for one row. Renders nothing when the list can't be reordered. */
export const ReorderControls: React.FC<{
  id: string;
  label: string;
  index: number;
  count: number;
  reorder: ReorderApi;
  /** `vertical` for stacked rows, `horizontal` for cards laid out in a grid. */
  direction?: 'vertical' | 'horizontal';
  className?: string;
}> = ({ id, label, index, count, reorder, direction = 'vertical', className = '' }) => {
  if (!reorder.enabled) return null;

  const horizontal = direction === 'horizontal';
  const Back = horizontal ? ChevronLeft : ChevronUp;
  const Forward = horizontal ? ChevronRight : ChevronDown;

  return (
    <div className={`flex items-center shrink-0 ${horizontal ? 'flex-row' : 'flex-col'} ${className}`.trim()}>
      <button
        type="button"
        onClick={() => reorder.moveBy(id, -1)}
        disabled={index === 0 || reorder.saving}
        className={arrowClass}
        aria-label={`Move ${label} ${horizontal ? 'earlier' : 'up'}`}
        title={horizontal ? 'Move earlier' : 'Move up'}
      >
        <Back className="w-4 h-4" />
      </button>
      <button
        type="button"
        {...reorder.handleProps(id)}
        disabled={reorder.saving}
        className={gripClass}
        aria-label={`Drag to reorder ${label}`}
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => reorder.moveBy(id, 1)}
        disabled={index === count - 1 || reorder.saving}
        className={arrowClass}
        aria-label={`Move ${label} ${horizontal ? 'later' : 'down'}`}
        title={horizontal ? 'Move later' : 'Move down'}
      >
        <Forward className="w-4 h-4" />
      </button>
    </div>
  );
};

/** One-line explainer above a reorderable list, doubling as the "saving / saved" indicator. */
export const ReorderHint: React.FC<{ reorder: ReorderApi; note?: string }> = ({ reorder, note }) => {
  if (!reorder.enabled) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500" aria-live="polite">
      <GripVertical className="w-3.5 h-3.5 shrink-0" />
      <span>Drag the handle, or use the arrows, to rearrange — the public site follows this order.{note ? ` ${note}` : ''}</span>
      {reorder.saving && <span className="inline-flex items-center gap-1 text-slate-600 font-semibold"><Loader2 className="w-3 h-3 animate-spin" />Saving order…</span>}
      {!reorder.saving && reorder.saved && <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 className="w-3 h-3" />Order saved</span>}
    </p>
  );
};
