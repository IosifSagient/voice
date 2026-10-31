// One open action item as the iOS lock-screen widget renders it. The widget
// owns all labels/relative-date formatting — this carries raw values only.
export type WidgetTask = {
  id: string; // action_items.id is TEXT (uuid)
  text: string;
  shortTitle: string | null; // preferred display text; null falls back to `text`
  dueDate: string | null; // 'YYYY-MM-DD', same UTC-midnight → toISOString().slice(0,10) conversion as db/agentQueries.js
  dueTime: string | null; // 'HH:MM' local, as stored
  allDay: boolean;
};

// The JSON payload the app will hand to the widget via App Group storage.
// `version` lets the Swift decoder reject a shape it doesn't understand.
export type WidgetSnapshot = {
  version: 1;
  generatedAt: number; // epoch ms
  openCount: number; // all open tasks, dated and undated
  tasks: WidgetTask[]; // at most WIDGET_TASK_LIMIT, earliest due first, undated last
};
