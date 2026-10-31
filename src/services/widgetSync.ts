// Keeps the lock-screen widget's App Group snapshot current. Fire-and-forget:
// nothing here throws or rejects into a caller.
import { reloadTasksWidget, writeSnapshotString } from "../lib/widgetBridge";
import { buildWidgetSnapshot, loadWidgetSnapshot } from "./widgetSnapshot";

const SYNC_DEBOUNCE_MS = 300;

let timer: ReturnType<typeof setTimeout> | null = null;
// Bumped by every sync and clear, so a slow load that was overtaken drops its
// result: it can't overwrite newer data or refill a widget cleared at sign-out.
let generation = 0;

async function runSync(): Promise<void> {
  timer = null;
  const current = ++generation;
  try {
    const snapshot = await loadWidgetSnapshot({ now: Date.now() });
    if (current !== generation) return;
    writeSnapshotString(JSON.stringify(snapshot));
    reloadTasksWidget();
  } catch (err) {
    console.error("[widgetSync:runSync] sync failed", err);
  }
}

export function scheduleWidgetSync(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(runSync, SYNC_DEBOUNCE_MS);
}

export function clearWidget(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  generation++;
  const empty = buildWidgetSnapshot({ openCount: 0, rows: [], now: Date.now() });
  writeSnapshotString(JSON.stringify(empty));
  reloadTasksWidget();
}
