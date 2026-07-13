// End-to-end proof for the "no honorifics in person tags" policy: three notes that
// mention the same person with different honorific variants must all surface from a
// single tag query — «Δώσ'μου τις σημειώσεις για τον Παπαδόπουλο» should return all 3,
// not just the ones whose honorific happened to already be stripped correctly.

jest.mock('expo-sqlite', () => {
  // Inlined: jest.mock factories may not reference out-of-scope helpers.
  function makeSqliteMock() {
    const notes = [];
    let userVersion = 0;

    async function execAsync(sql) {
      const versionMatch = sql.match(/PRAGMA user_version = (\d+)/);
      if (versionMatch) {
        userVersion = Number(versionMatch[1]);
      } else if (sql.includes('UPDATE notes SET people_normalized_json = NULL')) {
        notes.forEach((n) => {
          n.people_normalized_json = null;
        });
      }
    }

    async function getFirstAsync(sql) {
      if (sql.includes('PRAGMA user_version')) return { user_version: userVersion };
      return null;
    }

    async function getAllAsync(sql, ...params) {
      if (sql.includes('SELECT id, people_json FROM notes WHERE people_normalized_json IS NULL')) {
        return notes
          .filter((n) => n.people_normalized_json == null)
          .map((n) => ({ id: n.id, people_json: n.people_json }));
      }
      if (sql.includes('WHERE notes.people_normalized_json LIKE')) {
        const needle = params[0].slice(1, -1);
        return notes
          .filter((n) => (n.people_normalized_json || '').includes(needle))
          .map((n) => ({ ...n, open_count: 0 }));
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
      } else if (sql.includes('UPDATE notes SET people_json = ?, people_normalized_json = ? WHERE id = ?')) {
        const [people_json, people_normalized_json, id] = params;
        const row = notes.find((n) => n.id === id);
        row.people_json = people_json;
        row.people_normalized_json = people_normalized_json;
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

describe('person tag policy — end to end', () => {
  it('finds all 3 notes for "Παπαδόπουλος" despite different honorifics in each transcript', async () => {
    await saveNote(
      { summary: 'S1', people: ['δόκτωρ Παπαδόπουλος'], topics: [], action_items: [] },
      'Ο δόκτωρ Παπαδόπουλος ζήτησε δείγματα.',
    );
    await saveNote(
      { summary: 'S2', people: ['Δρ. Παπαδόπουλος'], topics: [], action_items: [] },
      'Μίλησα με τον Δρ. Παπαδόπουλος.',
    );
    await saveNote(
      { summary: 'S3', people: ['κ. Παπαδόπουλος'], topics: [], action_items: [] },
      'Ο κ. Παπαδόπουλος θα έρθει αύριο.',
    );

    const results = await getNotesByTag('person', 'Παπαδόπουλος');

    expect(results).toHaveLength(3);
    // and the tag itself is now clean everywhere, not just matchable
    results.forEach((note) => expect(note.people).toEqual(['Παπαδόπουλος']));
  });
});
