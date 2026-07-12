import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TodaySection } from '../src/components/TodaySection';
import type { TaskWithDueDate } from '../src/types/tasks';

function mkTask(overrides: Partial<TaskWithDueDate> = {}): TaskWithDueDate {
  return {
    id: 't1',
    noteId: 'n1',
    text: 'Call the plumber',
    dueDate: '2026-07-08',
    dueTime: null,
    allDay: true,
    status: 'open',
    calendarEventId: null,
    notificationId: null,
    createdAt: 0,
    noteSummary: 'summary',
    notePeople: [],
    ...overrides,
  };
}

type Props = React.ComponentProps<typeof TodaySection>;

function renderTodaySection(overrides: Partial<Props> = {}) {
  const props: Props = {
    overdue: [],
    today: [],
    upcoming: [],
    loading: false,
    error: null,
    onPressTask: jest.fn(),
    onComplete: jest.fn(),
    onUndo: jest.fn(),
    ...overrides,
  };
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(TodaySection, props));
  });
  return { renderer, props };
}

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object' && node !== null && 'children' in node) {
    return collectText((node as { children: unknown }).children);
  }
  return [];
}

function renderedText(renderer: ReactTestRenderer): string {
  return collectText(renderer.toJSON()).join(' | ');
}

describe('TodaySection — bucket visibility', () => {
  it('shows only the header for a non-empty bucket', () => {
    const { renderer } = renderTodaySection({ today: [mkTask({ id: 't1' })] });
    const text = renderedText(renderer);
    expect(text).toContain('Σήμερα');
    expect(text).not.toContain('Εκπρόθεσμα');
    expect(text).not.toContain('Προσεχώς');
  });

  it('shows headers for every non-empty bucket at once', () => {
    const { renderer } = renderTodaySection({
      overdue: [mkTask({ id: 't1' })],
      today: [mkTask({ id: 't2' })],
      upcoming: [mkTask({ id: 't3' })],
    });
    const text = renderedText(renderer);
    expect(text).toContain('Εκπρόθεσμα');
    expect(text).toContain('Σήμερα');
    expect(text).toContain('Προσεχώς');
  });
});

describe('TodaySection — empty state', () => {
  it('renders the empty state when all buckets are empty and not loading', () => {
    const { renderer } = renderTodaySection({ loading: false });
    expect(renderedText(renderer)).toContain('Τίποτα για σήμερα');
  });

  it('does not render the empty state while loading, even if all buckets are empty', () => {
    const { renderer } = renderTodaySection({ loading: true });
    expect(renderedText(renderer)).not.toContain('Τίποτα για σήμερα');
  });

  it('does not render the empty state when any bucket has items', () => {
    const { renderer } = renderTodaySection({ today: [mkTask()] });
    expect(renderedText(renderer)).not.toContain('Τίποτα για σήμερα');
  });
});

describe('TodaySection — snackbar replacement on rapid completion', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('gives a second completion its own full-duration timer instead of inheriting the first one\'s', () => {
    const taskA = mkTask({ id: 'a', text: 'Task A' });
    const taskB = mkTask({ id: 'b', text: 'Task B' });
    const { renderer } = renderTodaySection({ today: [taskA, taskB] });

    // Complete A at t=0 (4000ms default duration -> would fire at t=4000).
    act(() => {
      renderer.root.findByProps({ testID: 'task-checkbox-a' }).props.onPress();
    });
    expect(renderedText(renderer)).toContain('ολοκληρώθηκε');

    // Complete B at t=1000, before A's timer would have fired — this must
    // replace the pending snackbar and reset the window.
    act(() => {
      jest.advanceTimersByTime(1000);
      renderer.root.findByProps({ testID: 'task-checkbox-b' }).props.onPress();
    });

    // t=4000 total: A's original timer would have fired here if it hadn't
    // been cleared. B's fresh window only started at t=1000, so it needs
    // until t=5000 — the snackbar must still be visible.
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(renderedText(renderer)).toContain('ολοκληρώθηκε');

    // t=5000 total: B's own full duration has now elapsed — dismissed.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(renderedText(renderer)).not.toContain('ολοκληρώθηκε');
  });

  it('clears the timer on unmount without throwing or firing after unmount', () => {
    const taskA = mkTask({ id: 'a' });
    const { renderer } = renderTodaySection({ today: [taskA] });

    act(() => {
      renderer.root.findByProps({ testID: 'task-checkbox-a' }).props.onPress();
    });

    act(() => {
      renderer.unmount();
    });

    expect(() => {
      act(() => {
        jest.advanceTimersByTime(10000);
      });
    }).not.toThrow();
  });
});
