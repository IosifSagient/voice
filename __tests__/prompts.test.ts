import { buildAgentSystemPrompt } from '../src/config/prompts';
import { buildAnchor } from '../src/lib/dateAnchor';

const FIXED = new Date('2025-07-02T14:30:00.000Z'); // Wed 2025-07-02, Athens 17:30 (+03:00)

describe('buildAgentSystemPrompt', () => {
  it('injects the calendar block', () => {
    const { iso, weekday, calendarBlock } = buildAnchor(FIXED);
    const prompt = buildAgentSystemPrompt(iso, weekday, calendarBlock);
    expect(prompt).toContain('This week:');
    expect(prompt).toContain('Next week:');
    expect(prompt).toContain('Wednesday: 2025-07-02  ← today');
  });

  it('includes the this-week/next-week weekday mapping rule', () => {
    const { iso, weekday, calendarBlock } = buildAnchor(FIXED);
    const prompt = buildAgentSystemPrompt(iso, weekday, calendarBlock);
    expect(prompt).toContain('THIS WEEK column');
    expect(prompt).toContain('NEXT WEEK column');
    expect(prompt).toContain('την άλλη');
  });

  it('includes the reworded verify-before-tool-call line', () => {
    const { iso, weekday, calendarBlock } = buildAnchor(FIXED);
    const prompt = buildAgentSystemPrompt(iso, weekday, calendarBlock);
    expect(prompt).toContain(
      'Verify any resolved date falls on the named weekday before using it in a tool call.',
    );
  });

  it('defines the this-week window and the canonical date-scoped-question routing', () => {
    const { iso, weekday, calendarBlock } = buildAnchor(FIXED);
    const prompt = buildAgentSystemPrompt(iso, weekday, calendarBlock);
    expect(prompt).toContain('Monday through Sunday of the THIS WEEK column');
    expect(prompt).toContain('get_notes_by_date_range(from, to)');
    expect(prompt).toContain('due_after/due_before read off the table');
  });

  it('routes a topic+date-scoped question to search_notes_in_range instead of eyeballing get_notes_by_date_range results', () => {
    const { iso, weekday, calendarBlock } = buildAnchor(FIXED);
    const prompt = buildAgentSystemPrompt(iso, weekday, calendarBlock);
    expect(prompt).toContain('search_notes_in_range(terms, from, to)');
    expect(prompt).toContain('do NOT call get_notes_by_date_range and judge topic matches yourself');
  });

  it('includes the counting/truncation-honesty rule with tool caps, including search_notes_in_range', () => {
    const { iso, weekday, calendarBlock } = buildAnchor(FIXED);
    const prompt = buildAgentSystemPrompt(iso, weekday, calendarBlock);
    expect(prompt).toContain('search_notes ≤10');
    expect(prompt).toContain('search_notes_in_range ≤50');
    expect(prompt).toContain('get_action_items ≤50');
    expect(prompt).toContain('at least N');
  });

  it('still substitutes the current datetime and weekday', () => {
    const { iso, weekday, calendarBlock } = buildAnchor(FIXED);
    const prompt = buildAgentSystemPrompt(iso, weekday, calendarBlock);
    expect(prompt).toContain(`Current datetime (Europe/Athens): ${iso}`);
    expect(prompt).toContain('Current weekday: Wednesday');
  });

  it('leaves no unreplaced template placeholders', () => {
    const { iso, weekday, calendarBlock } = buildAnchor(FIXED);
    const prompt = buildAgentSystemPrompt(iso, weekday, calendarBlock);
    expect(prompt).not.toMatch(/\{\{.*\}\}/);
  });
});
