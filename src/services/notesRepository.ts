// Thin async wrapper around db.js — swap the backend by editing db.js, not this file.
import {
  getRecentNotes,
  searchNotes,
  getNote,
  deleteNote,
  updateNote,
  setActionCalendarEvent,
} from '../db';
import type { Note } from '../types/note';

export const notesRepository = {
  list: (): Promise<Note[]> => getRecentNotes(),
  search: (query: string): Promise<Note[]> => searchNotes(query),
  get: (id: string): Promise<Note | null> => getNote(id),
  delete: (id: string): Promise<void> => deleteNote(id),
  save: (note: Note): Promise<void> => updateNote(note),
  setCalendarEvent: (actionItemId: string, eventId: string | null): Promise<void> =>
    setActionCalendarEvent(actionItemId, eventId),
};
