// Real SQL through the app's real schema, same adapter as widgetSnapshot.test.js:
// whether an edit keeps or clears short_title depends on which statement runs.
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
  migrate,
  saveNote,
  updateNote,
  getNote,
  completeActionItem,
  reopenActionItem,
  getOpenActionItemsForWidget,
} = require("../src/db");
const { getDb } = require("../src/db/connection");
const { encodeShare, decodeShare } = require("../src/services/shareCodec");

const sqlite = () => jest.requireMock("expo-sqlite");
let raw;

const extraction = (actionItems) => ({
  summary: "Περίληψη",
  people: [],
  topics: [],
  action_items: actionItems,
});

const ITEM = {
  text: "Κάλεσε τη Μαρία για το δώρο",
  short_title: "Κλήση Μαρίας",
  due_date: "2026-11-02",
  due_time: null,
  all_day: true,
};

const columnNames = (db, table) =>
  db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

const storedRows = (noteId) =>
  raw
    .prepare("SELECT id, text, short_title FROM action_items WHERE note_id = ? ORDER BY created_at, text")
    .all(noteId);

beforeAll(async () => {
  await initDb();
  raw = sqlite().raw;
});

beforeEach(() => {
  raw.exec("DELETE FROM action_items");
  raw.exec("DELETE FROM notes");
});

describe("migration", () => {
  it("adds a nullable short_title column with no default", () => {
    const column = raw
      .prepare("PRAGMA table_info(action_items)")
      .all()
      .find((c) => c.name === "short_title");

    expect(column).toMatchObject({ type: "TEXT", notnull: 0, dflt_value: null });
  });

  it("re-running migrate and initDb is safe and keeps the data", async () => {
    const noteId = await saveNote(extraction([ITEM]), "t");

    await migrate(await getDb());
    await initDb();

    expect(storedRows(noteId)[0].short_title).toBe("Κλήση Μαρίας");
  });

  it("leaves user_version alone", () => {
    expect(raw.prepare("PRAGMA user_version").get().user_version).toBe(5);
  });

  it("upgrades an existing DB in place, old rows reading NULL", async () => {
    const adapter = await sqlite().openDatabaseAsync("legacy.db");
    const legacy = sqlite().raw;
    legacy.exec(`
      CREATE TABLE notes (id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL, transcript TEXT, summary TEXT);
      CREATE TABLE action_items (
        id TEXT PRIMARY KEY NOT NULL, note_id TEXT NOT NULL, text TEXT NOT NULL,
        due_date INTEGER, status TEXT NOT NULL DEFAULT 'open',
        calendar_event_id TEXT, created_at INTEGER NOT NULL
      );
      INSERT INTO action_items (id, note_id, text, created_at) VALUES ('old', 'n', 'Παλιά εργασία', 0);
      PRAGMA user_version = 5;
    `);
    expect(columnNames(legacy, "action_items")).not.toContain("short_title");

    await migrate(adapter);

    expect(columnNames(legacy, "action_items")).toContain("short_title");
    expect(legacy.prepare("SELECT text, short_title FROM action_items").get()).toEqual({
      text: "Παλιά εργασία",
      short_title: null,
    });
  });
});

describe("saveNote", () => {
  it("stores short_title", async () => {
    const noteId = await saveNote(extraction([ITEM]), "t");
    expect(storedRows(noteId)[0].short_title).toBe("Κλήση Μαρίας");
  });

  it.each([
    ["missing", { text: "Γάλα", due_date: null }],
    ["null", { text: "Γάλα", due_date: null, short_title: null }],
  ])("stores NULL when %s", async (_, item) => {
    const noteId = await saveNote(extraction([item]), "t");
    expect(storedRows(noteId)[0].short_title).toBeNull();
  });
});

describe("updateNote", () => {
  it("editing a task's text produces a new row with NULL short_title", async () => {
    const noteId = await saveNote(extraction([ITEM]), "t");
    const note = await getNote(noteId);
    const oldId = note.action_items[0].id;

    await updateNote({
      ...note,
      action_items: [{ ...note.action_items[0], text: "Κάλεσε τον Γιώργο" }],
    });

    const [row] = storedRows(noteId);
    expect(row.id).not.toBe(oldId);
    expect(row.text).toBe("Κάλεσε τον Γιώργο");
    expect(row.short_title).toBeNull();
  });

  it("clears the title even if the incoming item carries one", async () => {
    const noteId = await saveNote(extraction([ITEM]), "t");
    const note = await getNote(noteId);

    await updateNote({
      ...note,
      action_items: [{ ...note.action_items[0], text: "Κάλεσε τον Γιώργο", short_title: "Κλήση Μαρίας" }],
    });

    expect(storedRows(noteId)[0].short_title).toBeNull();
  });

  it("a date-only edit keeps short_title on the same row", async () => {
    const noteId = await saveNote(extraction([ITEM]), "t");
    const note = await getNote(noteId);
    const oldId = note.action_items[0].id;

    await updateNote({
      ...note,
      action_items: [{ ...note.action_items[0], due_date: "2026-12-25" }],
    });

    const [row] = storedRows(noteId);
    expect(row.id).toBe(oldId);
    expect(row.short_title).toBe("Κλήση Μαρίας");
    expect((await getNote(noteId)).action_items[0].due_date).toBe("2026-12-25");
  });

  it("a whitespace-only text edit keeps short_title", async () => {
    const noteId = await saveNote(extraction([ITEM]), "t");
    const note = await getNote(noteId);

    await updateNote({
      ...note,
      action_items: [{ ...note.action_items[0], text: `  ${ITEM.text} ` }],
    });

    expect(storedRows(noteId)[0].short_title).toBe("Κλήση Μαρίας");
  });

  it("editing one task leaves the other's title alone", async () => {
    const other = { ...ITEM, text: "Πλήρωσε το ρεύμα", short_title: "Πληρωμή ρεύματος" };
    const noteId = await saveNote(extraction([ITEM, other]), "t");
    const note = await getNote(noteId);

    await updateNote({
      ...note,
      action_items: note.action_items.map((item) =>
        item.text === ITEM.text ? { ...item, text: "Κάλεσε τον Γιώργο" } : item,
      ),
    });

    const titles = Object.fromEntries(storedRows(noteId).map((r) => [r.text, r.short_title]));
    expect(titles).toEqual({ "Κάλεσε τον Γιώργο": null, "Πλήρωσε το ρεύμα": "Πληρωμή ρεύματος" });
  });

  // The DB half of useRegenerateSummary: useRegenerateSummary.test.ts covers
  // that the hook carries action_items over, this covers what the column does.
  it("the regenerate-summary save keeps short_title", async () => {
    const noteId = await saveNote(extraction([ITEM]), "t");
    const note = await getNote(noteId);

    await updateNote({ ...note, transcript: "διορθωμένο", summary: "Νέα περίληψη", people: [], topics: [] });

    expect(storedRows(noteId)[0].short_title).toBe("Κλήση Μαρίας");
    expect((await getNote(noteId)).summary).toBe("Νέα περίληψη");
  });
});

describe("shares", () => {
  it("an accepted share stores NULL, dropping any title on the sender's item", async () => {
    const encoded = encodeShare(extraction([ITEM]), "t");
    expect(encoded.ok).toBe(true);
    const decoded = decodeShare(encoded.fragment);
    expect(decoded.ok).toBe(true);
    expect(decoded.extraction.action_items[0]).not.toHaveProperty("short_title");

    const noteId = await saveNote(decoded.extraction, decoded.transcript);

    expect(storedRows(noteId)[0].short_title).toBeNull();
  });
});

describe("getNote", () => {
  it("never returns short_title on the note or its action items", async () => {
    const noteId = await saveNote(extraction([ITEM]), "t");
    const note = await getNote(noteId);

    expect(note).not.toHaveProperty("short_title");
    expect(note.action_items).toHaveLength(1);
    expect(note.action_items[0]).not.toHaveProperty("short_title");
    expect(note.action_items[0]).not.toHaveProperty("shortTitle");
    expect(JSON.stringify(note)).not.toContain("Κλήση Μαρίας");
  });
});

describe("getOpenActionItemsForWidget", () => {
  it("returns shortTitle, null when absent", async () => {
    await saveNote(
      extraction([
        { ...ITEM, due_date: "2026-11-02" },
        { text: "Γάλα", due_date: "2026-11-03" },
      ]),
      "t",
    );

    const rows = await getOpenActionItemsForWidget(3);

    expect(rows.map((r) => [r.text, r.shortTitle])).toEqual([
      [ITEM.text, "Κλήση Μαρίας"],
      ["Γάλα", null],
    ]);
    expect(rows[0]).not.toHaveProperty("short_title");
  });

  it("keeps the title across complete and reopen", async () => {
    const noteId = await saveNote(extraction([ITEM]), "t");
    const { id } = storedRows(noteId)[0];

    await completeActionItem(id);
    expect(await getOpenActionItemsForWidget(3)).toEqual([]);

    await reopenActionItem(id);
    expect((await getOpenActionItemsForWidget(3))[0].shortTitle).toBe("Κλήση Μαρίας");
  });
});
