"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCsrfToken } from "@/components/security/csrf";
import { useToast } from "@/components/ui/toast";
import { CSRF_FIELD } from "@/lib/security/csrf-shared";
import { FOLLOW_UP_DAYS, stageColorClass } from "@/lib/board/constants";
import { moveJobAction, addTaskQuickAction } from "@/app/(app)/jobs/actions";
import { JobCard, type BoardCard } from "@/components/board/job-card";
import { cn } from "@/lib/utils";

// B1 to B3: the Kanban board.
// - Drag by mouse, touch (long press on the handle) or keyboard (focus the
//   handle, Space to lift, arrows to move, Space to drop, Escape to cancel).
// - Every card also has a "Move to" menu, so nothing needs dragging.
// - Phones show one stage at a time with swipeable stage tabs.
// - Moves are optimistic and roll back with an error toast if the server says no.

type Stage = { id: string; name: string; color: string };
type Columns = Record<string, BoardCard[]>;

function group(stages: Stage[], cards: BoardCard[]): Columns {
  const cols: Columns = Object.fromEntries(stages.map((s) => [s.id, [] as BoardCard[]]));
  for (const c of cards) cols[c.stageId]?.push(c);
  return cols;
}

function findColumn(cols: Columns, id: string): string | null {
  if (id in cols) return id;
  for (const [stageId, list] of Object.entries(cols)) if (list.some((c) => c.id === id)) return stageId;
  return null;
}

function followUpDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + FOLLOW_UP_DAYS);
  d.setHours(9, 0, 0, 0);
  return d;
}

function MoveMenu({ card, stages, onMove }: { card: BoardCard; stages: Stage[]; onMove: (stageId: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Move {card.title} to another stage</span>
      <select
        value=""
        onChange={(e) => e.target.value && onMove(e.target.value)}
        className="min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-ground px-3 font-semibold text-text"
      >
        <option value="">Move to...</option>
        {stages
          .filter((s) => s.id !== card.stageId)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </select>
    </label>
  );
}

function SortableCard({ card, stages, onMove, disabled }: { card: BoardCard; stages: Stage[]; onMove: (card: BoardCard, stageId: string) => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled });
  const style = transform ? { transform: CSS.Transform.toString(transform), transition } : undefined;
  return (
    <li ref={setNodeRef} style={style}>
      <JobCard
        card={card}
        dragging={isDragging}
        handleProps={disabled ? undefined : { ...attributes, ...listeners, "aria-label": `Drag ${card.title}` }}
        moveMenu={<MoveMenu card={card} stages={stages} onMove={(stageId) => onMove(card, stageId)} />}
      />
    </li>
  );
}

function Column({ stage, cards, children, hiddenOnPhone }: { stage: Stage; cards: BoardCard[]; children: React.ReactNode; hiddenOnPhone: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      aria-labelledby={`stage-${stage.id}`}
      className={cn(
        "relative flex w-full shrink-0 flex-col gap-3 rounded-[var(--radius-panel)] border border-border bg-ground p-3 tab:w-72",
        hiddenOnPhone && "hidden tab:flex",
        isOver && "border-primary",
      )}
    >
      <h2 id={`stage-${stage.id}`} className="flex items-center gap-2 px-1 text-base font-bold">
        <span aria-hidden="true" className={cn("size-2.5 rounded-full", stageColorClass(stage.color))} />
        {stage.name}
        <span className="ml-auto rounded-[var(--radius-chip)] border border-border bg-surface px-2 text-sm font-semibold text-secondary">
          <span className="sr-only">Jobs: </span>
          {cards.length}
        </span>
      </h2>
      <ul ref={setNodeRef} className="flex min-h-24 flex-col gap-3">
        {children}
        {cards.length === 0 ? <li className="rounded-[var(--radius-card)] border border-dashed border-border p-4 text-center text-sm text-secondary">No jobs here yet</li> : null}
      </ul>
    </section>
  );
}

export function Board({ stages, cards, sortable }: { stages: Stage[]; cards: BoardCard[]; sortable: boolean }) {
  const router = useRouter();
  const csrf = useCsrfToken();
  const toast = useToast();
  const [columns, setColumns] = useState<Columns>(() => group(stages, cards));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [phoneStage, setPhoneStage] = useState(stages[0]?.id ?? "");
  const [, startTransition] = useTransition();
  const snapshot = useRef<Columns | null>(null);
  const dragFrom = useRef<string | null>(null);
  const touchX = useRef<number | null>(null);

  // Server data wins whenever it changes (after a save or a filter change).
  const [source, setSource] = useState(cards);
  if (source !== cards && !activeId) {
    setSource(cards);
    setColumns(group(stages, cards));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const stageName = useMemo(() => new Map(stages.map((s) => [s.id, s.name])), [stages]);
  const cardById = (id: string) => Object.values(columns).flat().find((c) => c.id === id);

  async function save(card: BoardCard, stageId: string, aboveId: string | null, belowId: string | null, opts: { undo: boolean; previous: Columns }) {
    const result = await moveJobAction({ jobId: card.id, stageId, aboveId, belowId, [CSRF_FIELD]: csrf });
    if (!result.ok || !result.move) {
      setColumns(opts.previous);
      toast({ message: result.message ?? "We couldn't move that card. Please try again.", tone: "danger" });
      return;
    }
    const move = result.move;
    if (opts.undo && move.from.stageId !== stageId) {
      toast({
        message: `Moved to ${move.stageName}.`,
        actions: [
          {
            label: "Undo",
            onClick: () =>
              startTransition(async () => {
                await moveJobAction({ jobId: card.id, stageId: move.from.stageId, aboveId: move.from.aboveId, belowId: move.from.belowId, [CSRF_FIELD]: csrf });
                router.refresh();
              }),
          },
        ],
      });
    }
    if (move.movedToApplied) {
      // G2: suggest a follow-up a week later.
      const due = followUpDate();
      toast({
        message: `Add a follow-up task for ${due.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}?`,
        duration: 15_000,
        actions: [
          {
            label: "Add",
            onClick: () =>
              startTransition(async () => {
                const r = await addTaskQuickAction({
                  jobId: card.id,
                  title: `Follow up with ${card.companyName}`,
                  kind: "FOLLOW_UP",
                  dueAt: due.toISOString(),
                  remindAt: due.toISOString(),
                  [CSRF_FIELD]: csrf,
                });
                toast({ message: r.message ?? "Done.", tone: r.ok ? "info" : "danger" });
              }),
          },
          { label: "Edit", onClick: () => router.push(`/jobs/${card.id}?tab=tasks&followup=1`) },
        ],
      });
    }
  }

  function moveTo(card: BoardCard, stageId: string) {
    const previous = columns;
    const updated = { ...card, stageId, lastActivityAt: new Date() };
    const next: Columns = { ...columns };
    for (const id of Object.keys(next)) next[id] = (next[id] ?? []).filter((c) => c.id !== card.id);
    next[stageId] = [updated, ...(next[stageId] ?? [])];
    setColumns(next);
    startTransition(() => save(card, stageId, null, null, { undo: true, previous }));
  }

  function onDragStart(e: DragStartEvent) {
    snapshot.current = columns;
    dragFrom.current = findColumn(columns, String(e.active.id));
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const from = findColumn(columns, String(active.id));
    const to = findColumn(columns, String(over.id));
    if (!from || !to || from === to) return;
    setColumns((cols) => {
      const card = cols[from]?.find((c) => c.id === active.id);
      if (!card) return cols;
      const target = cols[to] ?? [];
      const overIndex = target.findIndex((c) => c.id === over.id);
      const index = overIndex >= 0 ? overIndex : target.length;
      return {
        ...cols,
        [from]: (cols[from] ?? []).filter((c) => c.id !== active.id),
        [to]: [...target.slice(0, index), { ...card, stageId: to }, ...target.slice(index)],
      };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    const previous = snapshot.current ?? columns;
    if (!over) {
      setColumns(previous);
      return;
    }
    const to = findColumn(columns, String(active.id));
    if (!to) return;
    let list = columns[to] ?? [];
    const oldIndex = list.findIndex((c) => c.id === active.id);
    const overIndex = list.findIndex((c) => c.id === over.id);
    if (overIndex >= 0 && overIndex !== oldIndex) {
      const copy = [...list];
      const [moved] = copy.splice(oldIndex, 1);
      if (moved) copy.splice(overIndex, 0, moved);
      list = copy;
    }
    const index = list.findIndex((c) => c.id === active.id);
    const card = list[index];
    if (!card) return;
    const unchanged = dragFrom.current === to && (previous[to] ?? []).findIndex((c) => c.id === card.id) === index;
    setColumns({ ...columns, [to]: list });
    if (unchanged) return;
    startTransition(() => save(card, to, list[index - 1]?.id ?? null, list[index + 1]?.id ?? null, { undo: false, previous }));
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${cardById(String(active.id))?.title ?? "card"}.`,
    onDragOver: ({ active, over }) => (over ? `${cardById(String(active.id))?.title ?? "Card"} is over ${stageName.get(findColumn(columns, String(over.id)) ?? "") ?? "a stage"}.` : ""),
    onDragEnd: ({ active, over }) =>
      over ? `${cardById(String(active.id))?.title ?? "Card"} moved to ${stageName.get(findColumn(columns, String(active.id)) ?? "") ?? "a stage"}.` : "Move cancelled.",
    onDragCancel: () => "Move cancelled.",
  };

  const active = activeId ? cardById(activeId) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* B3: phones get one stage at a time. */}
      <div role="tablist" aria-label="Stages" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 tab:hidden">
        {stages.map((s) => (
          <button
            key={s.id}
            role="tab"
            type="button"
            aria-selected={phoneStage === s.id}
            aria-controls={`stage-${s.id}`}
            onClick={() => setPhoneStage(s.id)}
            className={cn(
              "min-h-11 shrink-0 rounded-[var(--radius-chip)] border px-4 text-sm font-semibold",
              phoneStage === s.id ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-text",
            )}
          >
            {s.name} ({columns[s.id]?.length ?? 0})
          </button>
        ))}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          if (snapshot.current) setColumns(snapshot.current);
        }}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: "To move a job, press Space or Enter, use the arrow keys, then press Space or Enter again to drop it. Press Escape to cancel. You can also use the Move to menu on each card.",
          },
        }}
      >
        <div
          className="relative flex gap-4 tab:overflow-x-auto tab:pb-4"
          onTouchStart={(e) => {
            touchX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            // Swipe left or right between stages on phones.
            const startX = touchX.current;
            touchX.current = null;
            if (startX === null || activeId) return;
            const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
            if (Math.abs(dx) < 60 || window.innerWidth >= 600) return;
            const i = stages.findIndex((s) => s.id === phoneStage);
            const next = stages[dx < 0 ? i + 1 : i - 1];
            if (next) setPhoneStage(next.id);
          }}
        >
          {stages.map((stage) => {
            const list = columns[stage.id] ?? [];
            return (
              <Column key={stage.id} stage={stage} cards={list} hiddenOnPhone={phoneStage !== stage.id}>
                <SortableContext items={list.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {list.map((card) => (
                    <SortableCard key={card.id} card={card} stages={stages} onMove={moveTo} disabled={!sortable} />
                  ))}
                </SortableContext>
              </Column>
            );
          })}
        </div>
        <DragOverlay>{active ? <JobCard card={active} /> : null}</DragOverlay>
      </DndContext>
      {!sortable ? <p className="text-sm text-secondary">Dragging is off while the board is sorted. Choose “Board order” to drag cards, or use Move to.</p> : null}
    </div>
  );
}
