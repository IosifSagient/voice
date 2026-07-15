// End-to-end proof for the topic-tag stem-canonicalization fix: two notes that
// tag the same concept with different Greek inflections must both surface from
// a single tag query — this is the exact bug report ("κλίβανος" tagged on one
// note, "κλιβάνους" on another; get_notes_by_tag exact-matched, so a topic
// query found one and missed the other).

jest.mock('expo-sqlite', () => {
  // Inlined: jest.mock factories may not reference out-of-scope helpers.
  function makeSqliteMock() {
    const notes = [];
    // Already at the terminal migration version — this test exercises the
    // write+read path, not the migration itself (see topicsMigration.test.js).
    let userVersion = 5;

    async function execAsync(sql) {
      const versionMatch = sql.match(/PRAGMA user_version = (\d+)/);
      if (versionMatch) userVersion = Number(versionMatch[1]);
    }

    async function getFirstAsync(sql) {
      if (sql.includes('PRAGMA user_version')) return { user_version: userVersion };
      return null;
    }

    async function getAllAsync(sql) {
      if (sql.includes('SELECT id, people_json FROM notes WHERE people_normalized_json IS NULL')) return [];
      if (sql.includes('WHERE notes.topics_json IS NOT NULL')) {
        return notes.map((n) => ({ ...n, open_count: 0 }));
      }
      return [];
    }

    async function runAsync(sql, ...params) {
      if (sql.includes('INSERT INTO notes (')) {
        const [
          id, created_at, transcript, summary,
          people_json, topics_json, decisions_json, people_normalized_json,
        ] = params;
        notes.push({
          id, created_at, transcript, summary,
          people_json, topics_json, decisions_json, people_normalized_json,
        });
      }
      return { changes: 1 };
    }

    async function withTransactionAsync(fn) {
      await fn();
    }

    return { execAsync, getFirstAsync, getAllAsync, runAsync, withTransactionAsync };
  }

  return {
    openDatabaseAsync: jest.fn(() => Promise.resolve(makeSqliteMock())),
  };
});

const { saveNote, getNotesByTag } = require('../src/db');

describe('topic tag stem-canonicalization — end to end', () => {
  it('finds both notes for "κλίβανος" even though one was tagged "κλιβάνους"', async () => {
    await saveNote(
      { summary: 'S1', people: [], topics: ['κλίβανος'], action_items: [] },
      'Πρέπει να καθαρίσω τον κλίβανο.',
    );
    await saveNote(
      { summary: 'S2', people: [], topics: ['κλιβάνους'], action_items: [] },
      'Πήγα και είδα τους κλιβάνους.',
    );

    const results = await getNotesByTag('topic', 'κλίβανος');

    expect(results.map((n) => n.summary).sort()).toEqual(['S1', 'S2']);
  });

  it('merges same-note duplicate spelling into one canonical topic tag at save time', async () => {
    await saveNote(
      { summary: 'S3', people: [], topics: ['κλίβανος', 'κλιβάνους'], action_items: [] },
      'Καθάρισα τον κλίβανο και τους άλλους κλιβάνους.',
    );

    const [saved] = (await getNotesByTag('topic', 'κλίβανος')).filter((n) => n.summary === 'S3');
    expect(saved.topics).toEqual(['κλίβανος']);
  });
});
