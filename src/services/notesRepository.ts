// Thin async wrapper around db.js — swap the backend by editing db.js, not this file.
import {
  saveNote,
  getRecentNotes,
  searchNotes,
  searchNotesInRange,
  getNote,
  deleteNote,
  updateNote,
  setActionCalendarEvent,
  setActionNotificationId,
  getActionItemsFiltered,
  getNotesByDateRange,
  getNotesByTag,
  getRecentNotesByDays,
  completeActionItem,
  reopenActionItem,
  deleteActionItem,
  getTasksWithDueDates,
} from "../db";
import type { Note, ReminderIds, UpdateNoteDiff } from "../types/note";
import type { ExtractedNote } from "./extraction";
import type { TaskWithDueDate } from "../types/tasks";

export const notesRepository = {
  create: (extraction: ExtractedNote, transcript: string): Promise<string> =>
    saveNote(extraction, transcript),
  list: (): Promise<Note[]> => getRecentNotes(),
  search: (terms: string | string[]): Promise<Note[]> => searchNotes(terms),
  searchInRange: (terms: string | string[], from: string, to: string): Promise<Note[]> =>
    searchNotesInRange(terms, from, to),
  get: (id: string): Promise<Note | null> => getNote(id),
  delete: (id: string): Promise<ReminderIds[]> => deleteNote(id),
  save: (note: Note): Promise<UpdateNoteDiff> => updateNote(note),
  setCalendarEvent: (
    actionItemId: string,
    eventId: string | null,
  ): Promise<void> => setActionCalendarEvent(actionItemId, eventId),
  setNotificationId: (
    actionItemId: string,
    notificationId: string | null,
  ): Promise<void> => setActionNotificationId(actionItemId, notificationId),
  getActionItems: (filter: {
    status?: string;
    dueBefore?: string;
    dueAfter?: string;
    overdue?: boolean;
    todayAthens?: string;
  }) => getActionItemsFiltered(filter),
  getNotesByDateRange: (from: string, to: string): Promise<Note[]> =>
    getNotesByDateRange(from, to),
  getNotesByTag: (
    tagType: "person" | "topic",
    value: string,
  ): Promise<Note[]> => getNotesByTag(tagType, value),
  getRecentByDays: (days: number): Promise<Note[]> =>
    getRecentNotesByDays(days),
  completeActionItem: (id: string): Promise<void> => completeActionItem(id),
  reopenActionItem: (id: string): Promise<void> => reopenActionItem(id),
  deleteActionItem: (id: string): Promise<ReminderIds | null> =>
    deleteActionItem(id),
  getTasksWithDueDates: (): Promise<TaskWithDueDate[]> =>
    getTasksWithDueDates(),
};
