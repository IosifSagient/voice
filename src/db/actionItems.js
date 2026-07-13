import { getDb } from "./connection";

export async function completeActionItem(id) {
  const db = await getDb();
  await db.runAsync(`UPDATE action_items SET status = 'done' WHERE id = ?`, id);
}

export async function setActionCalendarEvent(id, calendarEventId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE action_items SET calendar_event_id = ? WHERE id = ?`,
    calendarEventId,
    id,
  );
}

export async function setActionNotificationId(id, notificationId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE action_items SET notification_id = ? WHERE id = ?`,
    notificationId,
    id,
  );
}

export async function reopenActionItem(id) {
  const db = await getDb();
  await db.runAsync(`UPDATE action_items SET status = 'open' WHERE id = ?`, id);
}

export async function deleteActionItem(id) {
  const db = await getDb();
  let row;
  // Same atomicity concern as deleteNote — read-then-delete must not straddle
  // a concurrent write.
  await db.withTransactionAsync(async () => {
    row = await db.getFirstAsync(
      `SELECT calendar_event_id, notification_id FROM action_items WHERE id = ?`,
      id,
    );
    if (row) {
      await db.runAsync(`DELETE FROM action_items WHERE id = ?`, id);
    }
  });
  if (!row) return null;
  return {
    calendarEventId: row.calendar_event_id ?? null,
    notificationId: row.notification_id ?? null,
  };
}
