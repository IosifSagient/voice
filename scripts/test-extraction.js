// Standalone test for extraction logic — no test framework required.
// Run with:  node scripts/test-extraction.js

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else       { console.error(`  ✗ ${msg}`); failed++; }
}

// Mirrors buildAnchor() from src/services/extraction.ts
function buildAnchor(now) {
  const iso     = now.toLocaleString('sv', { timeZone: 'Europe/Athens' }).replace(' ', 'T');
  const weekday = now.toLocaleDateString('en-US', { timeZone: 'Europe/Athens', weekday: 'long' });
  return { iso, weekday };
}

// Mirrors the action-parsing logic from extractNote()
function parseActions(actions) {
  return (Array.isArray(actions) ? actions : []).map((a) => ({
    text:     a.title    ?? '',
    due_date: a.due_date ?? null,
    due_time: a.due_time ?? null,
    all_day:  a.all_day !== false,
  }));
}

// ── Test 1: anchor weekday ────────────────────────────────────────────────
// 2023-10-18 is a Wednesday. Athens is EEST (UTC+3) until last Sunday of October.
// 2023-10-18T10:00:00Z → 2023-10-18T13:00 in Athens → still Wednesday.
console.log('Test 1: anchor weekday for 2023-10-18');
{
  const anchor = buildAnchor(new Date('2023-10-18T10:00:00Z'));
  assert(anchor.weekday === 'Wednesday', `weekday="${anchor.weekday}" (want Wednesday)`);
  assert(anchor.iso.startsWith('2023-10-18'), `iso starts with 2023-10-18: "${anchor.iso}"`);
}

// ── Test 2: date resolution "την άλλη Τετάρτη" ───────────────────────────
// Anchor: Wednesday 2023-10-18.
// "αυτή/την Τετάρτη" = Oct 18 (same day).
// "την άλλη Τετάρτη" = next week's Wednesday = Oct 25.
// We mock the model response and check our parsing + the calendar assertion.
console.log('\nTest 2: parsed action — next-week Wednesday date');
{
  const items = parseActions([{
    title: 'Επικοινωνία με τον Δρ. Παπαδόπουλο',
    date_reasoning: 'Anchor: Wed 2023-10-18. "Την άλλη Τετάρτη" = +7 days = 2023-10-25.',
    due_date: '2023-10-25',
    due_time: null,
    all_day: true,
    add_to_calendar: true,
  }]);
  assert(items[0].due_date === '2023-10-25', `due_date="${items[0].due_date}" (want 2023-10-25)`);
  assert(items[0].all_day === true, `all_day=${items[0].all_day} (want true)`);
  assert(items[0].due_time === null, `due_time=${items[0].due_time} (want null)`);
  // Verify 2023-10-25 is indeed a Wednesday (getDay() === 3)
  assert(new Date('2023-10-25').getDay() === 3, `2023-10-25 is a Wednesday (getDay=${new Date('2023-10-25').getDay()})`);
}

// ── Test 3: timed event "στις 23:00" ─────────────────────────────────────
console.log('\nTest 3: parsed action — explicit time clears all_day');
{
  const items = parseActions([{
    title: 'Τηλεφώνημα με πελάτη',
    date_reasoning: 'Anchor: Wed 2023-10-18. "Στις 23:00 Παρασκευή" = 2023-10-20.',
    due_date: '2023-10-20',
    due_time: '23:00',
    all_day: false,
    add_to_calendar: true,
  }]);
  assert(items[0].due_time === '23:00', `due_time="${items[0].due_time}" (want 23:00)`);
  assert(items[0].all_day === false, `all_day=${items[0].all_day} (want false)`);
}

// ── Test 4: title stripping (model responsibility, but parse check) ───────
console.log('\nTest 4: title is mapped from actions[].title, not raw text');
{
  const items = parseActions([{
    title: 'Αποστολή email στον Γιώργη',   // clean task, no scaffolding
    due_date: null,
    due_time: null,
    all_day: true,
  }]);
  assert(items[0].text === 'Αποστολή email στον Γιώργη', `text="${items[0].text}"`);
  assert(!items[0].text.includes('ημερολόγιο'), `title must not echo the delivery instruction`);
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
