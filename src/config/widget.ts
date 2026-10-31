import { isDevVariant } from "./shareLink";

// Must match the App Group in app.config.js, which the widget target inherits.
export const WIDGET_APP_GROUP = isDevVariant()
  ? "group.com.iosifsagient.heylisa.dev"
  : "group.com.iosifsagient.heylisa";

// Must match TasksWidget.kind in targets/widget/TasksWidget.swift.
export const WIDGET_KIND = "TasksWidget";

// Must match WidgetConfig.snapshotKey in targets/widget/WidgetSnapshot.swift.
export const WIDGET_SNAPSHOT_KEY = "widgetSnapshot";
