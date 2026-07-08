import * as SecureStore from 'expo-secure-store';
import { clearCachedCalendarId } from './calendar';

const PREF_KEY = 'preferred_calendar_id';

export async function getPreferredCalendarId(): Promise<string | null> {
  return SecureStore.getItemAsync(PREF_KEY);
}

export async function setPreferredCalendarId(id: string | null): Promise<void> {
  if (id) {
    await SecureStore.setItemAsync(PREF_KEY, id);
  } else {
    await SecureStore.deleteItemAsync(PREF_KEY);
  }
  clearCachedCalendarId();
}
