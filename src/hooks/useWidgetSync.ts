import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { clearWidget, scheduleWidgetSync } from '../services/widgetSync';

// Launch, sign-in, foreground and sign-out refreshes for the lock-screen widget.
// getDb() already gives every caller the migrated DB, so a sync can't run early.
export function useWidgetSync(sessionExists: boolean) {
  const hadSession = useRef(false);

  // Keyed on the session ending rather than on the sign-out button, so a failed
  // sign-out keeps the widget and a server-side sign-out still clears it. A cold
  // start with no session never clears: that can be a slow-network auth timeout.
  useEffect(() => {
    if (sessionExists) {
      hadSession.current = true;
      scheduleWidgetSync();
    } else if (hadSession.current) {
      hadSession.current = false;
      clearWidget();
    }
  }, [sessionExists]);

  // Only after a real background: Face ID and Notification Center go
  // active → inactive → active without leaving the app.
  useEffect(() => {
    if (!sessionExists) return;
    let wentToBackground = false;
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        wentToBackground = true;
      } else if (nextState === 'active' && wentToBackground) {
        wentToBackground = false;
        scheduleWidgetSync();
      }
    });
    return () => sub.remove();
  }, [sessionExists]);
}
