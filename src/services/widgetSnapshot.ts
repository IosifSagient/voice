// Builds the lock-screen widget's data snapshot. Not wired to anything yet —
// a later increment writes it to App Group storage and reloads the widget.
import { countOpenActionItems, getOpenActionItemsForWidget } from "../db";
import type { WidgetSnapshot, WidgetTask } from "../types/widget";

export const WIDGET_TASK_LIMIT = 3;

// Pure: `rows` must already be in widget order (getOpenActionItemsForWidget's
// ORDER BY) — this only caps them, it never re-sorts.
export function buildWidgetSnapshot({
  openCount,
  rows,
  now,
}: {
  openCount: number;
  rows: WidgetTask[];
  now: number;
}): WidgetSnapshot {
  return {
    version: 1,
    generatedAt: now,
    openCount,
    tasks: rows.slice(0, WIDGET_TASK_LIMIT),
  };
}

export async function loadWidgetSnapshot({ now }: { now: number }): Promise<WidgetSnapshot> {
  const [openCount, rows] = await Promise.all([
    countOpenActionItems() as Promise<number>,
    getOpenActionItemsForWidget(WIDGET_TASK_LIMIT) as Promise<WidgetTask[]>,
  ]);
  return buildWidgetSnapshot({ openCount, rows, now });
}
