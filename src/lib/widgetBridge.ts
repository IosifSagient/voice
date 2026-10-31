import type { ExtensionStorage } from "@bacons/apple-targets";
import {
  WIDGET_APP_GROUP,
  WIDGET_KIND,
  WIDGET_SNAPSHOT_KEY,
} from "../config/widget";

// Required lazily: the package reads a bare `expo` global on load, which throws
// where that global doesn't exist. Where it does exist but the native module
// doesn't (non-iOS, a binary without the widget), the package no-ops by itself.
function loadExtensionStorage(): typeof ExtensionStorage | null {
  try {
    return require("@bacons/apple-targets").ExtensionStorage;
  } catch {
    return null;
  }
}

export function writeSnapshotString(json: string): void {
  try {
    const Storage = loadExtensionStorage();
    if (Storage) new Storage(WIDGET_APP_GROUP).set(WIDGET_SNAPSHOT_KEY, json);
  } catch (err) {
    console.error("[widgetBridge:writeSnapshotString] write failed", err);
  }
}

export function reloadTasksWidget(): void {
  try {
    loadExtensionStorage()?.reloadWidget(WIDGET_KIND);
  } catch (err) {
    console.error("[widgetBridge:reloadTasksWidget] reload failed", err);
  }
}
