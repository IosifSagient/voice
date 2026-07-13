// db/index.js — local-first persistence for notes + action items (expo-sqlite, SDK 54 async API)
import { parseDueDate, normalizeAndDedupeNames, hydrateNote } from "./shared";
import { migrate, backfill, initDb } from "./connection";
import { saveNote, updateNote, deleteNote } from "./notesWrite";
import {
  completeActionItem,
  setActionCalendarEvent,
  setActionNotificationId,
  reopenActionItem,
  deleteActionItem,
} from "./actionItems";
import { searchNotes } from "./fts";
import { getActionItemsFiltered, getTasksWithDueDates } from "./agentQueries";
import {
  getNote,
  getRecentNotes,
  getNotesByDateRange,
  getNotesByTag,
  getRecentNotesByDays,
} from "./notesRead";

export { parseDueDate, normalizeAndDedupeNames, hydrateNote };
export { migrate, backfill, initDb };
export { saveNote, updateNote, deleteNote };
export {
  completeActionItem,
  setActionCalendarEvent,
  setActionNotificationId,
  reopenActionItem,
  deleteActionItem,
};
export { searchNotes };
export { getActionItemsFiltered, getTasksWithDueDates };
export {
  getNote,
  getRecentNotes,
  getNotesByDateRange,
  getNotesByTag,
  getRecentNotesByDays,
};
