import { applyReminderDiff } from '../src/hooks/reminderDiff';
import { notesRepository } from '../src/services/notesRepository';
import { removeReminder } from '../src/services/calendar';
import { cancelReminder, scheduleReminder } from '../src/services/notifications';

jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    setNotificationId: jest.fn(),
  },
}));
jest.mock('../src/services/calendar', () => ({
  removeReminder: jest.fn(),
}));
jest.mock('../src/services/notifications', () => ({
  cancelReminder: jest.fn(),
  scheduleReminder: jest.fn(),
}));

const mockSetNotificationId = notesRepository.setNotificationId as jest.Mock;
const mockRemoveReminder = removeReminder as jest.Mock;
const mockCancelReminder = cancelReminder as jest.Mock;
const mockScheduleReminder = scheduleReminder as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('applyReminderDiff', () => {
  it('cancels both the calendar event and notification for a removed row', async () => {
    await applyReminderDiff(
      {
        removed: [{ calendarEventId: 'cal-1', notificationId: 'notif-1' }],
        changed: [],
      },
      'note-1',
    );
    expect(mockRemoveReminder).toHaveBeenCalledWith('cal-1');
    expect(mockCancelReminder).toHaveBeenCalledWith('notif-1');
  });

  it('skips removeReminder/cancelReminder for a removed row with no ids', async () => {
    await applyReminderDiff(
      { removed: [{ calendarEventId: null, notificationId: null }], changed: [] },
      'note-1',
    );
    expect(mockRemoveReminder).not.toHaveBeenCalled();
    expect(mockCancelReminder).not.toHaveBeenCalled();
  });

  it('for a changed row, cancels the old notification, schedules a new one, and persists it — but never touches the calendar event', async () => {
    mockScheduleReminder.mockResolvedValue('notif-new');
    await applyReminderDiff(
      {
        removed: [],
        changed: [
          {
            id: 'a1',
            calendarEventId: 'cal-1',
            notificationId: 'notif-old',
            item: { text: 'x', due_date: '2099-01-01', id: 'a1' },
          },
        ],
      },
      'note-1',
    );
    expect(mockCancelReminder).toHaveBeenCalledWith('notif-old');
    expect(mockScheduleReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a1',
        due_date: '2099-01-01',
        note_id: 'note-1',
        task_id: 'a1',
      }),
    );
    expect(mockSetNotificationId).toHaveBeenCalledWith('a1', 'notif-new');
    expect(mockRemoveReminder).not.toHaveBeenCalled();
  });

  it('cancels the orphaned notification and does not throw when persisting the new id fails AFTER scheduling succeeded', async () => {
    mockScheduleReminder.mockResolvedValue('notif-new');
    mockSetNotificationId.mockRejectedValueOnce(new Error('db write failed'));

    // The note save already succeeded by the time applyReminderDiff runs, so
    // a bookkeeping failure here must not throw and fail the caller's save/regenerate.
    await expect(
      applyReminderDiff(
        {
          removed: [],
          changed: [{ id: 'a1', calendarEventId: null, notificationId: null, item: { text: 'x', due_date: '2099-01-01' } }],
        },
        'note-1',
      ),
    ).resolves.toBeUndefined();

    expect(mockCancelReminder).toHaveBeenCalledWith('notif-new');
  });

  it('persists null when the rescheduled reminder no-ops (R4/past due date)', async () => {
    mockScheduleReminder.mockResolvedValue(null);
    await applyReminderDiff(
      {
        removed: [],
        changed: [{ id: 'a1', calendarEventId: null, notificationId: null, item: { text: 'x', due_date: '2020-01-01' } }],
      },
      'note-1',
    );
    expect(mockSetNotificationId).toHaveBeenCalledWith('a1', null);
  });
});
