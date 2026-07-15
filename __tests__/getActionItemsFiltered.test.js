process.env.TZ = "Europe/Athens";

jest.mock('expo-sqlite', () => {
  // 2026-07-08 (Athens) and 2026-07-07, encoded exactly as parseDueDate would
  // (Date.UTC(y, m-1, d)) — see src/db/shared.js.
  const rows = [
    {
      id: 'due-today', note_id: 'n1', text: 'Today task',
      due_date: Date.UTC(2026, 6, 8), due_time: null, all_day: 1,
      status: 'open', calendar_event_id: null, notification_id: null,
      created_at: 0, note_summary: '', people_json: '[]',
    },
    {
      id: 'due-yesterday', note_id: 'n1', text: 'Yesterday task',
      due_date: Date.UTC(2026, 6, 7), due_time: null, all_day: 1,
      status: 'open', calendar_event_id: null, notification_id: null,
      created_at: 0, note_summary: '', people_json: '[]',
    },
    {
      id: 'done-yesterday', note_id: 'n1', text: 'Done yesterday task',
      due_date: Date.UTC(2026, 6, 7), due_time: null, all_day: 1,
      status: 'done', calendar_event_id: null, notification_id: null,
      created_at: 0, note_summary: '', people_json: '[]',
    },
  ];

  async function execAsync() {}
  async function getFirstAsync(sql) {
    if (sql.includes('PRAGMA user_version')) return { user_version: 5 };
    return null;
  }
  async function getAllAsync(sql, ...params) {
    if (sql.includes('people_normalized_json IS NULL')) return [];
    if (!sql.includes('FROM action_items')) return [];
    if (sql.includes('a.due_date < ?')) {
      const [cutoff] = params;
      return rows.filter(
        (r) => r.status === 'open' && r.due_date != null && r.due_date < cutoff,
      );
    }
    return rows;
  }

  return {
    openDatabaseAsync: jest.fn(() =>
      Promise.resolve({ execAsync, getFirstAsync, getAllAsync }),
    ),
  };
});

const { getActionItemsFiltered } = require('../src/db');
const { bucketTasksByDueDate } = require('../src/services/taskBuckets');

describe('getActionItemsFiltered — overdue', () => {
  it('a task due today is NOT overdue', async () => {
    const result = await getActionItemsFiltered({ overdue: true, todayAthens: '2026-07-08' });
    expect(result.map((r) => r.id)).not.toContain('due-today');
  });

  it('a task due yesterday IS overdue', async () => {
    const result = await getActionItemsFiltered({ overdue: true, todayAthens: '2026-07-08' });
    expect(result.map((r) => r.id)).toContain('due-yesterday');
  });

  it('a done task due yesterday is excluded (open-only, matching the UI)', async () => {
    const result = await getActionItemsFiltered({ overdue: true, todayAthens: '2026-07-08' });
    expect(result.map((r) => r.id)).not.toContain('done-yesterday');
  });

  it('ignores due_before/due_after when overdue is set', async () => {
    const result = await getActionItemsFiltered({
      overdue: true,
      todayAthens: '2026-07-08',
      dueBefore: '2000-01-01', // would exclude everything if honored
      dueAfter: '2999-01-01',  // would exclude everything if honored
    });
    expect(result.map((r) => r.id)).toEqual(['due-yesterday']);
  });

  it("matches taskBuckets' overdue boundary for the same due dates", async () => {
    const now = new Date('2026-07-08T10:00:00.000Z'); // same fixture taskBuckets.test.ts uses
    const mkTask = (id, dueDate, status = 'open') => ({
      id, noteId: 'n1', text: '', dueDate, dueTime: null, allDay: true,
      status, calendarEventId: null, notificationId: null, createdAt: 0,
      noteSummary: '', notePeople: [],
    });
    const tasks = [
      mkTask('due-today', '2026-07-08'),
      mkTask('due-yesterday', '2026-07-07'),
    ];
    const { overdue: bucketOverdue } = bucketTasksByDueDate(tasks, now);

    const agentOverdue = await getActionItemsFiltered({ overdue: true, todayAthens: '2026-07-08' });

    expect(agentOverdue.map((r) => r.id).sort()).toEqual(
      bucketOverdue.map((t) => t.id).sort(),
    );
  });
});
