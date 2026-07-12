// R1: default lead time for a timed action item's local notification.
// Independent of calendar.ts's -60min all-day/60min timed alarm offsets —
// those are a separate (opt-in, calendar-provider) reminder channel.
export const REMINDER_OFFSET_MINUTES = 10;

// R2: local hour a date-only (no due_time) action item's notification fires at.
export const DATE_ONLY_REMINDER_HOUR = 9;

export const NOTIFICATION_PERMISSION_RATIONALE =
  "Το Hey Lisa χρειάζεται άδεια ειδοποιήσεων για να σου υπενθυμίζει τις ενέργειές σου.";
