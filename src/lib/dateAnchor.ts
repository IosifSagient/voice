const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Builds the datetime anchor injected into the extraction prompt so the model
// can resolve weekday names ("την Παρασκευή") to concrete ISO dates without
// doing arithmetic (which LLMs get wrong). Returns the current Athens time,
// the weekday name, and a Mon–Sun table for this week and next.
export function buildAnchor(now: Date = new Date()): {
  iso: string;
  weekday: string;
  calendarBlock: string;
} {
  const iso = now.toLocaleString('sv', { timeZone: 'Europe/Athens' }).replace(' ', 'T');
  const weekday = now.toLocaleDateString('en-US', { timeZone: 'Europe/Athens', weekday: 'long' });

  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  const jsDay = todayUtc.getUTCDay(); // 0=Sun … 6=Sat
  const daysToMonday = jsDay === 0 ? 6 : jsDay - 1;
  const monday = new Date(Date.UTC(y, m - 1, d - daysToMonday));

  const rows: string[] = [];
  for (let week = 0; week < 2; week++) {
    rows.push(week === 0 ? 'This week:' : 'Next week:');
    for (let i = 0; i < 7; i++) {
      const day = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + week * 7 + i));
      const dateStr = day.toISOString().slice(0, 10);
      const dayName = DAYS[day.getUTCDay()];
      const marker = dateStr === todayUtc.toISOString().slice(0, 10) ? '  ← today' : '';
      rows.push(`  ${dayName}: ${dateStr}${marker}`);
    }
  }

  return { iso, weekday, calendarBlock: rows.join('\n') };
}
