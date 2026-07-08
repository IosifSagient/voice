// Thin async wrapper around db.js — swap the backend by editing db.js, not this file.
import {
  saveNote,
  getRecentNotes,
  searchNotes,
  getNote,
  deleteNote,
  updateNote,
  setActionCalendarEvent,
  getActionItemsFiltered,
  getNotesByDateRange,
  getNotesByTag,
  getRecentNotesByDays,
  completeActionItem,
  reopenActionItem,
  deleteActionItem,
  getTasksWithDueDates,
} from "../db";
import type { Note } from "../types/note";
import type { ExtractedNote } from "./extraction";
import type { TaskWithDueDate } from "../types/tasks";

export const notesRepository = {
  create: (extraction: ExtractedNote, transcript: string): Promise<string> =>
    saveNote(extraction, transcript),
  list: (): Promise<Note[]> => getRecentNotes(),
  search: (query: string): Promise<Note[]> => searchNotes(query),
  get: (id: string): Promise<Note | null> => getNote(id),
  delete: (id: string): Promise<void> => deleteNote(id),
  save: (note: Note): Promise<void> => updateNote(note),
  setCalendarEvent: (
    actionItemId: string,
    eventId: string | null,
  ): Promise<void> => setActionCalendarEvent(actionItemId, eventId),
  getActionItems: (filter: {
    status?: string;
    dueBefore?: string;
    dueAfter?: string;
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
  deleteActionItem: (id: string): Promise<string | null> =>
    deleteActionItem(id),
  getTasksWithDueDates: (): Promise<TaskWithDueDate[]> =>
    getTasksWithDueDates(),
};
