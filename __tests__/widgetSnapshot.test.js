process.env.TZ = "Europe/Athens";

// Unlike the other db tests' hand-rolled fakes, ordering and an uncapped
// COUNT can only be verified by actually executing the SQL — so expo-sqlite
// is mocked with a thin async adapter over Node's built-in in-memory SQLite
// (node:sqlite, Node >= 22.5). getDb() runs the real SCHEMA + migrate()
// against it, so the tables under test are the app's real schema.
jest.mock("expo-sqlite", () => {
  const { DatabaseSync } = require("node:sqlite");
  const mock = { raw: null };
  const flat = (params) =>
    params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  mock.openDatabaseAsync = jest.fn(async () => {
    const raw = new DatabaseSync(":memory:");
    mock.raw = raw;
    return {
      async execAsync(sql) {
        raw.exec(sql);
      },
      async getFirstAsync(sql, ...params) {
        return raw.prepare(sql).get(...flat(params)) ?? null;
      },
      async getAllAsync(sql, ...params) {
        return raw.prepare(sql).all(...flat(params));
      },
      async runAsync(sql, ...params) {
        const r = raw.prepare(sql).run(...flat(params));
        return { changes: r.changes, lastInsertRowId: r.lastInsertRowid };
      },
      async withTransactionAsync(fn) {
        raw.exec("BEGIN");
        try {
          await fn();
          raw.exec("COMMIT");
        } catch (err) {
          raw.exec("ROLLBACK");
          throw err;
        }
      },
    };
  });
  return mock;
});

const {
  initDb,
  parseDueDate,
  countOpenActionItems,
  getOpenActionItemsForWidget,
  getTasksWithDueDates,
} = require("../src/db");
const {
  buildWidgetSnapshot,
  loadWidgetSnapshot,
  WIDGET_TASK_LIMIT,
} = require("../src/services/widgetSnapshot");

const raw = () => jest.requireMock("expo-sqlite").raw;

function seed({
  id,
  text = id,
  shortTitle = null,
  due = null, // 'YYYY-MM-DD', stored exactly as saveNote does (parseDueDate)
  time = null,
  allDay = 1,
  status = "open",
  createdAt = 0,
}) {
  raw()
    .prepare(
      `INSERT INTO action_items (id, note_id, text, short_title, due_date, due_time, all_day, status, created_at)
       VALUES (?, 'n1', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, text, shortTitle, parseDueDate(due), time, allDay, status, createdAt);
}

beforeAll(async () => {
  await initDb();
  raw().exec(`INSERT INTO notes (id, created_at, summary) VALUES ('n1', 0, '')`);
});

beforeEach(() => {
  raw().exec("DELETE FROM action_items");
});

describe("getOpenActionItemsForWidget — ordering", () => {
  it("dated before undated; same date timed (by due_time) before untimed; ties by created_at then id", async () => {
    seed({ id: "undated-late", createdAt: 2 });
    seed({ id: "undated-early", createdAt: 0 });
    seed({ id: "jul10", due: "2026-07-10", createdAt: 1 });
    seed({ id: "jul09-untimed", due: "2026-07-09", createdAt: 0 });
    seed({ id: "jul09-1500", due: "2026-07-09", time: "15:00", allDay: 0, createdAt: 5 });
    seed({ id: "jul09-0900-c9", due: "2026-07-09", time: "09:00", allDay: 0, createdAt: 9 });
    seed({ id: "jul09-0900-c3", due: "2026-07-09", time: "09:00", allDay: 0, createdAt: 3 });
    seed({ id: "jul11-h", due: "2026-07-11", createdAt: 7 });
    seed({ id: "jul11-g", due: "2026-07-11", createdAt: 7 });

    const rows = await getOpenActionItemsForWidget(100);

    expect(rows.map((r) => r.id)).toEqual([
      "jul09-0900-c3",
      "jul09-0900-c9",
      "jul09-1500",
      "jul09-untimed",
      "jul10",
      "jul11-g",
      "jul11-h",
      "undated-early",
      "undated-late",
    ]);
  });

  it("respects the limit", async () => {
    for (let i = 0; i < 5; i++) seed({ id: `t${i}`, due: "2026-07-09", createdAt: i });
    const rows = await getOpenActionItemsForWidget(3);
    expect(rows.map((r) => r.id)).toEqual(["t0", "t1", "t2"]);
  });

  it("maps a row to the WidgetTask shape", async () => {
    seed({ id: "a", text: "Ραντεβού με τον γιατρό", shortTitle: "Γιατρός", due: "2026-07-09", time: "09:30", allDay: 0 });
    seed({ id: "b", text: "Γάλα" });
    const [timed, undated] = await getOpenActionItemsForWidget(3);
    expect(timed).toEqual({
      id: "a", text: "Ραντεβού με τον γιατρό", shortTitle: "Γιατρός", dueDate: "2026-07-09", dueTime: "09:30", allDay: false,
    });
    expect(undated).toEqual({
      id: "b", text: "Γάλα", shortTitle: null, dueDate: null, dueTime: null, allDay: true,
    });
  });
});

describe("countOpenActionItems", () => {
  it("is exact above 50 (the list queries' cap) and includes undated tasks", async () => {
    for (let i = 0; i < 30; i++) seed({ id: `dated${i}`, due: "2026-07-09" });
    for (let i = 0; i < 30; i++) seed({ id: `undated${i}` });
    expect(await countOpenActionItems()).toBe(60);
  });

  it("counts undated open tasks", async () => {
    seed({ id: "u1" });
    seed({ id: "u2" });
    expect(await countOpenActionItems()).toBe(2);
  });

  it("is 0 on an empty table", async () => {
    expect(await countOpenActionItems()).toBe(0);
  });
});

describe("'done' tasks", () => {
  it("are excluded from both the count and the list", async () => {
    seed({ id: "open", due: "2026-07-09" });
    seed({ id: "done-dated", due: "2026-07-01", status: "done" });
    seed({ id: "done-undated", status: "done" });

    expect(await countOpenActionItems()).toBe(1);
    expect((await getOpenActionItemsForWidget(10)).map((r) => r.id)).toEqual(["open"]);
  });
});

describe("dueDate conversion", () => {
  const ORIGINAL_TZ = process.env.TZ;
  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("matches getTasksWithDueDates for the same stored row", async () => {
    seed({ id: "a", due: "2026-07-09" });
    const [widget] = await getOpenActionItemsForWidget(1);
    const [existing] = await getTasksWithDueDates();
    expect(widget.dueDate).toBe(existing.dueDate);
    expect(widget.dueDate).toBe("2026-07-09");
  });

  it.each(["Pacific/Kiritimati", "Pacific/Pago_Pago", "UTC"])(
    "is timezone-stable (device TZ %s)",
    async (tz) => {
      seed({ id: "a", due: "2026-12-31" });
      process.env.TZ = tz;
      const [row] = await getOpenActionItemsForWidget(1);
      expect(row.dueDate).toBe("2026-12-31");
    },
  );
});

describe("buildWidgetSnapshot", () => {
  const task = (id) => ({ id, text: id, shortTitle: null, dueDate: null, dueTime: null, allDay: true });

  it("caps tasks at 3 even when more rows are passed, preserving order", () => {
    const snap = buildWidgetSnapshot({
      openCount: 5,
      rows: ["a", "b", "c", "d", "e"].map(task),
      now: 1000,
    });
    expect(WIDGET_TASK_LIMIT).toBe(3);
    expect(snap).toEqual({
      version: 1,
      generatedAt: 1000,
      openCount: 5,
      tasks: ["a", "b", "c"].map(task),
    });
  });

  it("is deterministic for the same inputs", () => {
    const input = { openCount: 1, rows: [task("a")], now: 42 };
    expect(buildWidgetSnapshot(input)).toEqual(buildWidgetSnapshot(input));
  });
});

describe("loadWidgetSnapshot", () => {
  it("returns openCount 0 and no tasks for an empty DB", async () => {
    expect(await loadWidgetSnapshot({ now: 1000 })).toEqual({
      version: 1,
      generatedAt: 1000,
      openCount: 0,
      tasks: [],
    });
  });

  it("combines the full count with the first 3 tasks", async () => {
    seed({ id: "undated" });
    seed({ id: "jul12", due: "2026-07-12" });
    seed({ id: "jul10", due: "2026-07-10" });
    seed({ id: "jul11", due: "2026-07-11" });
    seed({ id: "done", due: "2026-07-01", status: "done" });

    const snap = await loadWidgetSnapshot({ now: 1000 });

    expect(snap.openCount).toBe(4);
    expect(snap.tasks.map((t) => t.id)).toEqual(["jul10", "jul11", "jul12"]);
  });

  it("round-trips through JSON and stays small (3-task case)", async () => {
    seed({
      id: "3f2b8c1e-9a4d-4e7f-b6c2-1d0e5a7b9c3f",
      text: "Ραντεβού με τον οδοντίατρο για τον καθαρισμό",
      shortTitle: "Οδοντίατρος",
      due: "2026-07-09",
      time: "17:30",
      allDay: 0,
    });
    seed({
      id: "a1c4e7d2-5b8f-4a3e-9c6d-2f1b0e8a7d5c",
      text: "Να πληρώσω τον λογαριασμό της ΔΕΗ",
      shortTitle: "Πληρωμή ΔΕΗ",
      due: "2026-07-10",
    });
    seed({
      id: "7e9d2a4b-1c6f-4b8e-a3d5-9f0c2e4b6a8d",
      text: "Να πάρω τηλέφωνο τη Μαρία για το δώρο",
      shortTitle: "Κλήση Μαρίας",
    });

    const snap = await loadWidgetSnapshot({ now: Date.UTC(2026, 6, 8, 9, 0) });
    const json = JSON.stringify(snap);

    expect(JSON.parse(json)).toEqual(snap);
    expect(snap.version).toBe(1);
    expect(JSON.parse(json).tasks.map((t) => t.shortTitle)).toEqual([
      "Οδοντίατρος",
      "Πληρωμή ΔΕΗ",
      "Κλήση Μαρίας",
    ]);
    expect(Buffer.byteLength(json, "utf8")).toBeLessThan(1024);
  });
});
